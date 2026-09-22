import type { Prisma } from "@prisma/client";
import {
  MAX_AUCTION_DURATION_MINUTES,
  MIN_AUCTION_DURATION_MINUTES,
  MIN_BID_INCREMENT_CENTS,
} from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { applyLedgerEntry } from "./walletService.js";
import { notifyUser } from "./notificationService.js";

/**
 * Marketplace integration for the pixel-world Property model. Mirrors
 * marketplaceService.ts / auctionService.ts (same fee logic via
 * applyLedgerEntry, same ownership-transfer discipline) but operates on
 * Property/PixelOwnership instead of LandPlot.
 */

async function transferPropertyOwnership(tx: Prisma.TransactionClient, propertyId: string, toUserId: string) {
  await tx.pixelOwnership.updateMany({ where: { propertyId }, data: { ownerId: toUserId } });
  await tx.property.update({ where: { id: propertyId }, data: { ownerId: toUserId, marketStatus: "NONE" } });
}

// --- Direct listings -----------------------------------------------------

export async function listActivePropertyListings(worldId?: string) {
  return prisma.propertyListing.findMany({
    where: { status: "ACTIVE", ...(worldId ? { worldId } : {}) },
    include: { property: true, seller: { select: { id: true, username: true } }, world: { select: { key: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPropertyListing(userId: string, params: { propertyId: string; priceCents: number; description?: string }) {
  if (params.priceCents <= 0) throw ApiError.badRequest("Price must be positive");

  return prisma.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: params.propertyId } });
    if (!property) throw ApiError.notFound("Property not found");
    if (property.ownerId !== userId) throw ApiError.forbidden("You do not own this property");
    if (property.marketStatus !== "NONE") throw ApiError.conflict("This property already has an active listing or auction");

    const listing = await tx.propertyListing.create({
      data: { propertyId: property.id, worldId: property.worldId, sellerId: userId, priceCents: params.priceCents, description: params.description },
    });
    await tx.property.update({ where: { id: property.id }, data: { marketStatus: "LISTED" } });
    await notifyUser(userId, { type: "LISTING_CREATED", title: "Property listed", message: `Your property is listed for sale.`, data: { propertyId: property.id } }, tx);
    return listing;
  });
}

export async function cancelPropertyListing(userId: string, listingId: string, isAdmin = false) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.propertyListing.findUnique({ where: { id: listingId } });
    if (!listing) throw ApiError.notFound("Listing not found");
    if (!isAdmin && listing.sellerId !== userId) throw ApiError.forbidden("You do not own this listing");
    if (listing.status !== "ACTIVE" && listing.status !== "PAUSED") throw ApiError.conflict("This listing is no longer active");

    const updated = await tx.propertyListing.update({ where: { id: listingId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await tx.property.update({ where: { id: listing.propertyId }, data: { marketStatus: "NONE" } });
    return updated;
  });
}

export async function buyPropertyListing(buyerId: string, listingId: string) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.propertyListing.findUnique({ where: { id: listingId }, include: { property: true } });
    if (!listing) throw ApiError.notFound("Listing not found");
    if (listing.status !== "ACTIVE") throw ApiError.conflict("This listing is no longer available");
    if (listing.sellerId === buyerId) throw ApiError.badRequest("You cannot buy your own listing");

    const ledger = await applyLedgerEntry(tx, {
      type: "MARKETPLACE_SALE",
      grossCents: listing.priceCents,
      fromUserId: buyerId,
      toUserId: listing.sellerId,
      propertyId: listing.propertyId,
      propertyListingId: listing.id,
      description: `Sale of property (${listing.property.pixelCount.toLocaleString()} pixels) via marketplace listing`,
      applyPlatformFee: true,
    });

    await transferPropertyOwnership(tx, listing.propertyId, buyerId);
    const updated = await tx.propertyListing.update({ where: { id: listingId }, data: { status: "SOLD", buyerId, soldAt: new Date() } });

    await notifyUser(buyerId, { type: "LAND_PURCHASED", title: "Property purchased", message: `You bought a property for $${(listing.priceCents / 100).toFixed(2)}.`, data: { propertyId: listing.propertyId } }, tx);
    await notifyUser(listing.sellerId, { type: "LISTING_SOLD", title: "Your property sold", message: `Sold for $${(listing.priceCents / 100).toFixed(2)}. You received $${(ledger.netCents / 100).toFixed(2)} after fees.`, data: { propertyId: listing.propertyId } }, tx);

    return updated;
  });
}

