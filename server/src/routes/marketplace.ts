import { Router } from "express";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  buyListing,
  cancelListing,
  createListing,
  getListing,
  listActiveListings,
} from "../services/marketplaceService.js";

export const marketplaceRouter = Router();

marketplaceRouter.get(
  "/listings",
  optionalAuth,
  asyncHandler(async (_req, res) => {
    const listings = await listActiveListings();
    res.json({ listings });
  })
);

marketplaceRouter.get(
  "/listings/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const listing = await getListing(req.params.id);
    res.json({ listing });
  })
);

const createListingSchema = z.object({
  plotId: z.string().uuid(),
  priceCents: z.number().int().positive(),
  description: z.string().max(500).optional(),
});

marketplaceRouter.post(
  "/listings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = createListingSchema.parse(req.body);
    const listing = await createListing(req.user!.id, body);
    res.status(201).json({ listing });
  })
);

marketplaceRouter.post(
  "/listings/:id/buy",
  requireAuth,
  asyncHandler(async (req, res) => {
    const listing = await buyListing(req.user!.id, req.params.id);
    res.json({ listing });
  })
);

marketplaceRouter.delete(
  "/listings/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const listing = await cancelListing(req.user!.id, req.params.id);
    res.json({ listing });
  })
);
