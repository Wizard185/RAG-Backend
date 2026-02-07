import { Router } from "express";
import { protect } from "../middlewares/auth.middlewares.js"; // Ensure this path is correct for your project
import {
  createChat,
  getChats,
  getChat,
  deleteChat,
  askQuestion // <--- IMPORT THE CONTROLLER, NOT THE SERVICE
} from "../controllers/chats.controllers.js";
import { validate } from "../middlewares/validate.middlewares.js";
import { askQuestionSchema } from "../validators/chats.validators.js";

const router = Router();

// Create a new chat session (e.g., { "mode": "resume" })
router.post("/", protect, createChat);

// Get all chats for a user (Optional query: ?mode=resume)
router.get("/", protect, getChats);

// Get a specific chat and its messages
router.get("/:chatId", protect, getChat);

// Delete a chat session
router.delete("/:chatId", protect, deleteChat);

// Ask a question in a specific chat
router.post(
  "/:chatId/question",
  protect,
  validate(askQuestionSchema),
  askQuestion // <--- USE THE CONTROLLER HERE
);

export default router;