import { Router } from "express";
import { protect } from "../middlewares/auth.middlewares.js";
import {
  createChat,
  getChats,
  getChat,
  deleteChat
} from "../controllers/chats.controllers.js";
import { validate } from "../middlewares/validate.middlewares.js";
import { askQuestionSchema } from "../validators/chats.validators.js";
import { askQuestion } from "../controllers/chats.controllers.js";



const router = Router();

router.post("/", protect, createChat);
router.get("/", protect, getChats);
router.get("/:chatId", protect, getChat);
router.delete("/:chatId", protect, deleteChat);
router.post(
  "/:chatId/question",
  protect,
  validate(askQuestionSchema),
  askQuestion
);

export default router;
