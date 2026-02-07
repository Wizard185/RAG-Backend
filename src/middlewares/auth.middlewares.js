import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { verifyToken } from "../utils/jwt.js";
import { User } from "../models/User.models.js";
import jwt from "jsonwebtoken";
/**
 * JWT PROTECTION MIDDLEWARE
 * Verifies token and attaches user to req.user
 */
export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Unauthorized: No token provided");
  }

  const token = authHeader.split(" ")[1];

  const decoded = verifyToken(token);

  const user = await User.findById(decoded.userId).select("-password");

  if (!user) {
    throw new ApiError(401, "Unauthorized: User not found");
  }

  req.user = user;
  next();
});
export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        // 1. Get the token from cookies OR the Authorization header
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new ApiError(401, "Unauthorized request: No token provided");
        }

        // 2. Verify the token
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Find the user associated with the token
        const user = await User.findById(decodedToken?.userId).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid Access Token");
        }

        // 4. Attach the user object to the request for the next step
        req.user = user;
        next();
        
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});
