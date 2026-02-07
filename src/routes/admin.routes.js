import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { verifyAdmin } from "../middlewares/admin.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { uploadGlobalTextbook } from "../controllers/admin.controllers.js";

const router = Router();

// Secure Chain: 1. Must be Logged In -> 2. Must be Admin -> 3. Upload Middleware
router.post(
  "/upload-textbook",
  verifyJWT,
  verifyAdmin,
  upload.single("file"),
  uploadGlobalTextbook
);

export default router;