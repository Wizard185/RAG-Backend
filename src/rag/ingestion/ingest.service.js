import fs from "fs/promises";
import path from "path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/community/vectorstores/memory";
import { OllamaEmbeddings } from "@langchain/ollama";

let vectorStore = null;

export const ingestTextFile = async ({ filePath }) => {
  const text = await fs.readFile(path.resolve(filePath), "utf-8");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 400,
    chunkOverlap: 100
  });

  const docs = await splitter.createDocuments([text]);

  const embeddings = new OllamaEmbeddings({
    baseUrl: "http://localhost:11434",
    model: "nomic-embed-text"
  });

  vectorStore = await MemoryVectorStore.fromDocuments(
    docs,
    embeddings
  );

  return {
    success: true,
    chunks: docs.length
  };
};

export const getVectorStore = () => {
  if (!vectorStore) {
    throw new Error("Vector store not initialized. Run ingestion first.");
  }
  return vectorStore;
};
