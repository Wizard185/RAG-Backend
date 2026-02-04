import mongoose from "mongoose";

const chatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    knowledgeBaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeBase",
      required: true
    },

    question: {
      type: String,
      required: true
    },

    answer: {
      type: String,
      required: true
    },

    mode: {
      type: String,
      enum: ["study", "resume", "docs"],
      required: true
    }
  },
  { timestamps: true }
);

export const ChatHistory = mongoose.model(
  "ChatHistory",
  chatHistorySchema
);
