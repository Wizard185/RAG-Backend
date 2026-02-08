import { Router } from "express";
import { upload } from "../middlewares/multer.middlewares.js";
import { uploadGlobalTextbook } from "../controllers/admin.controllers.js";

const router = Router();

// Endpoint: POST /api/v1/admin/upload-textbook
// Note: In a real app, you would add an 'isAdmin' middleware here
router.route("/upload-textbook").post(
    upload.single("file"), 
    uploadGlobalTextbook
);

export default router;