// --- Auctions --------------------------------------------------------------

export async function listActivePropertyAuctions(worldId?: string) {
  return prisma.propertyAuction.findMany({
    where: { status: "ACTIVE", ...(worldId ? { worldId } : {}) },
    include: { property: true, seller: { select: { id: true, username: true } }, currentBidder: { select: { id: true, username: true } } },
    orderBy: { endAt: "asc" },
  });
}

export async function createPropertyAuction(
  userId: string,
  params: { propertyId: string; startingPriceCents: number; reservePriceCents?: number; durationMinutes: number; description?: string }
) {
  if (params.durationMinutes < MIN_AUCTION_DURATION_MINUTES || params.durationMinutes > MAX_AUCTION_DURATION_MINUTES) {
    throw ApiError.badRequest("Invalid auction duration");
  }
  return prisma.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: params.propertyId } });
    if (!property) throw ApiError.notFound("Property not found");
    if (property.ownerId !== userId) throw ApiError.forbidden("You do not own this property");
    if (property.marketStatus !== "NONE") throw ApiError.conflict("This property already has an active listing or auction");

    const endAt = new Date(Date.now() + params.durationMinutes * 60_000);
    const auction = await tx.propertyAuction.create({
      data: {
        propertyId: property.id,
        worldId: property.worldId,
        sellerId: userId,
        startingPriceCents: params.startingPriceCents,
        reservePriceCents: params.reservePriceCents,
        description: params.description,
        endAt,
      },
    });
    await tx.property.update({ where: { id: property.id }, data: { marketStatus: "AUCTION" } });
    return auction;
  });
}

export async function placePropertyBid(userId: string, auctionId: string, amountCents: number) {
  return prisma.$transaction(async (tx) => {
    const auction = await tx.propertyAuction.findUnique({ where: { id: auctionId } });
    if (!auction) throw ApiError.notFound("Auction not found");
    if (auction.status !== "ACTIVE" || auction.endAt.getTime() <= Date.now()) throw ApiError.conflict("This auction is no longer accepting bids");
    if (auction.sellerId === userId) throw ApiError.badRequest("You cannot bid on your own auction");

    const minimumBid = auction.currentBidCents ? auction.currentBidCents + MIN_BID_INCREMENT_CENTS : auction.startingPriceCents;
    if (amountCents < minimumBid) throw ApiError.badRequest(`Bid must be at least $${(minimumBid / 100).toFixed(2)}`);

    const balance = await tx.balance.findUnique({ where: { userId } });
    if (!balance || balance.balanceCents < amountCents) throw ApiError.insufficientFunds("You cannot bid more than your available balance");

    const previousBidderId = auction.currentBidderId;
    await tx.propertyBid.create({ data: { auctionId, bidderId: userId, amountCents } });
    const updated = await tx.propertyAuction.update({ where: { id: auctionId }, data: { currentBidCents: amountCents, currentBidderId: userId } });

    if (previousBidderId && previousBidderId !== userId) {
      await notifyUser(previousBidderId, { type: "OUTBID", title: "You've been outbid", message: `Someone bid $${(amountCents / 100).toFixed(2)} on a property you were bidding on.`, data: { auctionId } }, tx);
    }
    return updated;
  });
}

