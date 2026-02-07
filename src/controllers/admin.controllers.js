import fs from "fs/promises";
import { createRequire } from "module";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { ingestText } from "../rag/ingestion/ingest.service.js";

// Load PDF Library
const require = createRequire(import.meta.url);
const pdfLib = require("pdf-parse");

export const uploadGlobalTextbook = asyncHandler(async (req, res) => {
  const { subjectId } = req.body;
  
  if (!req.file) throw new ApiError(400, "No textbook file uploaded");
  if (!subjectId) throw new ApiError(400, "Subject ID (e.g., 'physics101') is required");

  console.log(`📚 ADMIN UPLOAD: Processing ${req.file.originalname} for Subject: ${subjectId}`);

  let rawText = "";
  try {
    // 1. Extract Text (PDF Support Only for now)
    if (req.file.mimetype === "application/pdf") {
        const dataBuffer = await fs.readFile(req.file.path);
        
        // Use the robust parser logic we built earlier
        let parser = typeof pdfLib === 'function' ? pdfLib : pdfLib.default || pdfLib.PDFParse;
        const data = await parser(dataBuffer);
        rawText = data.text;
    } else {
        throw new ApiError(400, "Only PDF textbooks are supported currently.");
    }

    if (!rawText.trim()) throw new ApiError(400, "Textbook appears empty.");

    // 2. Ingest into GLOBAL Namespace
    // We force mode="custom" so it goes to 'global-{subjectId}'
    const result = await ingestText({
      text: rawText,
      userId: req.user._id, // Log who uploaded it
      mode: "custom",       // <--- FORCES GLOBAL NAMESPACE
      subjectId: subjectId  // <--- DEFINES THE SHARED ROOM
    });

    // 3. Cleanup
    await fs.unlink(req.file.path);

    res.status(200).json(
      new ApiResponse(200, result, `Textbook uploaded to Global Space: ${subjectId}`)
    );

  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    throw new ApiError(500, "Textbook processing failed: " + error.message);
  }
});