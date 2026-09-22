import { Router } from "express";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  cancelAuction,
  createAuction,
  getAuction,
  listActiveAuctions,
  placeBid,
} from "../services/auctionService.js";

export const auctionsRouter = Router();

auctionsRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (_req, res) => {
    const auctions = await listActiveAuctions();
    res.json({ auctions });
  })
);

auctionsRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const auction = await getAuction(req.params.id);
    res.json({ auction });
  })
);

const createAuctionSchema = z.object({
  plotId: z.string().uuid(),
  startingPriceCents: z.number().int().positive(),
  reservePriceCents: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive(),
  description: z.string().max(500).optional(),
});

auctionsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = createAuctionSchema.parse(req.body);
    const auction = await createAuction(req.user!.id, body);
    res.status(201).json({ auction });
  })
);

const bidSchema = z.object({ amountCents: z.number().int().positive() });

auctionsRouter.post(
  "/:id/bids",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { amountCents } = bidSchema.parse(req.body);
    const auction = await placeBid(req.user!.id, req.params.id, amountCents);
    res.status(201).json({ auction });
  })
);

auctionsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auction = await cancelAuction(req.user!.id, req.params.id);
    res.json({ auction });
  })
);
