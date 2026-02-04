import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    knowledgeBaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KnowledgeBase",
      required: true
    },

    filename: {
      type: String,
      required: true
    },

    fileType: {
      type: String, // pdf, docx, txt
      required: true
    },

    ingestionStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending"
    }
  },
  { timestamps: true }
);

export const Document = mongoose.model("Document", documentSchema);
