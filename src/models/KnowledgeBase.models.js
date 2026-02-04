import mongoose from "mongoose";

const knowledgeBaseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String
    },

    type: {
      type: String,
      enum: ["preloaded", "runtime", "temporary"],
      required: true
    },

    category: {
      type: String, // subject, resume, company-docs
      required: true
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    status: {
      type: String,
      enum: ["processing", "ready", "failed"],
      default: "processing"
    }
  },
  { timestamps: true }
);

export const KnowledgeBase = mongoose.model(
  "KnowledgeBase",
  knowledgeBaseSchema
);