export async function cancelPropertyAuction(userId: string, auctionId: string, isAdmin = false) {
  return prisma.$transaction(async (tx) => {
    const auction = await tx.propertyAuction.findUnique({ where: { id: auctionId } });
    if (!auction) throw ApiError.notFound("Auction not found");
    if (!isAdmin && auction.sellerId !== userId) throw ApiError.forbidden("You do not own this auction");
    if (auction.status !== "ACTIVE") throw ApiError.conflict("This auction has already ended");
    if (!isAdmin && auction.currentBidderId) throw ApiError.conflict("An auction with active bids can only be cancelled by an admin");

    const updated = await tx.propertyAuction.update({ where: { id: auctionId }, data: { status: "CANCELLED", settledAt: new Date() } });
    await tx.property.update({ where: { id: auction.propertyId }, data: { marketStatus: "NONE" } });
    return updated;
  });
}

export async function settlePropertyAuction(auctionId: string) {
  return prisma.$transaction(async (tx) => {
    const auction = await tx.propertyAuction.findUnique({ where: { id: auctionId }, include: { property: true, bids: true } });
    if (!auction || auction.status !== "ACTIVE" || auction.endAt.getTime() > Date.now()) return auction;

    const reserveMet = !auction.reservePriceCents || (auction.currentBidCents ?? 0) >= auction.reservePriceCents;
    const distinctBidderIds = [...new Set(auction.bids.map((b) => b.bidderId))];

    if (!auction.currentBidderId || !reserveMet) {
      await tx.propertyAuction.update({ where: { id: auctionId }, data: { status: "ENDED", settledAt: new Date() } });
      await tx.property.update({ where: { id: auction.propertyId }, data: { marketStatus: "NONE" } });
      await notifyUser(auction.sellerId, { type: "AUCTION_ENDED_SELLER", title: "Your auction ended", message: `Your property auction ended without a sale.`, data: { propertyId: auction.propertyId } }, tx);
      return tx.propertyAuction.findUniqueOrThrow({ where: { id: auctionId } });
    }

    const winnerBalance = await tx.balance.findUnique({ where: { userId: auction.currentBidderId } });
    if (!winnerBalance || winnerBalance.balanceCents < auction.currentBidCents!) {
      await tx.propertyAuction.update({ where: { id: auctionId }, data: { status: "ENDED", settledAt: new Date() } });
      await tx.property.update({ where: { id: auction.propertyId }, data: { marketStatus: "NONE" } });
      return tx.propertyAuction.findUniqueOrThrow({ where: { id: auctionId } });
    }

    const ledger = await applyLedgerEntry(tx, {
      type: "AUCTION_SALE",
      grossCents: auction.currentBidCents!,
      fromUserId: auction.currentBidderId,
      toUserId: auction.sellerId,
      propertyId: auction.propertyId,
      propertyAuctionId: auction.id,
      description: `Auction sale of property (${auction.property.pixelCount.toLocaleString()} pixels)`,
      applyPlatformFee: true,
    });

    await transferPropertyOwnership(tx, auction.propertyId, auction.currentBidderId);
    await tx.propertyAuction.update({ where: { id: auctionId }, data: { status: "ENDED", settledAt: new Date() } });

    await notifyUser(auction.currentBidderId, { type: "AUCTION_WON", title: "You won the auction!", message: `You won a property for $${(auction.currentBidCents! / 100).toFixed(2)}.`, data: { propertyId: auction.propertyId } }, tx);
    await notifyUser(auction.sellerId, { type: "AUCTION_ENDED_SELLER", title: "Your auction sold!", message: `Sold for $${(auction.currentBidCents! / 100).toFixed(2)}. You received $${(ledger.netCents / 100).toFixed(2)} after fees.`, data: { propertyId: auction.propertyId } }, tx);
    for (const bidderId of distinctBidderIds) {
      if (bidderId === auction.currentBidderId) continue;
      await notifyUser(bidderId, { type: "AUCTION_LOST", title: "Auction ended", message: `You did not win the property auction.`, data: { propertyId: auction.propertyId } }, tx);
    }

    return tx.propertyAuction.findUniqueOrThrow({ where: { id: auctionId } });
  });
}

export async function findExpiredPropertyAuctionIds(): Promise<string[]> {
  const rows = await prisma.propertyAuction.findMany({ where: { status: "ACTIVE", endAt: { lte: new Date() } }, select: { id: true } });
  return rows.map((r) => r.id);
}
