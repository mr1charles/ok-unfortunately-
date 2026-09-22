import { Router } from "express";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as defenseService from "../services/defenseService.js";

export const defensesRouter = Router();

defensesRouter.get(
  "/catalog",
  asyncHandler(async (_req, res) => {
    res.json({ catalog: defenseService.getCatalog() });
  })
);

defensesRouter.get(
  "/property/:propertyId",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const defenses = await defenseService.listPropertyDefenses(req.params.propertyId);
    res.json({ defenses });
  })
);

const purchaseSchema = z.object({ kind: z.enum(["SHIELD", "ENERGY_BARRIER", "SECURITY_TOWER"]) });

defensesRouter.post(
  "/property/:propertyId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { kind } = purchaseSchema.parse(req.body);
    const defense = await defenseService.purchaseDefense(req.user!.id, req.params.propertyId, kind);
    res.status(201).json({ defense });
  })
);
