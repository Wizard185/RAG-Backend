import fs from "fs/promises";
import mammoth from "mammoth";
import { createRequire } from "module"; 
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { ingestText } from "../rag/ingestion/ingest.service.js";

// 1. Safe Load (Standard Method)
const require = createRequire(import.meta.url);
let pdfParse;

try {
  pdfParse = require("pdf-parse");
} catch (e) {
  console.error("⚠️ Library Load Warning:", e.message);
}

export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const { mode, subjectId } = req.body;
  const filePath = req.file.path;
  const mimeType = req.file.mimetype;

  try {
    let rawText = "";
    console.log(`📂 Processing: ${req.file.originalname}`);

    // --- PDF HANDLING ---
    if (mimeType === "application/pdf") {
      const dataBuffer = await fs.readFile(filePath);

      // Sanity Check
      if (typeof pdfParse !== 'function') {
         // Fallback for weird ESM edge cases
         if (pdfParse.default && typeof pdfParse.default === 'function') {
            pdfParse = pdfParse.default;
         } else {
            throw new Error("PDF Library corrupted. Please run: npm install pdf-parse@1.1.1 --save-exact");
         }
      }

      // Standard Execution
      const data = await pdfParse(dataBuffer);
      rawText = data.text;
    } 
    // --- WORD (.docx) HANDLING ---
    else if (req.file.originalname.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ path: filePath });
      rawText = result.value;
    } 
    // --- TEXT HANDLING ---
    else {
      rawText = await fs.readFile(filePath, "utf-8");
    }

    if (!rawText || !rawText.trim()) throw new ApiError(400, "File is empty or scanned.");

    console.log(`✅ Extracted ${rawText.length} characters.`);

    const result = await ingestText({
      text: rawText,
      userId: req.user._id,
      mode: mode || "resume",
      subjectId
    });

    await fs.unlink(filePath);
    res.status(200).json(new ApiResponse(200, result, "Success"));

  } catch (error) {
    console.error("❌ Upload Failed:", error);
    try { await fs.unlink(filePath); } catch (e) {} 
    throw new ApiError(500, error.message || "File upload failed");
  }
});