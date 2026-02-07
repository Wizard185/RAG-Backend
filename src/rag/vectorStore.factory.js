import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const getNamespace = ({ mode, userId, subjectId }) => {
  if (mode === "custom") {
    return `global-${subjectId || "general"}`;
  }
  return `user_${userId}-${mode}`;
};

export const getVectorStore = async ({ userId, mode, subjectId }) => {
  console.log("🔌 Connecting to Vector Store using model: gemini-embedding-001");

  // ✅ FIX: Use the EXACT model name found in your check-key.js
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001", // <--- THIS MATCHES YOUR API KEY
    apiKey: process.env.GEMINI_API_KEY,
    // We remove 'taskType' because this older model doesn't support/need it
  });

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);
  const namespace = getNamespace({ mode, userId, subjectId });

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: namespace
  });

  return vectorStore;
};