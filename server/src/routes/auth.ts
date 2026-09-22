import { Router } from "express";
import { z } from "zod";
import { registerUser, loginUser } from "../services/authService.js";
import { getMePayload } from "../services/userService.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(6).max(100),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const { user, token } = await registerUser(body);
    const me = await getMePayload(user.id);
    res.status(201).json({ token, user: me });
  })
);

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const { user, token } = await loginUser(body);
    const me = await getMePayload(user.id);
    res.json({ token, user: me });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = await getMePayload(req.user!.id);
    res.json({ user: me });
  })
);
