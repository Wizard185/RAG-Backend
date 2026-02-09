import { Router } from "express";
import {
  googleAuth,
  signup,
  login,
  setPassword
} from "../controllers/auth.controllers.js";
import { signupSchema } from "../validators/auth.validators.js";
import { validate } from "../middlewares/validate.middlewares.js";
import { protect } from "../middlewares/auth.middlewares.js";
const router = Router();

router.post("/google", googleAuth);

// ✅ VALIDATED SIGNUP
router.post("/signup", validate(signupSchema), signup);

router.post("/login", login);
router.post("/set-password", protect, setPassword);
export default router;
