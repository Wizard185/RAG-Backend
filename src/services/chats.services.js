import ApiError from "../utils/ApiError.js";
import { Chat } from "../models/chat.models.js";
import { Message } from "../models/message.models.js";

export const createChatService = async (userId, mode) => {
  return Chat.create({ userId, mode });
};

export const getChatsByModeService = async (userId, mode) => {
  const filter = { userId };
  if (mode) filter.mode = mode;

  return Chat.find(filter).sort({ updatedAt: -1 });
};

export const getChatWithMessagesService = async (userId, chatId) => {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) {
    throw new ApiError(404, "Chat not found");
  }

  const messages = await Message.find({ chatId }).sort({ createdAt: 1 });
  return { chat, messages };
};

export const deleteChatService = async (userId, chatId) => {
  const chat = await Chat.findOneAndDelete({ _id: chatId, userId });
  if (!chat) {
    throw new ApiError(404, "Chat not found");
  }

  await Message.deleteMany({ chatId });
};

export const saveMessageService = async (chatId, question, answer) => {
  const count = await Message.countDocuments({ chatId });

  if (count === 0) {
    const title = question.split(" ").slice(0, 6).join(" ");
    await Chat.findByIdAndUpdate(chatId, { title });
  }

  return Message.create({ chatId, question, answer });
};

export const askQuestionService = async (userId, chatId, question) => {
  // Ensure chat exists & belongs to user
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) {
    throw new ApiError(404, "Chat not found");
  }

  // 🔹 MOCK ANSWER (replace with RAG later)
  const answer = `Mock answer for: "${question}"`;

  // Auto-title on first question
  const count = await Message.countDocuments({ chatId });
  if (count === 0) {
    const title = question.split(" ").slice(0, 6).join(" ");
    await Chat.findByIdAndUpdate(chatId, { title });
  }

  // Save Q&A
  const message = await Message.create({
    chatId,
    question,
    answer
  });

  // Touch chat updatedAt (for sorting)
  await Chat.findByIdAndUpdate(chatId, { updatedAt: new Date() });

  return message;
};
