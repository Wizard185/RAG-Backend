import { ChatOllama } from "@langchain/ollama";

export const generateWithOllama = async (prompt) => {
  const llm = new ChatOllama({
    baseUrl: "http://localhost:11434",
    model: "mistral", // or "llama3"
    temperature: 0.2
  });

  const response = await llm.invoke(prompt);
  return response.content;
};
