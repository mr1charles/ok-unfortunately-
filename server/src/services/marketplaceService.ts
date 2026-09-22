import { MAX_LAND_PRICE_CENTS, MIN_LAND_PRICE_CENTS } from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { applyLedgerEntry } from "./walletService.js";
import { notifyUser } from "./notificationService.js";
import { transferOwnership } from "./landService.js";

export async function listActiveListings() {
  return prisma.listing.findMany({
    where: { status: "ACTIVE" },
    include: {
      plot: true,
      seller: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getListing(listingId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { plot: true, seller: { select: { id: true, username: true } } },
  });
  if (!listing) throw ApiError.notFound("Listing not found");
  return listing;
}

export async function createListing(userId: string, params: { plotId: string; priceCents: number; description?: string }) {
  if (params.priceCents < MIN_LAND_PRICE_CENTS || params.priceCents > MAX_LAND_PRICE_CENTS) {
    throw ApiError.badRequest(
      `Price must be between ${MIN_LAND_PRICE_CENTS / 100} and ${MAX_LAND_PRICE_CENTS / 100} dollars`
    );
  }

  return prisma.$transaction(async (tx) => {
    const plot = await tx.landPlot.findUnique({ where: { id: params.plotId } });
    if (!plot) throw ApiError.notFound("Plot not found");
    if (plot.ownerId !== userId) throw ApiError.forbidden("You do not own this plot");
    if (plot.status !== "OWNED") {
      throw ApiError.conflict("This plot already has an active listing or auction");
    }

    const listing = await tx.listing.create({
      data: {
        plotId: plot.id,
        sellerId: userId,
        priceCents: params.priceCents,
        description: params.description,
      },
    });
    await tx.landPlot.update({ where: { id: plot.id }, data: { status: "LISTED" } });
    await notifyUser(
      userId,
      {
        type: "LISTING_CREATED",
        title: "Listing created",
        message: `Your plot (${plot.x}, ${plot.y}) is now listed for sale.`,
        data: { plotId: plot.id, listingId: listing.id },
      },
      tx
    );
    return listing;
  });
}

export async function cancelListing(userId: string, listingId: string, isAdmin = false) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { plot: true } });
    if (!listing) throw ApiError.notFound("Listing not found");
    if (!isAdmin && listing.sellerId !== userId) throw ApiError.forbidden("You do not own this listing");
    if (listing.status !== "ACTIVE" && listing.status !== "PAUSED") {
      throw ApiError.conflict("This listing is no longer active");
    }

    const updated = await tx.listing.update({
      where: { id: listingId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await tx.landPlot.update({ where: { id: listing.plotId }, data: { status: "OWNED" } });
    await notifyUser(
      listing.sellerId,
      {
        type: "LISTING_CANCELLED",
        title: "Listing removed",
        message: isAdmin
          ? `An admin removed your listing for plot (${listing.plot.x}, ${listing.plot.y}).`
          : `You removed your listing for plot (${listing.plot.x}, ${listing.plot.y}).`,
        data: { plotId: listing.plotId, listingId },
      },
      tx
    );
    return updated;
  });
}

export async function pauseListing(listingId: string, paused: boolean) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw ApiError.notFound("Listing not found");
  if (listing.status !== "ACTIVE" && listing.status !== "PAUSED") {
    throw ApiError.conflict("This listing is no longer active");
  }
  return prisma.listing.update({
    where: { id: listingId },
    data: { status: paused ? "PAUSED" : "ACTIVE" },
  });
}

/** Player-to-player direct purchase of a listed plot. 10%-by-default
 * platform fee is deducted from the sale; seller receives the net amount.
 * Buying your own listing is explicitly rejected. */
export async function buyListing(buyerId: string, listingId: string) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { plot: true } });
    if (!listing) throw ApiError.notFound("Listing not found");
    if (listing.status !== "ACTIVE") throw ApiError.conflict("This listing is no longer available");
    if (listing.sellerId === buyerId) {
      throw ApiError.badRequest("You cannot buy your own listing");
    }

    const ledger = await applyLedgerEntry(tx, {
      type: "MARKETPLACE_SALE",
      grossCents: listing.priceCents,
      fromUserId: buyerId,
      toUserId: listing.sellerId,
      plotId: listing.plotId,
      listingId: listing.id,
      description: `Sale of plot (${listing.plot.x}, ${listing.plot.y}) via marketplace listing`,
      applyPlatformFee: true,
    });

    await transferOwnership(tx, {
      plotId: listing.plotId,
      fromUserId: listing.sellerId,
      toUserId: buyerId,
      priceCents: listing.priceCents,
      via: "MARKETPLACE_SALE",
    });

    const updated = await tx.listing.update({
      where: { id: listingId },
      data: { status: "SOLD", buyerId, soldAt: new Date() },
    });

    await notifyUser(
      buyerId,
      {
        type: "LAND_PURCHASED",
        title: "Land purchased",
        message: `You bought plot (${listing.plot.x}, ${listing.plot.y}) for $${(listing.priceCents / 100).toFixed(2)}.`,
        data: { plotId: listing.plotId },
      },
      tx
    );
    await notifyUser(
      listing.sellerId,
      {
        type: "LISTING_SOLD",
        title: "Your land sold",
        message: `Plot (${listing.plot.x}, ${listing.plot.y}) sold for $${(listing.priceCents / 100).toFixed(2)}. You received $${(ledger.netCents / 100).toFixed(2)} after the ${ledger.feePercentApplied}% platform fee.`,
        data: { plotId: listing.plotId },
      },
      tx
    );

    return updated;
  });
}
