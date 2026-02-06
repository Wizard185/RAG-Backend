import { getVectorStore } from "../ingestion/ingest.service.js";

export const retrieveRelevantChunks = async ({ question, k = 4 }) => {
  const store = getVectorStore();
  const results = await store.similaritySearch(question, k);
  return results.map(d => d.pageContent).join("\n\n");
};
