import jwt from "jsonwebtoken";

/**
 * Generate JWT token
 * @param {Object} payload - data to encode in token (e.g. { userId })
 * @returns {String} JWT token
 */
export const generateToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
};

/**
 * Verify JWT token
 * @param {String} token - Bearer token value
 * @returns {Object} decoded payload
 */
export const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};
