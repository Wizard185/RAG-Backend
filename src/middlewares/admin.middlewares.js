import ApiError from "../utils/ApiError.js";

export const verifyAdmin = (req, res, next) => {
  // Assuming your User model has a 'role' field (e.g., "user" or "admin")
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return next(new ApiError(403, "Access Denied: Admins only."));
  }
};