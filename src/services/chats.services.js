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
  
  // 1. Initialize Gemini
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // Default to flash model if env var is missing
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const chatModel = genAI.getGenerativeModel({ model: modelName });

  // 2. SELECT EMBEDDING SOURCE
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
  // 3. DETERMINE NAMESPACE & FILTER (CRITICAL FIXES)
  // ---------------------------------------------------------
  let namespace;
  
  // ✅ FIX 1: Initialize filter as undefined (not empty object {})
  // Pinecone crashes if you send {}, it must be undefined if unused.
  let pineconeFilter = undefined; 

  if (chat.mode === "resume") {
      namespace = "global-resumes";
      pineconeFilter = { userId: { $eq: userId } };
  } else if (chat.mode === "custom") {
      // Use subjectId for namespace, fallback to 'general'
      const cleanSubjectId = chat.subjectId || "general";
      namespace = `global-${cleanSubjectId}`;
  } else {
      namespace = `global-${chat.mode}`;
  }
    
  // ---------------------------------------------------------
  // 4. FETCH TITLE PAGE (CONTEXT INJECTION)
  // ---------------------------------------------------------
  let titleContext = "";
  
  if (chat.mode === "custom" && chat.subjectId) {
      try {
          // Construct the ID for the very first chunk of this book
          // Ensure it matches your ingest.service.js logic: `${subjectId}_chunk_0`
          const titleChunkId = `${chat.subjectId}_chunk_0`;
          
          // ✅ FIX 2: Explicit logging and Array check
          // Ensure we are passing a valid array of strings
          if (titleChunkId && titleChunkId.trim() !== "") {
              console.log(`[DEBUG] Fetching Title Metadata for ID: [${titleChunkId}]`);
              
              // Attempt fetch (Try/Catch handles version differences)
let fetchResult;
try {
    // Try standard array syntax
    fetchResult = await index.namespace(namespace).fetch([titleChunkId]);
} catch (e) {
    // Fallback for older/different SDK versions that expect an object
    fetchResult = await index.namespace(namespace).fetch({ ids: [titleChunkId] });
}
              
              if (fetchResult.records && fetchResult.records[titleChunkId]) {
                  const text = fetchResult.records[titleChunkId].metadata.text;
                  titleContext = `
                  --- SOURCE MATERIAL INFORMATION ---
                  The user is asking questions about the document titled/containing:
                  "${text.substring(0, 500)}..."
                  -----------------------------------
                  `;
                  console.log("✅ Title context injected successfully.");
              }
          }
      } catch (err) {
          // Log but do not crash the chat
          console.warn("⚠️ Title fetch warning:", err.message);
      }
  }

  // ---------------------------------------------------------
  // 5. VECTOR SEARCH
  // ---------------------------------------------------------
  let fileContext = "";
  
  try {
    const queryVector = await embeddings.embedQuery(question);

    const queryOptions = {
      vector: queryVector,
      topK: 5, 
      includeMetadata: true,
    };

    // Only attach filter if it's defined (Fixes the crash)
    if (pineconeFilter) {
        queryOptions.filter = pineconeFilter;
    }

    const searchResult = await index.namespace(namespace).query(queryOptions);

    if (searchResult.matches?.length > 0) {
      fileContext = searchResult.matches
        .map((m) => `[Relevance: ${m.score.toFixed(2)}] ${m.metadata.text}`)
        .join("\n---\n");
    }
  } catch (err) {
    console.error("❌ Vector Search Error:", err.message);
    // We continue even if retrieval fails, falling back to general knowledge
  }

  // ---------------------------------------------------------
  // 6. BUILD PROMPT & GENERATE
  // ---------------------------------------------------------
  const previousMessages = await Message.find({ chatId }).sort({ createdAt: -1 }).limit(6);
  const historyText = previousMessages
    .reverse()
    .map(msg => `User: ${msg.question}\nAI: ${msg.answer}`)
    .join("\n\n");

  const prompt = `
  You are an expert AI tutor. 

  ${titleContext}

  --- DOCUMENT CONTEXT ---
  ${fileContext || "No specific document data was found for this query."}

  --- CONVERSATION HISTORY ---
  ${historyText}

  --- NEW QUESTION ---
  User: ${question}
   
  INSTRUCTIONS:
  1. Priority: Answer using the "Document Context". Mention specific details from it.
  2. If the "Source Material Information" above is present, use it to identify the book if asked.
  3. If the answer is NOT in the context, use your internal knowledge but state: "Based on general knowledge..."
  4. Keep the tone academic, helpful, and clear.
  `;

  const result = await chatModel.generateContent(prompt);
  const aiResponse = result.response.text();

  const newMessage = await Message.create({ chatId, question, answer: aiResponse });
  await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

  return newMessage;
};

export const updateChatTitleService = async (userId, chatId, title) => {
  const chat = await Chat.findOneAndUpdate(
    { _id: chatId, userId },
    { title },
    { new: true } // Return the updated document
  );
  if (!chat) throw new ApiError(404, "Chat not found");
  return chat;
};