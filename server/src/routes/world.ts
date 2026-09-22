import { Router } from "express";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@pixel-estates/shared";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buyFromPlatform, getPlotDetail, listPlots } from "../services/landService.js";
import { getPlatformFeePercent } from "../services/platformConfigService.js";

export const worldRouter = Router();

worldRouter.get(
  "/meta",
  asyncHandler(async (_req, res) => {
    res.json({ width: WORLD_WIDTH, height: WORLD_HEIGHT, platformFeePercent: await getPlatformFeePercent() });
  })
);

worldRouter.get(
  "/plots",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { status, ownerId } = req.query as { status?: string; ownerId?: string };
    const plots = await listPlots({ status, ownerId });
    res.json({ plots });
  })
);

worldRouter.get(
  "/plots/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const plot = await getPlotDetail(req.params.id);
    res.json({ plot });
  })
);

worldRouter.post(
  "/plots/:id/buy",
  requireAuth,
  asyncHandler(async (req, res) => {
    const plot = await buyFromPlatform(req.user!.id, req.params.id);
    res.status(201).json({ plot });
  })
);
