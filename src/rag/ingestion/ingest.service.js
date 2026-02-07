import { OllamaEmbeddings } from "@langchain/ollama";
import { MixedbreadAIEmbeddings } from "@langchain/mixedbread-ai"; // 👈 New Import
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";

export const ingestText = async ({ text, userId, mode, subjectId }) => {
  try {
    console.log("--------------------------------");
    console.log(`🚀 Starting Ingestion (Mixedbread) for: ${subjectId || mode}`);

    // 1. Initialize Pinecone
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const indexName = process.env.PINECONE_INDEX;
    
    // Get Host URL
    const indexDescription = await pc.describeIndex(indexName);
    const host = indexDescription.host; 
    const upsertUrl = `https://${host}/vectors/upsert`;
    
    // 2. Determine Namespace
    const namespace = mode === "custom" 
      ? `global-${subjectId}` 
      : `user_${userId}-${mode}`;

    // 3. Split Text
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.createDocuments([text]);
    console.log(`✂️  Split text into ${chunks.length} chunks.`);

    if (chunks.length === 0) return { success: false, message: "Text empty" };

    // ---------------------------------------------------------
    // 4. SELECT EMBEDDING SOURCE (Hybrid Logic)
    // ---------------------------------------------------------
    let embeddings;
    
    if (process.env.NODE_ENV === "production") {
        // ☁️ CLOUD: Use Mixedbread API
        console.log("🌍 Using Cloud Embeddings (Mixedbread API)");
        embeddings = new MixedbreadAIEmbeddings({
            apiKey: process.env.MXBAI_API_KEY,
            modelName: "mxbai-embed-large-v1", 
        });
    } else {
        // 💻 LOCAL: Use Ollama
        console.log("💻 Using Local Embeddings (Ollama: mxbai-embed-large)");
        embeddings = new OllamaEmbeddings({
            model: "mxbai-embed-large", 
            baseUrl: "http://127.0.0.1:11434",
        });
    }

    // ---------------------------------------------------------
    // 5. Generate & Upload
    // ---------------------------------------------------------
    const vectors = [];
    const EMBEDDING_BATCH_SIZE = 50; 

    console.log(`🧮 Generating Embeddings...`);

    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const chunkBatch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const textBatch = chunkBatch.map(c => c.pageContent.replace(/\n/g, " "));

      try {
        const batchEmbeddings = await embeddings.embedDocuments(textBatch);

        for (let j = 0; j < chunkBatch.length; j++) {
            vectors.push({
                id: `chunk_${Date.now()}_${i + j}`,
                values: batchEmbeddings[j],
                metadata: {
                    text: chunkBatch[j].pageContent,
                    source_mode: mode,
                    subjectId: subjectId || "personal"
                }
            });
        }
        console.log(`   ✨ Processed ${i + chunkBatch.length}/${chunks.length} chunks...`);
      } catch (err) {
        console.error(`❌ Error embedding batch ${i}:`, err.message);
      }
    }

    // 6. Upload to Pinecone (Raw HTTP for speed)
    const UPLOAD_BATCH_SIZE = 50;
    console.log(`⬆️  Uploading ${vectors.length} vectors to Pinecone...`);

    for (let i = 0; i < vectors.length; i += UPLOAD_BATCH_SIZE) {
        const batch = vectors.slice(i, i + UPLOAD_BATCH_SIZE);
        
        const response = await fetch(upsertUrl, {
            method: "POST",
            headers: {
                "Api-Key": process.env.PINECONE_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ vectors: batch, namespace })
        });

        if (!response.ok) throw new Error(`Pinecone Upload Error: ${response.statusText}`);
    }

    console.log("✅ Ingestion Complete!");
    return { success: true, chunks: chunks.length, namespace };

  } catch (error) {
    console.error("❌ Ingestion Failed:", error);
    throw error;
  }
};