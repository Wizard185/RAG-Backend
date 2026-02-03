import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { getHealthStatus } from "../services/health.services.js";

export const healthCheck = asyncHandler(async (req, res) => {
  const status = getHealthStatus();

  res.status(200).json(
    new ApiResponse(200, status, "Health check successful")
  );
});
