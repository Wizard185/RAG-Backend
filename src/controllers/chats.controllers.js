import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  createChatService,
  getChatsByModeService,
  getChatWithMessagesService,
  deleteChatService
} from "../services/chats.services.js";
import { askQuestionService } from "../services/chats.services.js";
export const createChat = asyncHandler(async (req, res) => {
  const { mode } = req.body;

  const chat = await createChatService(req.user._id, mode);

  res.status(201).json(
    new ApiResponse(201, chat, "Chat created")
  );
});

export const getChats = asyncHandler(async (req, res) => {
  const { mode } = req.query;

  const chats = await getChatsByModeService(req.user._id, mode);

  res.status(200).json(
    new ApiResponse(200, chats, "Chats fetched")
  );
});

export const getChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  const data = await getChatWithMessagesService(
    req.user._id,
    chatId
  );

  res.status(200).json(
    new ApiResponse(200, data, "Chat fetched")
  );
});

export const deleteChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  await deleteChatService(req.user._id, chatId);

  res.status(200).json(
    new ApiResponse(200, null, "Chat deleted")
  );
});

export const askQuestion = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { question } = req.body;

  const message = await askQuestionService(
    req.user._id,
    chatId,
    question
  );

  res.status(201).json(
    new ApiResponse(201, message, "Answer generated")
  );
});
