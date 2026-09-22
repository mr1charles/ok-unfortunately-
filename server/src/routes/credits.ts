import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getCredits, listCreditTransactions } from "../services/creditService.js";
import { mineProperty } from "../services/miningService.js";
import { z } from "zod";

export const creditsRouter = Router();
creditsRouter.use(requireAuth);

creditsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const credits = await getCredits(req.user!.id);
    res.json({ credits });
  })
);

creditsRouter.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const transactions = await listCreditTransactions(req.user!.id);
    res.json({ transactions });
  })
);

const mineSchema = z.object({ propertyId: z.string().uuid() });

creditsRouter.post(
  "/mine",
  asyncHandler(async (req, res) => {
    const { propertyId } = mineSchema.parse(req.body);
    const result = await mineProperty(req.user!.id, propertyId);
    res.status(201).json(result);
  })
);
