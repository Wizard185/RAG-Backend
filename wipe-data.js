import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
dotenv.config();

const wipeAllResumes = async () => {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index(process.env.PINECONE_INDEX);

    try {
        console.log("⚠️  DELETING ALL DATA in 'global-resumes'...");
        
        // deleteOneNamespace removes everything in that specific namespace
        await index.namespace("global-resumes").deleteAll();
        
        console.log("✅ Success: 'global-resumes' is now empty.");
    } catch (error) {
        console.error("❌ Failed to wipe namespace:", error);
    }
};

wipeAllResumes();