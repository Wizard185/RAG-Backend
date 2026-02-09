import { z } from "zod";


export const askQuestionSchema = z.object({
  question: z
    .string()
    .min(3, "Question must be at least 3 characters long")
});

// ✅ NEW: Schema for updating title
export const updateChatTitleSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(50, "Title is too long")
});