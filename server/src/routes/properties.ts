import { Router } from "express";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as pixelService from "../services/pixelService.js";
import * as decorationService from "../services/propertyDecorationService.js";

export const propertiesRouter = Router();

propertiesRouter.get(
  "/:id/decorations",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const decorations = await decorationService.listPropertyDecorations(req.params.id);
    res.json({ decorations });
  })
);

const placeDecorationSchema = z.object({
  objectType: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
});

propertiesRouter.post(
  "/:id/decorations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = placeDecorationSchema.parse(req.body);
    const decoration = await decorationService.placeDecoration(req.user!.id, req.params.id, body);
    res.status(201).json({ decoration });
  })
);

propertiesRouter.delete(
  "/decorations/:decorationId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const decoration = await decorationService.removeDecoration(req.user!.id, req.params.decorationId);
    res.json({ decoration });
  })
);

propertiesRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const property = await pixelService.getPropertyDetail(req.params.id);
    res.json({ property });
  })
);

const colorSchema = z.object({ colorHex: z.string() });

propertiesRouter.patch(
  "/:id/color",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { colorHex } = colorSchema.parse(req.body);
    const property = await pixelService.setPropertyColor(req.user!.id, req.params.id, colorHex);
    res.json({ property });
  })
);

const nameSchema = z.object({ name: z.string().min(1).max(60) });

propertiesRouter.patch(
  "/:id/name",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name } = nameSchema.parse(req.body);
    const property = await pixelService.renameProperty(req.user!.id, req.params.id, name);
    res.json({ property });
  })
);
