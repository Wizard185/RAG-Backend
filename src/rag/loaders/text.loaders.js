import fs from "fs/promises";

export const loadTextFile = async (filePath) => {
  return fs.readFile(filePath, "utf-8");
};
