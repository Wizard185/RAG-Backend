import dotenv from 'dotenv';
dotenv.config();

import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { Pinecone } from "@pinecone-database/pinecone";

async function testCloudConnection() {
    try {
        console.log("☁️  Testing Hugging Face Cloud Connection...");
        
        // 1. Initialize HF Cloud Embeddings
        const embeddings = new HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HUGGINGFACEHUB_API_KEY,
            model: "sentence-transformers/all-MiniLM-L6-v2",
        });

        // 2. Generate a test vector
        const testText = "What is in my resume?";
        const vector = await embeddings.embedQuery(testText);
        
        console.log(`✅ Cloud Embedding Generated! Vector Length: ${vector.length}`);

        if (vector.length !== 384) {
            throw new Error(`Dimension mismatch! Expected 384, got ${vector.length}`);
        }

        // 3. Test Pinecone Retrieval
        console.log("🌲 Querying Pinecone with Cloud Vector...");
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        const index = pc.index(process.env.PINECONE_INDEX);
        
        // Use a namespace you know has data (e.g., 'user_ID-resume')
        const results = await index.namespace("REPLACE_WITH_YOUR_NAMESPACE").query({
            vector: vector,
            topK: 1,
            includeMetadata: true,
        });

        if (results.matches.length > 0) {
            console.log("🎯 SUCCESS! Cloud retrieval working.");
            console.log("Top Match:", results.matches[0].metadata.text.substring(0, 100));
        } else {
            console.log("⚠️  Connection works, but no matches found in this namespace.");
        }

    } catch (error) {
        console.error("❌ Cloud Test Failed:", error.message);
    }
}

testCloudConnection();