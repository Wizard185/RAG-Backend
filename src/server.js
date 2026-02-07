import dotenv from "dotenv";
dotenv.config();
import app from "./app.js";
import { connectMongo } from "./db/mongo.js";



const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectMongo();

  // 1. Capture the server instance into a variable
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });

  // 2. INCREASE TIMEOUTS (Crucial for large AI ingestion)
  // Default is 2 minutes. We set it to 10 minutes (600,000 ms)
  // so the connection doesn't close while parsing a huge PDF.
  const TIMEOUT = 600000; 
  
  server.setTimeout(TIMEOUT);
  server.keepAliveTimeout = TIMEOUT;
  server.headersTimeout = TIMEOUT;
};

startServer();