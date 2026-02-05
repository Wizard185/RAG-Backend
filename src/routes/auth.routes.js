import { Router } from "express";
import {
  googleAuth,
  signup,
  login
} from "../controllers/auth.controllers.js";
import { signupSchema } from "../validators/auth.validators.js";
import { validate } from "../middlewares/validate.middlewares.js";

const router = Router();

router.post("/google", googleAuth);

// ✅ VALIDATED SIGNUP
router.post("/signup", validate(signupSchema), signup);

router.post("/login", login);

export default router;
