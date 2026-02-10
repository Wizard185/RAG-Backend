import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";
import { connectMongo } from "./db/mongo.js";



const PORT = process.env.PORT || 5000;
const startServer = async () => {
  await connectMongo();

  // ✅ Pass "0.0.0.0" as the second argument to ensure external accessibility
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT} (bound to 0.0.0.0)`);
  });

  // 2. INCREASE TIMEOUTS
  const TIMEOUT = 600000; 
  
  server.setTimeout(TIMEOUT);
  server.keepAliveTimeout = TIMEOUT;
  server.headersTimeout = TIMEOUT;
};
startServer();