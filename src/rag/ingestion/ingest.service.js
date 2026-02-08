import { OllamaEmbeddings } from "@langchain/ollama";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";

export const ingestText = async ({ text, userId, mode, subjectId }) => {
  try {
    console.log("--------------------------------");
    console.log(`🚀 Starting Free Hybrid Ingestion: ${subjectId || mode}`);

    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const indexName = process.env.PINECONE_INDEX;
    const indexDescription = await pc.describeIndex(indexName);
    const upsertUrl = `https://${indexDescription.host}/vectors/upsert`;
    
    // ---------------------------------------------------------
    // 1. DETERMINE NAMESPACE (SaaS Scalability Fix)
    // ---------------------------------------------------------
    let namespace;
    let uniqueIdPrefix; // To ensure IDs don't clash in shared namespaces

    if (mode === "resume") {
        // 🌍 ALL resumes go here. Scalable for 1000+ users.
        namespace = "global-resumes";
        // ID format: resume_USER123_chunk_0
        uniqueIdPrefix = `resume_${userId}`; 
    } else if (mode === "custom") {
        namespace = `global-${subjectId || "general"}`;
        // ID format: machine_learning_chunk_0
        uniqueIdPrefix = subjectId || "general";
    } else {
        namespace = `global-${mode}`;
        uniqueIdPrefix = `${mode}_${userId}`;
    }

    // 2. SANITIZE TEXT
    const cleanText = text.replace(/\s+/g, " ").trim();
    console.log(`🧹 Sanitized: ${text.length} chars -> ${cleanText.length} chars.`);

    // 3. SMART SPLITTING (Ultra-Safe Mode for all-minilm)
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 300,       // 👈 Keeps it safe for 256-token limit
      chunkOverlap: 30,     
      separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    });
    const chunks = await splitter.createDocuments([cleanText]);
    console.log(`✂️  Split into ${chunks.length} dense chunks.`);

    // 4. INITIALIZE EMBEDDINGS
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

    // 5. GENERATE & UPLOAD
    // Reset to 0 since we are using a new namespace strategy (or set to 200 if resuming)
    const START_FROM = 0; 
    const BATCH_SIZE = isProd ? 10 : 20;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      if (i < START_FROM) continue;

      const chunkBatch = chunks.slice(i, i + BATCH_SIZE);
      const textBatch = chunkBatch.map(c => c.pageContent);

      console.log(`📡 Processing Batch ${i} to ${i + chunkBatch.length}...`);

      try {
        const batchEmbeddings = await embeddings.embedDocuments(textBatch);

        // ---------------------------------------------------------
        // 6. MAP VECTORS (With Metadata & Unique IDs)
        // ---------------------------------------------------------
        const vectors = chunkBatch.map((chunk, j) => ({
          // ID includes prefix so User A doesn't overwrite User B
          id: `${uniqueIdPrefix}_chunk_${i + j}`, 
          values: batchEmbeddings[j],
          metadata: {
            text: chunk.pageContent,
            userId: userId, // 👈 CRITICAL: Used for filtering later
            source_mode: mode,
            subjectId: subjectId || "personal" 
          }
        }));

        const response = await fetch(upsertUrl, {
          method: "POST",
          headers: {
            "Api-Key": process.env.PINECONE_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ vectors, namespace })
        });

        if (!response.ok) throw new Error(`Pinecone Upsert Failed: ${response.statusText}`);

        console.log(`✨ Progress: ${i + chunkBatch.length} / ${chunks.length}`);

        if (isProd) await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.error(`⚠️ Batch ${i} failed. Retrying chunks one-by-one...`);
        
        // FAIL-SAFE: Process one by one
        for (let j = 0; j < chunkBatch.length; j++) {
            try {
                const singleText = chunkBatch[j].pageContent;
                const singleEmbedding = await embeddings.embedQuery(singleText);

                const singleVector = [{
                    id: `${uniqueIdPrefix}_chunk_${i + j}`,
                    values: singleEmbedding,
                    metadata: {
                        text: singleText,
                        userId: userId, // 👈 Don't forget metadata in fallback!
                        source_mode: mode,
                        subjectId: subjectId || "personal"
                    }
                }];

                await fetch(upsertUrl, {
                    method: "POST",
                    headers: { "Api-Key": process.env.PINECONE_API_KEY, "Content-Type": "application/json" },
                    body: JSON.stringify({ vectors: singleVector, namespace })
                });
            } catch (innerErr) {
                console.error(`🚨 SKIPPING BAD CHUNK (Index ${i+j}): Too long or complex.`);
            }
        }
      }
    }

    return { success: true, chunks: chunks.length, namespace };

  } catch (error) {
    console.error("❌ Ingestion Failed:", error);
    throw error;
  }
};