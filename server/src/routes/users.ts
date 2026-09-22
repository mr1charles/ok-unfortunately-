import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { updateAppearance, updatePosition, getCharacter } from "../services/characterService.js";
import { completeOnboarding, getMePayload } from "../services/userService.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const appearanceSchema = z.object({
  skinColor: z.string(),
  hairStyle: z.enum(["bald", "short", "long", "mohawk", "curly"]),
  hairColor: z.string(),
  outfitColor: z.string(),
  outfitStyle: z.enum(["casual", "formal", "explorer", "royal"]),
  accessory: z.enum(["none", "glasses", "hat", "cape", "backpack"]),
  accentColor: z.string(),
});

usersRouter.get(
  "/character",
  asyncHandler(async (req, res) => {
    const character = await getCharacter(req.user!.id);
    res.json({ character });
  })
);

usersRouter.patch(
  "/character",
  asyncHandler(async (req, res) => {
    const appearance = appearanceSchema.parse(req.body.appearance);
    const character = await updateAppearance(req.user!.id, appearance);
    res.json({ character });
  })
);

const positionSchema = z.object({ x: z.number(), y: z.number() });

usersRouter.patch(
  "/character/position",
  asyncHandler(async (req, res) => {
    const { x, y } = positionSchema.parse(req.body);
    const character = await updatePosition(req.user!.id, x, y);
    res.json({ character });
  })
);

usersRouter.post(
  "/onboarding/complete",
  asyncHandler(async (req, res) => {
    await completeOnboarding(req.user!.id);
    const user = await getMePayload(req.user!.id);
    res.json({ user });
  })
);
