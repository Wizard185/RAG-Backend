import { ingestTextFile } from "./src/rag/ingestion/ingest.service.js";

const res = await ingestTextFile({
  filePath: "./docs/qa/test.txt",
  userId: "test-user-123",
  mode: "qa"
});

console.log(res);
