import { z } from "zod";

export const askQuestionSchema = z.object({
  question: z
    .string()
    .min(3, "Question must be at least 3 characters long")
});
