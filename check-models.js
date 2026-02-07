import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const checkModels = async () => {
  console.log("🔑 API Key Status:", process.env.GEMINI_API_KEY ? "Present" : "MISSING");
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ Error: No API Key found in .env file");
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  try {
    // This lists every model your API key has access to
    const models = await genAI.getGenerativeModel().listModels();
    
    console.log("\n📋 AVAILABLE MODELS FOR YOU:");
    console.log("-----------------------------");
    
    let foundEmbedding = false;

    // We only care about models that support 'embedContent'
    for await (const model of models) {
      if (model.supportedGenerationMethods.includes("embedContent")) {
        console.log(`✅ ${model.name}`);
        foundEmbedding = true;
      }
    }

    if (!foundEmbedding) {
      console.log("\n❌ NO EMBEDDING MODELS FOUND.");
      console.log("👉 Cause: Your API Key might be restricted or the 'Generative Language API' is not enabled in Google Cloud Console.");
    }

  } catch (error) {
    console.error("\n❌ API ERROR:", error.message);
  }
};

checkModels();