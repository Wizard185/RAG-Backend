import { OllamaEmbeddings } from "@langchain/ollama";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";

export const ingestText = async ({ text, userId, mode, subjectId }) => {
  try {
    console.log(`🚀 Starting Strict Ingestion: ${subjectId || mode}`);

    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index(process.env.PINECONE_INDEX);
    const indexDescription = await pc.describeIndex(process.env.PINECONE_INDEX);
    const upsertUrl = `https://${indexDescription.host}/vectors/upsert`;
    
    // ---------------------------------------------------------
    // 1. DETERMINE NAMESPACE
    // ---------------------------------------------------------
    let namespace;
    let uniqueIdPrefix; 
    const timestamp = Date.now();

    if (mode === "resume") {
        namespace = "global-resumes";
        uniqueIdPrefix = `resume_${userId}_${timestamp}`; 
    } else if (mode === "custom") {
        namespace = `global-${subjectId || "general"}`;
        uniqueIdPrefix = `${subjectId}_${timestamp}`;
    } else {
        namespace = `global-${mode}`;
        uniqueIdPrefix = `${mode}_${userId}_${timestamp}`;
    }

    // =========================================================
    // 🧹 STRICT CLEANUP (FIXED SYNTAX)
    // =========================================================
    // If uploading a resume, DELETE the user's existing data first.
    if (mode === "resume" && userId) {
        console.log(`🗑️  Wiping old resume data for user: ${userId}...`);
        try {
            // ✅ THE FIX: Wrap the condition inside a 'filter' property
            await index.namespace(namespace).deleteMany({
                filter: { userId: { $eq: userId } } 
            });
            console.log("✅ Database wiped. Previous resume is gone.");
        } catch (err) {
            console.warn("⚠️ Cleanup warning (ignore if first upload):", err.message);
        }
    }
    // =========================================================

    // 2. SANITIZE TEXT
    const cleanText = text.replace(/\s+/g, " ").trim();
    
    // 3. SPLIT TEXT
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 300,       
      chunkOverlap: 30,      
      separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    });
    const chunks = await splitter.createDocuments([cleanText]);
    
    // 4. EMBEDDINGS SETUP
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

    // 5. BATCH UPLOAD
    const BATCH_SIZE = 20;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const chunkBatch = chunks.slice(i, i + BATCH_SIZE);
      const textBatch = chunkBatch.map(c => c.pageContent);

      try {
        const batchEmbeddings = await embeddings.embedDocuments(textBatch);

        const vectors = chunkBatch.map((chunk, j) => ({
          id: `${uniqueIdPrefix}_chunk_${i + j}`, 
          values: batchEmbeddings[j],
          metadata: {
            text: chunk.pageContent,
            userId: userId, 
            source_mode: mode,
            subjectId: subjectId || "personal" 
          }
        }));

        await fetch(upsertUrl, {
          method: "POST",
          headers: {
            "Api-Key": process.env.PINECONE_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ vectors, namespace })
        });

      } catch (err) {
        console.error(`⚠️ Batch ${i} failed.`, err);
      }
    }

    return { success: true, chunks: chunks.length, namespace };

  } catch (error) {
    console.error("❌ Ingestion Failed:", error);
    throw error;
  }
};