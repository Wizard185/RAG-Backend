import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";
import { connectMongo } from "./db/mongo.js";

// 1. CONNECT DATABASE OUTSIDE THE LISTENER
// This ensures the database connects when the serverless function spins up
connectMongo()
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// 2. LOCAL DEVELOPMENT ONLY
// Vercel will ignore this block because NODE_ENV will be "production"
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running locally on port ${PORT} (bound to 0.0.0.0)`);
  });

  // Local timeouts (Vercel ignores these)
  const TIMEOUT = 600000; 
  server.setTimeout(TIMEOUT);
  server.keepAliveTimeout = TIMEOUT;
  server.headersTimeout = TIMEOUT;
}

// 3. CRITICAL FOR VERCEL: EXPORT THE APP
// Vercel's build system looks for this export to route HTTP traffic
export default app;
