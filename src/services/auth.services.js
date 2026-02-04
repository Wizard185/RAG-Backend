import { OAuth2Client } from "google-auth-library";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/User.models.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { generateToken } from "../utils/jwt.js";

/* GOOGLE OAUTH CLIENT */
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * GOOGLE OAUTH AUTHENTICATION
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

  let user = await User.findOne({
    authProvider: "google",
    oauthId: googleId
  });

  if (!user) {
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
 */
export const loginService = async ({ email, password }) => {
  const user = await User.findOne({
    email,
    authProvider: "local"
  }).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isMatch = await comparePassword(password, user.password);

  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = generateToken({ userId: user._id });

  return { user, token };
};
