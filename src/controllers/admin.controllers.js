import fs from "fs";
import { createRequire } from "module";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { ingestText } from "../rag/ingestion/ingest.service.js";

// Safe PDF Parser Import
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export const uploadGlobalTextbook = asyncHandler(async (req, res) => {
  // 1. Validation
  const { subjectId } = req.body;
  
  if (!req.file) throw new ApiError(400, "PDF file is required");
  if (!subjectId) throw new ApiError(400, "Subject ID is required (e.g. 'physics_101')");

  console.log(`🌍 Starting Global Upload for: ${subjectId}`);
  const filePath = req.file.path;

  try {
    // 2. Extract Text (This is fast, so we await it)
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;

    if (!text || text.length < 100) {
      throw new ApiError(400, "PDF appears empty or unreadable.");
    }

    // 3. Cleanup File (Safe to delete now because 'text' is in memory)
    fs.unlinkSync(filePath);

    // 4. Start Background Ingestion (DO NOT AWAIT)
    // We start the heavy lifting here but don't make Postman wait for it
    ingestText({
      text: text,
      userId: null, 
      mode: "custom", 
      subjectId: subjectId
    })
    .then((result) => {
      console.log(`✅ [Background] Success: ${subjectId} finished uploading!`);
      console.log(`📊 [Background] Vectors created: ${result.length}`);
    })
    .catch((err) => {
      console.error(`❌ [Background] Error: Upload for ${subjectId} failed!`, err);
    });

    // 5. Respond Immediately
    // 202 Accepted = "Request received, processing in background"
    return res.status(202).json(
      new ApiResponse(202, { status: "Processing started" }, "Textbook is uploading in the background. Check server terminal for completion.")
    );

  } catch (error) {
    // Only happens if PDF parsing fails (very rare)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw new ApiError(500, error.message || "Global upload failed");
  }
});