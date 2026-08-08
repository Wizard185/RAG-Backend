import { OllamaEmbeddings } from "@langchain/ollama";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";

export const ingestText = async ({ text, userId, mode, subjectId, chatId }) => {
  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index(process.env.PINECONE_INDEX);
    const indexDescription = await pc.describeIndex(process.env.PINECONE_INDEX);
    const upsertUrl = `https://${indexDescription.host}/vectors/upsert`;
    
    const namespace = "global-documents";
    const timestamp = Date.now();
    const uniqueIdPrefix = `${chatId || mode}_${userId}_${timestamp}`;

    if (chatId && userId) {
        try {
            await index.namespace(namespace).deleteMany({
                filter: { chatId: { $eq: chatId.toString() } } 
            });
        } catch (err) {}
    }

    const cleanText = text.replace(/\s+/g, " ").trim();
    
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 300,       
      chunkOverlap: 30,      
      separators: ["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    });
    const chunks = await splitter.createDocuments([cleanText]);
    
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
            userId: userId.toString(), 
            source_mode: mode,
            subjectId: subjectId || "personal",
            chatId: chatId ? chatId.toString() : "none"
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
      } catch (err) {}
    }

    return { success: true, chunks: chunks.length, namespace };
  } catch (error) {
    throw error;
  }
};