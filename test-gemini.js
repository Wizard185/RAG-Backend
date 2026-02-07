import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const runTest = async () => {
  console.log("🔑 Checking API Key:", process.env.GEMINI_API_KEY ? "Found" : "MISSING");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // ✅ CORRECT MODEL: This is the modern standard for embeddings
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  try {
    const text = "Hello world";
    console.log(`📡 Sending text: "${text}" to Google (Model: text-embedding-004)...`);

    const result = await model.embedContent(text);
    const vector = result.embedding.values;

    console.log("\n✅ RESULTS:");
    console.log(`📏 Vector Length: ${vector.length}`);

    if (vector.length === 768) {
      console.log("\n🎉 SUCCESS! API Key is good.");
    } else {
      console.log("\n❌ FAILURE. Vector is empty.");
    }

  } catch (error) {
    console.error("\n❌ CRITICAL ERROR:", error.message);
  }
};

runTest();