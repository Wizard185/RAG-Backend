import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export const chunkText = async (text) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 400,
    chunkOverlap: 100
  });

  return splitter.createDocuments([text]);
};
