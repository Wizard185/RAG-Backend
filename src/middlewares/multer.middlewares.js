import multer from "multer";
import fs from "fs";

// 1. Define the upload directory
const uploadDir = "./public/temp";

// 2. Automatically create the directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`📂 Created upload directory at: ${uploadDir}`);
}

// 3. Configure where and how to save files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // We keep the original name so we can read it easily later
    cb(null, file.originalname);
  },
});

// 4. Export the middleware
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 150 * 1024 * 1024, // Limit: 50 MB
  },
});