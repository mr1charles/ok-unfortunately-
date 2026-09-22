import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as attackService from "../services/attackService.js";

export const attacksRouter = Router();
attacksRouter.use(requireAuth);

attacksRouter.get(
  "/allowance",
  asyncHandler(async (req, res) => {
    const allowance = await attackService.getDailyAllowance(req.user!.id);
    res.json({ allowance });
  })
);

const executeSchema = z.object({ worldId: z.string().uuid() });

attacksRouter.post(
  "/execute",
  asyncHandler(async (req, res) => {
    const { worldId } = executeSchema.parse(req.body);
    const outcome = await attackService.executeAttack(req.user!.id, worldId);
    res.status(201).json(outcome);
  })
);

attacksRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const history = await attackService.getAttackHistory(req.user!.id);
    res.json(history);
  })
);
