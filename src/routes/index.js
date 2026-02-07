import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import usersRoutes from "./user.routes.js";
import chatsRoutes from "./chats.routes.js";
import uploadRoutes from "./upload.routes.js";


const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/chats", chatsRoutes);
router.use("/upload", uploadRoutes);


export default router;
