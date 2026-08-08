import { Chat } from "../models/chat.models.js";
import { Message } from "../models/message.models.js";
import ApiError from "../utils/ApiError.js";
import { Pinecone } from "@pinecone-database/pinecone";
import { OllamaEmbeddings } from "@langchain/ollama";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
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
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw new ApiError(404, "Chat not found");
  
  await Chat.deleteOne({ _id: chatId });
  await Message.deleteMany({ chatId });
  
  try {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(process.env.PINECONE_INDEX);
    await index.namespace("global-documents").deleteMany({
      filter: { chatId: { $eq: chatId.toString() } }
    });
  } catch (err) {}

  return true;
};

export const askQuestionService = async (userId, chatId, question) => {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) throw new ApiError(404, "Chat session not found");

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(process.env.PINECONE_INDEX);
  
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const chatModel = genAI.getGenerativeModel({ model: modelName });

  let embeddings;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HUGGINGFACEHUB_API_KEY, 
      model: "sentence-transformers/all-MiniLM-L6-v2",
      provider: "hf-inference", 
    });
  } else {
    embeddings = new OllamaEmbeddings({
      model: "all-minilm",
      baseUrl: "http://127.0.0.1:11434",
    });
  }

  const namespace = "global-documents";
  
  const pineconeFilter = { 
    userId: { $eq: userId.toString() },
    chatId: { $eq: chatId.toString() }
  }; 

  let titleContext = "";
  let fileContext = "";
  
  try {
    const queryVector = await embeddings.embedQuery(question);

    const queryOptions = {
      vector: queryVector,
      topK: 5, 
      includeMetadata: true,
      filter: pineconeFilter
    };

    const searchResult = await index.namespace(namespace).query(queryOptions);

    if (searchResult.matches?.length > 0) {
      fileContext = searchResult.matches
        .map((m) => `[Relevance: ${m.score.toFixed(2)}] ${m.metadata.text}`)
        .join("\n---\n");
    }
  } catch (err) {}

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
    { new: true } 
  );
  if (!chat) throw new ApiError(404, "Chat not found");
  return chat;
};