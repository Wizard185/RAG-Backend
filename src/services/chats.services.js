import { Chat } from "../models/chat.models.js";
import { Message } from "../models/message.models.js";
import ApiError from "../utils/ApiError.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// 1. CREATE CHAT (Handles Personal & Global)
// ============================================================================
export const createChatService = async (userId, mode, subjectId = null) => {
  if (!userId) throw new ApiError(401, "User ID is missing");
  if (!mode) throw new ApiError(400, "Mode is required");

  // Logic: If mode is 'custom', we MUST have a subjectId (Global Space)
  // If mode is 'resume' or 'finance', it is Personal Space.
  
  const title = mode === "custom" 
    ? `Study Group: ${subjectId}` 
    : `${mode.charAt(0).toUpperCase() + mode.slice(1)} Assistant`;

  const chat = await Chat.create({
    userId: userId,
    mode: mode,
    subjectId: subjectId, // Save this! Critical for namespace later.
    title: title,
  });

  return chat;
};

// ============================================================================
// 2. GET CHATS (Separates User's view)
// ============================================================================
export const getChatsByModeService = async (userId, mode) => {
  const query = { userId: userId };
  if (mode) query.mode = mode;
  
  // Returns list of chats so user can click one to "Continue"
  return await Chat.find(query).sort({ updatedAt: -1 });
};

// ============================================================================
// 3. GET HISTORY (Load previous messages)
// ============================================================================
export const getChatWithMessagesService = async (userId, chatId) => {
  const chat = await Chat.findOne({ _id: chatId, userId: userId });
  if (!chat) throw new ApiError(404, "Chat not found");

  // Fetch history so the frontend can display it
  const messages = await Message.find({ chatId: chatId }).sort({ createdAt: 1 });

  return { chat, messages };
};

export const deleteChatService = async (userId, chatId) => {
  const chat = await Chat.findOne({ _id: chatId, userId: userId });
  if (!chat) throw new ApiError(404, "Chat not found");
  await Chat.deleteOne({ _id: chatId });
  await Message.deleteMany({ chatId: chatId });
  return true;
};

// ============================================================================
// 4. ASK QUESTION (With Context Memory)
// ============================================================================
export const askQuestionService = async (userId, chatId, question) => {
  const chat = await Chat.findOne({ _id: chatId, userId: userId });
  if (!chat) throw new ApiError(404, "Chat session not found");

  // 1. Setup AI
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(process.env.PINECONE_INDEX);
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    apiKey: process.env.GEMINI_API_KEY,
  });
  const chatModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); // Fast & Good

  // 2. Determine Namespace (Personal vs Global)
  // If subjectId exists, it's Global. If not, it's Personal (User_ID).
  const namespace = chat.mode === "custom" 
    ? `global-${chat.subjectId}` // Shared Space
    : `user_${userId}-${chat.mode}`; // Private Space

  console.log(`🔍 Querying Namespace: ${namespace}`);

  // 3. RAG Search (Get relevant file chunks)
  let fileContext = "";
  try {
    const queryVector = await embeddings.embedQuery(question);
    const searchResult = await index.namespace(namespace).query({
      vector: queryVector,
      topK: 3,
      includeMetadata: true,
    });
    if (searchResult.matches?.length > 0) {
      fileContext = searchResult.matches.map((m) => m.metadata.text).join("\n---\n");
    }
  } catch (err) {
    console.error("❌ Vector Search Error:", err.message);
  }

  // 4. FETCH CONVERSATION HISTORY (The "Memory")
  // We fetch the last 6 messages (3 turns) to give Gemini context
  const previousMessages = await Message.find({ chatId: chatId })
    .sort({ createdAt: -1 })
    .limit(6);
  
  // Format history for Gemini (Needs to be chronological)
  const historyText = previousMessages.reverse().map(msg => 
    `User: ${msg.question}\nAI: ${msg.answer}`
  ).join("\n\n");

  // 5. Construct Final Prompt
  const prompt = `
  You are an intelligent assistant.
  
  --- DOCUMENT CONTEXT (Facts from uploaded files) ---
  ${fileContext || "No relevant document data found."}

  --- CONVERSATION HISTORY (Previous discussion) ---
  ${historyText}

  --- NEW QUESTION ---
  User: ${question}
  
  INSTRUCTIONS:
  - Answer the new question using the Document Context.
  - Use the Conversation History to understand pronouns like "it", "he", or "that project".
  - If the answer isn't in the documents, say so politely.
  `;

  // 6. Generate & Save
  const result = await chatModel.generateContent(prompt);
  const aiResponse = result.response.text();

  const newMessage = await Message.create({
    chatId: chatId,
    question: question,
    answer: aiResponse 
  });

  // Update chat "updatedAt" so it moves to the top of the list
  await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

  return newMessage;
};