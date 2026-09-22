import { Router } from "express";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as market from "../services/propertyMarketService.js";

export const propertyMarketRouter = Router();

propertyMarketRouter.get(
  "/listings",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const listings = await market.listActivePropertyListings(req.query.worldId as string | undefined);
    res.json({ listings });
  })
);

const createListingSchema = z.object({ propertyId: z.string().uuid(), priceCents: z.number().int().positive(), description: z.string().max(500).optional() });

propertyMarketRouter.post(
  "/listings",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = createListingSchema.parse(req.body);
    const listing = await market.createPropertyListing(req.user!.id, body);
    res.status(201).json({ listing });
  })
);

propertyMarketRouter.post(
  "/listings/:id/buy",
  requireAuth,
  asyncHandler(async (req, res) => {
    const listing = await market.buyPropertyListing(req.user!.id, req.params.id);
    res.json({ listing });
  })
);

propertyMarketRouter.delete(
  "/listings/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const listing = await market.cancelPropertyListing(req.user!.id, req.params.id);
    res.json({ listing });
  })
);

propertyMarketRouter.get(
  "/auctions",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const auctions = await market.listActivePropertyAuctions(req.query.worldId as string | undefined);
    res.json({ auctions });
  })
);

const createAuctionSchema = z.object({
  propertyId: z.string().uuid(),
  startingPriceCents: z.number().int().positive(),
  reservePriceCents: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive(),
  description: z.string().max(500).optional(),
});

propertyMarketRouter.post(
  "/auctions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = createAuctionSchema.parse(req.body);
    const auction = await market.createPropertyAuction(req.user!.id, body);
    res.status(201).json({ auction });
  })
);

const bidSchema = z.object({ amountCents: z.number().int().positive() });

propertyMarketRouter.post(
  "/auctions/:id/bids",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { amountCents } = bidSchema.parse(req.body);
    const auction = await market.placePropertyBid(req.user!.id, req.params.id, amountCents);
    res.status(201).json({ auction });
  })
);

propertyMarketRouter.delete(
  "/auctions/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auction = await market.cancelPropertyAuction(req.user!.id, req.params.id);
    res.json({ auction });
  })
);
