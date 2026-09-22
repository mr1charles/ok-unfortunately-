import { Router } from "express";
import { z } from "zod";
import { registerUser, loginUser } from "../services/authService.js";
import { getMePayload } from "../services/userService.js";
import { signInWithOAuth, listOAuthProviderStatus } from "../services/oauthService.js";
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

/** Which social providers are live (real client ID configured) vs. running
 * in dev/mock mode. The web and Godot clients use this to decide whether
 * to load a real SDK or show the dev sign-in dialog. No auth required -
 * this is public configuration, not a secret. */
authRouter.get(
  "/oauth/providers",
  asyncHandler(async (_req, res) => {
    res.json({ providers: listOAuthProviderStatus() });
  })
);

const oauthSchema = z.object({ idToken: z.string().min(1) });

authRouter.post(
  "/oauth/:provider",
  asyncHandler(async (req, res) => {
    const provider = req.params.provider.toUpperCase();
    if (provider !== "GOOGLE" && provider !== "APPLE" && provider !== "MICROSOFT") {
      res.status(400).json({ error: "BAD_REQUEST", message: "Unknown sign-in provider" });
      return;
    }
    const { idToken } = oauthSchema.parse(req.body);
    const { user, token, isNewAccount } = await signInWithOAuth(provider, idToken);
    const me = await getMePayload(user.id);
    res.status(isNewAccount ? 201 : 200).json({ token, user: me, isNewAccount });
  })
);
