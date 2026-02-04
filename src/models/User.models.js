import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    authProvider: {
      type: String,
      enum: ["google", "github", "local"],
      required: true
    },

    oauthId: {
      type: String,
      default: null
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    password: {
      type: String,
      select: false, // IMPORTANT
      default: null
    },

    avatar: {
      type: String
    }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
