import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

async function checkKey() {
  console.log("🔑 Testing API Key...");

  if (!API_KEY) {
    console.error("❌ No API Key found in .env");
    return;
  }

  // 1. List Models directly via HTTP
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("\n❌ API KEY ERROR:");
      console.error(`   Code: ${data.error.code}`);
      console.error(`   Message: ${data.error.message}`);
      return;
    }

    console.log("\n✅ API Connection Successful! Here are your available models:");
    console.log("-----------------------------------------------------------");
    
    const embeddingModels = data.models.filter(m => m.name.includes("embedding"));
    
    if (embeddingModels.length === 0) {
      console.log("⚠️  NO EMBEDDING MODELS FOUND.");
      console.log("   (You might need to enable 'Generative Language API' in Google Cloud Console)");
    } else {
      embeddingModels.forEach(m => console.log(`🌟 ${m.name}`));
    }

  } catch (error) {
    console.error("❌ Network Error:", error.message);
  }
}

checkKey();