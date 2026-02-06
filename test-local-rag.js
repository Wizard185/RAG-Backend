import "dotenv/config";
import { runLocalRAG } from "./src/rag/rag.local.pipeline.js";

const answer = await runLocalRAG({
  question: "What is binary search?",
  userId: "test-user-123",
  mode: "qa"
});

console.log("\nANSWER:\n", answer);
