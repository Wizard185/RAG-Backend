import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import {
  googleAuthService,
  signupService,
  loginService,
  setPasswordService
} from "../services/auth.services.js";

/**
 * GOOGLE OAUTH LOGIN
 */
export const googleAuth = asyncHandler(async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    throw new ApiError(400, "Google ID token is required");
  }

  const { user, token } = await googleAuthService(idToken);

  res.status(200).json(
    new ApiResponse(
      200,
      { user, token },
      "Google authentication successful"
    )
  );
});

/**
 * EMAIL + PASSWORD SIGNUP
 */
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const { user, token } = await signupService({
    name,
    email,
    password
  });

  res.status(201).json(
    new ApiResponse(
      201,
      { user, token },
      "Signup successful"
    )
  );
});

/**
 * EMAIL + PASSWORD LOGIN
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user, token } = await loginService({
    email,
    password
  });

  res.status(200).json(
    new ApiResponse(
      200,
      { user, token },
      "Login successful"
    )
  );
});
export const setPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  await setPasswordService(req.user._id, password);

  res.status(200).json(
    new ApiResponse(200, null, "Password set successfully. You can now login with email.")
  );
});
