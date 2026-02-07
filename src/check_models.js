import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY is missing from .env");
  process.exit(1);
}

// Check directly against the API to see what is enabled
async function listAvailableModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("❌ API Error:", data.error.message);
      return;
    }

    console.log("\n✅ THESE ARE THE EXACT MODEL NAMES YOU CAN USE:");
    console.log("------------------------------------------------");
    
    const validModels = data.models
      .filter(m => m.supportedGenerationMethods.includes("generateContent"))
      .map(m => m.name.replace("models/", "")); // Removes the prefix so you get the clean name

    validModels.forEach(name => console.log(`"${name}"`));
    
    console.log("------------------------------------------------");
    console.log("👉 Pick one of the names above and paste it into your chats.services.js");

  } catch (error) {
    console.error("❌ Network Error:", error.message);
  }
}

listAvailableModels();