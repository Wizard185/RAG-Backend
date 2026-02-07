import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import crypto from "crypto";

export const ingestText = async ({ text, userId, mode, subjectId }) => {
  console.log(`🚀 Starting Ingestion (HTTP Bypass Mode). Text length: ${text?.length}`);

  // 1. Sanitize & Split
  const sanitizedText = text.replace(/\0/g, "").trim();
  if (!sanitizedText) return { success: false, warning: "Empty text" };

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const docs = await splitter.createDocuments([sanitizedText]);
  if (docs.length === 0) return { success: false, warning: "No chunks" };

  // 2. Initialize Config
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    apiKey: process.env.GEMINI_API_KEY,
  });

  const namespace = mode === "custom" 
    ? `global-${subjectId || "general"}`
    : `user_${userId}-${mode}`;

  // 3. Prepare Vectors
  const vectors = [];
  console.log("🧠 Generating Embeddings...");
  
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    try {
      const vectorValues = await embeddings.embedQuery(doc.pageContent);
      
      vectors.push({
        id: crypto.randomUUID(),
        values: vectorValues, // Raw array from Gemini
        metadata: {
          text: doc.pageContent,
          page: 1,
          source: "file-upload"
        }
      });
      console.log(`   - Chunk ${i+1} prepared.`);
    } catch (err) {
      console.error(`   ❌ Embedding Error:`, err.message);
    }
  }

  if (vectors.length === 0) throw new Error("No vectors generated.");

  // -----------------------------------------------------------
  // ⚡ HTTP BYPASS: IGNORE SDK AND SEND DIRECT REQUEST
  // -----------------------------------------------------------
  console.log("🔍 Fetching Database Host address...");
  const indexDescription = await pinecone.describeIndex(process.env.PINECONE_INDEX);
  const host = indexDescription.host; // e.g., index-name-xyz.svc.pinecone.io

  console.log(`🔗 Connecting to Host: ${host}`);
  console.log(`⬆️ Uploading ${vectors.length} vectors via raw HTTP...`);

  const url = `https://${host}/vectors/upsert`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Api-Key": process.env.PINECONE_API_KEY,
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": "2024-07"
    },
    body: JSON.stringify({
      vectors: vectors,
      namespace: namespace
    })
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error("❌ HTTP Upload Failed:", responseData);
    throw new Error(`Pinecone Error: ${JSON.stringify(responseData)}`);
  }

  console.log(`✅ Success! Upserted Count: ${responseData.upsertedCount}`);
  return { success: true, chunks: responseData.upsertedCount };
};
