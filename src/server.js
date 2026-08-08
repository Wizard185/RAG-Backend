import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";
import { connectMongo } from "./db/mongo.js";

// 1. Connect to Database
connectMongo()
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// 2. Open Port for Render
const PORT = process.env.PORT || 10000;

// Listen on 0.0.0.0 as long as we aren't in Vercel's serverless environment
if (!process.env.VERCEL) {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  const TIMEOUT = 600000; 
  server.setTimeout(TIMEOUT);
  server.keepAliveTimeout = TIMEOUT;
  server.headersTimeout = TIMEOUT;
}

// 3. Export app for Vercel compatibility
export default app;