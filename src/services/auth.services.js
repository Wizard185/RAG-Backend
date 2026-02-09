import { OAuth2Client } from "google-auth-library";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/User.models.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";

/* GOOGLE OAUTH CLIENT */
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * GOOGLE OAUTH AUTHENTICATION
 * Fix: Finds user by EMAIL first to link accounts instead of creating duplicates.
 */
export const googleAuthService = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new ApiError(401, "Invalid Google token");
  }

  const {
    sub: googleId,
    email,
    name,
    picture
  } = payload;

  // ✅ FIX 1: Find by EMAIL instead of just googleId/authProvider
  let user = await User.findOne({ email });

  if (user) {
    // User exists! Link Google info to this account if missing
    if (!user.oauthId) {
      user.oauthId = googleId;
    }
    // Update avatar to latest from Google
    user.avatar = picture;
    await user.save();
  } else {
    // No user found, create new Google user
    user = await User.create({
      authProvider: "google",
      oauthId: googleId,
      email,
      name,
      avatar: picture
    });
  }

  const token = generateToken({ userId: user._id });

  return { user, token };
};

/**
 * EMAIL + PASSWORD SIGNUP
 */
export const signupService = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new ApiError(400, "Email already registered");
  }

  const hashedPassword = await hashPassword(password);

  const user = await User.create({
    authProvider: "local",
    name,
    email,
    password: hashedPassword
  });

  const token = generateToken({ userId: user._id });

  return { user, token };
};

/**
 * EMAIL + PASSWORD LOGIN
 * Fix: Allows login even if authProvider was originally "google" (as long as password exists).
 */
export const loginService = async ({ email, password }) => {
  // ✅ FIX 2: Removed { authProvider: "local" } restriction
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  // ✅ FIX 3: Check if password exists (Google users might not have one)
  if (!user.password) {
    throw new ApiError(400, "Please login with Google (no password set)");
  }

  const isMatch = await comparePassword(password, user.password);

  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = generateToken({ userId: user._id });

  return { user, token };
};
export const setPasswordService = async (userId, newPassword) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const hashedPassword = await hashPassword(newPassword);
  
  user.password = hashedPassword;
  await user.save();

  return { message: "Password set successfully" };
};