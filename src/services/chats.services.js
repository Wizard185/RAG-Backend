import { Chat } from "../models/chat.models.js";
import { Message } from "../models/message.models.js";
import ApiError from "../utils/ApiError.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { OllamaEmbeddings } from "@langchain/ollama"; 
import { MixedbreadAIEmbeddings } from "@langchain/mixedbread-ai"; // 👈 New Import
import { GoogleGenerativeAI } from "@google/generative-ai";

export const createChatService = async (userId, mode, subjectId = null) => {
  if (!userId) throw new ApiError(401, "User ID is missing");
  const title = mode === "custom" ? `Study Group: ${subjectId}` : `${mode} Assistant`;
  return await Chat.create({ userId, mode, subjectId, title });
};

export const getChatsByModeService = async (userId, mode) => {
  const query = { userId };
  if (mode) query.mode = mode;
  return await Chat.find(query).sort({ updatedAt: -1 });
};

export const getChatWithMessagesService = async (userId, chatId) => {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw new ApiError(404, "Chat not found");
  const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
  return { chat, messages };
};

export const deleteChatService = async (userId, chatId) => {
  /* ... same as before ... */
  await Chat.deleteOne({ _id: chatId });
  await Message.deleteMany({ chatId });
  return true;
};

// ============================================================================
// ASK QUESTION (Hybrid: Local vs. Cloud)
// ============================================================================
export const askQuestionService = async (userId, chatId, question) => {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw new ApiError(404, "Chat session not found");
  console.log("========================================");
  console.log("🔍 INSPECTING CHAT OBJECT FROM DB:");
  console.log(`🆔 Chat ID: ${chat._id}`);
  console.log(`⚙️ Mode: ${chat.mode}`);
  console.log(`📚 Subject ID: ${chat.subjectId}`); // <--- I bet this is undefined or null!
  console.log("========================================");
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(process.env.PINECONE_INDEX);
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite-preview-09-2025" });

  // 1. SELECT EMBEDDING SOURCE
  let embeddings;
  if (process.env.NODE_ENV === "production") {
      console.log("🌍 Using Cloud Embeddings (Mixedbread API)");
      embeddings = new MixedbreadAIEmbeddings({
          apiKey: process.env.MXBAI_API_KEY,
          modelName: "mxbai-embed-large-v1", 
      });
  } else {
      console.log("💻 Using Local Embeddings (Ollama: mxbai-embed-large)");
      embeddings = new OllamaEmbeddings({
          model: "mxbai-embed-large", 
          baseUrl: "http://127.0.0.1:11434",
      });
  }

  // 2. Search Pinecone
  const namespace = chat.mode === "custom" ? `global-${chat.subjectId}` : `user_${userId}-${chat.mode}`;
  let fileContext = "";
  
  try {
    const queryVector = await embeddings.embedQuery(question);
    const searchResult = await index.namespace(namespace).query({
      vector: queryVector,
      topK: 5, 
      includeMetadata: true,
    });

    if (searchResult.matches?.length > 0) {
      fileContext = searchResult.matches.map((m) => m.metadata.text).join("\n---\n");
    }
  } catch (err) {
    console.error("❌ Vector Search Error:", err.message);
  }

  // 3. Generate Answer (Gemini)
  const previousMessages = await Message.find({ chatId }).sort({ createdAt: -1 }).limit(6);
  const historyText = previousMessages.reverse().map(msg => `User: ${msg.question}\nAI: ${msg.answer}`).join("\n\n");

  const prompt = `
  You are a helpful AI tutor.
  
  --- DOCUMENT CONTEXT ---
  ${fileContext || "No relevant document data found."}

  --- CONVERSATION HISTORY ---
  ${historyText}

  --- NEW QUESTION ---
  User: ${question}
  
  INSTRUCTIONS:
  - Answer the question using the Document Context.
  - If the answer isn't in the documents, say so politely.
  `;

  const result = await chatModel.generateContent(prompt);
  const aiResponse = result.response.text();

  const newMessage = await Message.create({ chatId, question, answer: aiResponse });
  await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

  return newMessage;
};