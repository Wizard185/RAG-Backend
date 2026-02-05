import { Router } from "express";
import { protect } from "../middlewares/auth.middlewares.js";
import { getMe } from "../controllers/user.controllers.js";
import { validate } from "../middlewares/validate.middlewares.js";
import { updateProfileSchema,changePasswordSchema } from "../validators/user.validators.js";
import { updateProfile,changePassword } from "../controllers/user.controllers.js";

const router = Router();

router.get("/me", protect, getMe);
router.patch(
  "/profile",
  protect,
  validate(updateProfileSchema),
  updateProfile
);
router.post("/logout", protect, (req, res) => {
  res.status(200).json({ success: true, message: "Logged out" });
});

router.patch(
  "/password",
  protect,
  validate(changePasswordSchema),
  changePassword
);

export default router;
