import { Router } from "express";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getCatalog,
  getUserInventory,
  listPlotDecorations,
  placeDecoration,
  removeDecoration,
} from "../services/decorationService.js";

export const decorationsRouter = Router();

decorationsRouter.get(
  "/catalog",
  asyncHandler(async (_req, res) => {
    res.json({ catalog: getCatalog() });
  })
);

decorationsRouter.get(
  "/inventory",
  requireAuth,
  asyncHandler(async (req, res) => {
    const inventory = await getUserInventory(req.user!.id);
    res.json({ inventory });
  })
);

decorationsRouter.get(
  "/plots/:plotId",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const decorations = await listPlotDecorations(req.params.plotId);
    res.json({ decorations });
  })
);

const placeSchema = z.object({
  objectType: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
});

decorationsRouter.post(
  "/plots/:plotId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = placeSchema.parse(req.body);
    const decoration = await placeDecoration(req.user!.id, req.params.plotId, body);
    res.status(201).json({ decoration });
  })
);

decorationsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const decoration = await removeDecoration(req.user!.id, req.params.id);
    res.json({ decoration });
  })
);
