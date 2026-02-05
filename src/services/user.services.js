import { User } from "../models/User.models.js";
import ApiError from "../utils/ApiError.js";
import { comparePassword, hashPassword } from "../utils/password.js";

export const changePasswordService = async (
  userId,
  currentPassword,
  newPassword
) => {
  // 🔑 Fetch user WITH password explicitly
  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.authProvider !== "local") {
    throw new ApiError(
      400,
      "Password change not allowed for OAuth users"
    );
  }

  const isMatch = await comparePassword(
    currentPassword,
    user.password
  );

  if (!isMatch) {
    throw new ApiError(401, "Current password is incorrect");
  }

  user.password = await hashPassword(newPassword);
  await user.save();
};

export const updateProfileService = async (userId, name) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { name },
    { new: true }
  );

  return user;
};
