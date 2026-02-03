import dotenv from "dotenv";
import app from "./app.js";
import { connectMongo } from "./db/mongo.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectMongo();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();
