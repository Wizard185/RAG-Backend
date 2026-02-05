import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { updateProfileService ,changePasswordService} from "../services/user.services.js";


export const changePassword = asyncHandler(async (req, res) => {
  await changePasswordService(
    req.user._id,
    req.body.currentPassword,
    req.body.newPassword
  );

  res.status(200).json(
    new ApiResponse(200, null, "Password changed successfully")
  );
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(200, req.user, "User session restored")
  );
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await updateProfileService(
    req.user._id,
    req.body.name
  );

  res.status(200).json(
    new ApiResponse(200, user, "Profile updated successfully")
  );
});
