import { retrieveRelevantChunks } from "./retrieval/retrieve.service.js";
import { generateWithOllama } from "../ai/providers/ollama.providers.js";

export const runLocalRAG = async ({
  question,
  userId,
  mode
}) => {
  const context = await retrieveRelevantChunks({
    question,
    userId,
    mode
  });

  if (!context || context.trim().length === 0) {
    return "I could not find relevant information in the documents.";
  }

  const prompt = `
You are an assistant answering questions using the provided context.

Context:
${context}

Question:
${question}

Answer clearly and concisely.
`;

  const answer = await generateWithOllama(prompt);
  return answer;
};
