import { Chat } from "../models/chat.models.js";
import { Message } from "../models/message.models.js";
import ApiError from "../utils/ApiError.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { OllamaEmbeddings } from "@langchain/ollama";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Creates a new chat session
 */
export const createChatService = async (userId, mode, subjectId = null) => {
  if (!userId) throw new ApiError(401, "User ID is missing");
  const title = mode === "custom" ? `Study Group: ${subjectId}` : `${mode} Assistant`;
  return await Chat.create({ userId, mode, subjectId, title });
};

/**
 * Retrieves all chats for a specific user and mode
 */
export const getChatsByModeService = async (userId, mode) => {
  const query = { userId };
  if (mode) query.mode = mode;
  return await Chat.find(query).sort({ updatedAt: -1 });
};

/**
 * Retrieves a chat and its message history
 */
export const getChatWithMessagesService = async (userId, chatId) => {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw new ApiError(404, "Chat not found");
  const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
  return { chat, messages };
};

/**
 * Deletes a chat session and all associated messages
 */
export const deleteChatService = async (userId, chatId) => {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw new ApiError(404, "Chat not found");
  
  await Chat.deleteOne({ _id: chatId });
  await Message.deleteMany({ chatId });
  return true;
};

// ============================================================================
// ASK QUESTION (Hybrid: Local vs. Cloud Retrieval)
// ============================================================================
export const askQuestionService = async (userId, chatId, question) => {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw new ApiError(404, "Chat session not found");

  console.log("========================================");
  console.log("🔍 RAG SESSION LOG:");
  console.log(`🆔 Chat ID: ${chat._id}`);
  console.log(`⚙️ Mode: ${chat.mode}`);
  console.log(`📚 Subject: ${chat.subjectId || "N/A"}`);
  console.log("========================================");

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(process.env.PINECONE_INDEX);
  
  // Initialize Gemini (Using 1.5-flash for stability/speed)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const chatModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL });

  // 1. SELECT EMBEDDING SOURCE (Automatic Switch based on NODE_ENV)
  let embeddings;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    console.log("🌍 Using Cloud: Hugging Face Inference API");
    embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HUGGINGFACEHUB_API_KEY, 
      model: "sentence-transformers/all-MiniLM-L6-v2",
      provider: "hf-inference", 
    });
  } else {
    console.log("💻 Using Local: Ollama (all-minilm)");
    embeddings = new OllamaEmbeddings({
      model: "all-minilm",
      baseUrl: "http://127.0.0.1:11434",
    });
  }

  // ---------------------------------------------------------
  // 2. DETERMINE NAMESPACE & FILTER (SaaS Strategy)
  // ---------------------------------------------------------
  let namespace;
  let pineconeFilter = {}; // Default: No filter (public data)

  if (chat.mode === "resume") {
      // 🌍 Search the global resume container
      namespace = "global-resumes";
      // 🔒 SECURITY: Only show chunks belonging to THIS user
      pineconeFilter = { userId: { $eq: userId } };
  } else if (chat.mode === "custom") {
      // Public study groups (shared knowledge)
      namespace = `global-${chat.subjectId || "general"}`;
  } else {
      // Fallback for other modes
      namespace = `global-${chat.mode}`;
  }
    
  let fileContext = "";
  
  try {
    const queryVector = await embeddings.embedQuery(question);

    const searchResult = await index.namespace(namespace).query({
      vector: queryVector,
      topK: 5, 
      includeMetadata: true,
      filter: pineconeFilter // 👈 APPLY THE FILTER HERE
    });

    if (searchResult.matches?.length > 0) {
      fileContext = searchResult.matches
        .map((m) => `[Relevance: ${m.score.toFixed(2)}] ${m.metadata.text}`)
        .join("\n---\n");
    }
  } catch (err) {
    console.error("❌ Vector Search Error:", err.message);
  }

  // 3. Build Context-Aware Prompt
  const previousMessages = await Message.find({ chatId }).sort({ createdAt: -1 }).limit(6);
  const historyText = previousMessages
    .reverse()
    .map(msg => `User: ${msg.question}\nAI: ${msg.answer}`)
    .join("\n\n");

  const prompt = `
  You are an expert AI tutor. Use the provided document context to answer the user's question.

  --- DOCUMENT CONTEXT ---
  ${fileContext || "No specific document data was found for this query."}

  --- CONVERSATION HISTORY ---
  ${historyText}

  --- NEW QUESTION ---
  User: ${question}
  
  INSTRUCTIONS:
  1. Priority: Answer using the "Document Context". Mention specific details from it.
  2. If the answer is NOT in the context, use your internal knowledge but state: "Based on general knowledge..."
  3. Keep the tone academic, helpful, and clear.
  `;

  // 4. Generate and Save Response
  const result = await chatModel.generateContent(prompt);
  const aiResponse = result.response.text();

  const newMessage = await Message.create({ chatId, question, answer: aiResponse });
  await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

  return newMessage;
};