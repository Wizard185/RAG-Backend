import { Router } from "express";
import multer from "multer";
import { protect } from "../middlewares/auth.middlewares.js";
import { uploadDocument } from "../controllers/upload.controllers.js";

const router = Router();

// 📂 Multer Config: Save files temporarily to a local 'uploads' folder
const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 } // Limit to 5MB
});

// POST /api/upload
// 1. Checks Auth (protect)
// 2. Handles File (upload.single)
// 3. Runs Logic (uploadDocument)
router.post(
  "/", 
  protect, 
  upload.single("file"), 
  uploadDocument
);

export default router;