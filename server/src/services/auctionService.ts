import {
  MAX_AUCTION_DURATION_MINUTES,
  MIN_AUCTION_DURATION_MINUTES,
  MIN_BID_INCREMENT_CENTS,
  MIN_LAND_PRICE_CENTS,
} from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { applyLedgerEntry, getBalanceCents } from "./walletService.js";
import { notifyUser } from "./notificationService.js";
import { transferOwnership } from "./landService.js";

export async function listActiveAuctions() {
  return prisma.auction.findMany({
    where: { status: "ACTIVE" },
    include: {
      plot: true,
      seller: { select: { id: true, username: true } },
      currentBidder: { select: { id: true, username: true } },
    },
    orderBy: { endAt: "asc" },
  });
}

export async function getAuction(auctionId: string) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      plot: true,
      seller: { select: { id: true, username: true } },
      currentBidder: { select: { id: true, username: true } },
      bids: { orderBy: { createdAt: "desc" }, take: 25, include: { bidder: { select: { username: true } } } },
    },
  });
  if (!auction) throw ApiError.notFound("Auction not found");
  return auction;
}

export async function createAuction(
  userId: string,
  params: {
    plotId: string;
    startingPriceCents: number;
    reservePriceCents?: number;
    durationMinutes: number;
    description?: string;
  }
) {
  if (params.startingPriceCents < MIN_LAND_PRICE_CENTS) {
    throw ApiError.badRequest(`Starting price must be at least $${(MIN_LAND_PRICE_CENTS / 100).toFixed(2)}`);
  }
  if (params.durationMinutes < MIN_AUCTION_DURATION_MINUTES || params.durationMinutes > MAX_AUCTION_DURATION_MINUTES) {
    throw ApiError.badRequest(
      `Duration must be between ${MIN_AUCTION_DURATION_MINUTES} minutes and ${MAX_AUCTION_DURATION_MINUTES / 60 / 24} days`
    );
  }
  if (params.reservePriceCents !== undefined && params.reservePriceCents < params.startingPriceCents) {
    throw ApiError.badRequest("Reserve price cannot be lower than the starting price");
  }

  return prisma.$transaction(async (tx) => {
    const plot = await tx.landPlot.findUnique({ where: { id: params.plotId } });
    if (!plot) throw ApiError.notFound("Plot not found");
    if (plot.ownerId !== userId) throw ApiError.forbidden("You do not own this plot");
    if (plot.status !== "OWNED") {
      throw ApiError.conflict("This plot already has an active listing or auction");
    }

    const endAt = new Date(Date.now() + params.durationMinutes * 60_000);
    const auction = await tx.auction.create({
      data: {
        plotId: plot.id,
        sellerId: userId,
        startingPriceCents: params.startingPriceCents,
        reservePriceCents: params.reservePriceCents,
        description: params.description,
        endAt,
      },
    });
    await tx.landPlot.update({ where: { id: plot.id }, data: { status: "AUCTION" } });
    return auction;
  });
}

/**
 * Places a bid. Rejects bids above the bidder's current balance (spec
 * requirement: "Prevent users from bidding more than their available
 * balance"). Funds are NOT escrowed on bid - they are re-validated for the
 * winning bidder at settlement time, so a bidder can still be outbid
 * without funds being locked up in the meantime.
 */
export async function placeBid(userId: string, auctionId: string, amountCents: number) {
  return prisma.$transaction(async (tx) => {
    const auction = await tx.auction.findUnique({ where: { id: auctionId }, include: { plot: true } });
    if (!auction) throw ApiError.notFound("Auction not found");
    if (auction.status !== "ACTIVE" || auction.endAt.getTime() <= Date.now()) {
      throw ApiError.conflict("This auction is no longer accepting bids");
    }
    if (auction.sellerId === userId) {
      throw ApiError.badRequest("You cannot bid on your own auction");
    }

    const minimumBid = auction.currentBidCents
      ? auction.currentBidCents + MIN_BID_INCREMENT_CENTS
      : auction.startingPriceCents;
    if (amountCents < minimumBid) {
      throw ApiError.badRequest(`Bid must be at least $${(minimumBid / 100).toFixed(2)}`);
    }

    const balanceCents = await getBalanceCents(userId);
    if (amountCents > balanceCents) {
      throw ApiError.insufficientFunds("You cannot bid more than your available balance");
    }

    const previousBidderId = auction.currentBidderId;

    await tx.bid.create({ data: { auctionId, bidderId: userId, amountCents } });
    const updated = await tx.auction.update({
      where: { id: auctionId },
      data: { currentBidCents: amountCents, currentBidderId: userId },
    });

    if (previousBidderId && previousBidderId !== userId) {
      await notifyUser(
        previousBidderId,
        {
          type: "OUTBID",
          title: "You've been outbid",
          message: `Someone bid $${(amountCents / 100).toFixed(2)} on plot (${auction.plot.x}, ${auction.plot.y}).`,
          data: { auctionId, plotId: auction.plotId },
        },
        tx
      );
    }

    return updated;
  });
}

export async function cancelAuction(userId: string, auctionId: string, isAdmin = false) {
  return prisma.$transaction(async (tx) => {
    const auction = await tx.auction.findUnique({ where: { id: auctionId }, include: { plot: true } });
    if (!auction) throw ApiError.notFound("Auction not found");
    if (!isAdmin && auction.sellerId !== userId) throw ApiError.forbidden("You do not own this auction");
    if (auction.status !== "ACTIVE") throw ApiError.conflict("This auction has already ended");
    if (!isAdmin && auction.currentBidderId) {
      throw ApiError.conflict("An auction with active bids can only be cancelled by an admin");
    }

    const updated = await tx.auction.update({ where: { id: auctionId }, data: { status: "CANCELLED", settledAt: new Date() } });
    await tx.landPlot.update({ where: { id: auction.plotId }, data: { status: "OWNED" } });

    if (isAdmin) {
      await notifyUser(
        auction.sellerId,
        {
          type: "ADMIN_ACTION",
          title: "Auction cancelled",
          message: `An admin cancelled your auction for plot (${auction.plot.x}, ${auction.plot.y}).`,
          data: { plotId: auction.plotId },
        },
        tx
      );
    }
    return updated;
  });
}

/**
 * Settles a single expired auction. Called by the auction-closer background
 * job (see jobs/auctionCloser.ts), and safe to call directly too - it only
 * acts on auctions that are ACTIVE and past endAt.
 *
 * Winning path: transfers ownership, moves funds with the platform fee
 * applied, records an immutable AUCTION_SALE transaction, notifies buyer +
 * seller + any losing bidders.
 * No-sale path (no bids, or highest bid below reserve): plot reverts to
 * OWNED, seller and any bidder are notified.
 */
export async function settleAuction(auctionId: string) {
  return prisma.$transaction(async (tx) => {
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
      include: { plot: true, bids: { include: { bidder: true } } },
    });
    if (!auction) return null;
    if (auction.status !== "ACTIVE") return auction;
    if (auction.endAt.getTime() > Date.now()) return auction;

    const reserveMet = !auction.reservePriceCents || (auction.currentBidCents ?? 0) >= auction.reservePriceCents;
    const distinctBidderIds = [...new Set(auction.bids.map((b) => b.bidderId))];

    if (!auction.currentBidderId || !reserveMet) {
      await tx.auction.update({ where: { id: auctionId }, data: { status: "ENDED", settledAt: new Date() } });
      await tx.landPlot.update({ where: { id: auction.plotId }, data: { status: "OWNED" } });
      await notifyUser(
        auction.sellerId,
        {
          type: "AUCTION_ENDED_SELLER",
          title: "Your auction ended",
          message: auction.currentBidderId
            ? `Your auction for plot (${auction.plot.x}, ${auction.plot.y}) ended without meeting the reserve price.`
            : `Your auction for plot (${auction.plot.x}, ${auction.plot.y}) ended with no bids.`,
          data: { plotId: auction.plotId },
        },
        tx
      );
      for (const bidderId of distinctBidderIds) {
        await notifyUser(
          bidderId,
          {
            type: "AUCTION_LOST",
            title: "Auction ended",
            message: `The auction for plot (${auction.plot.x}, ${auction.plot.y}) ended without a sale.`,
            data: { plotId: auction.plotId },
          },
          tx
        );
      }
      return tx.auction.findUniqueOrThrow({ where: { id: auctionId } });
    }

    // Re-validate the winner still has sufficient funds. If not, they
    // forfeit and we fall back to a no-sale outcome rather than letting a
    // client-side balance change manipulate the auction outcome.
    const winnerBalance = await tx.balance.findUnique({ where: { userId: auction.currentBidderId } });
    if (!winnerBalance || winnerBalance.balanceCents < auction.currentBidCents!) {
      await tx.auction.update({ where: { id: auctionId }, data: { status: "ENDED", settledAt: new Date() } });
      await tx.landPlot.update({ where: { id: auction.plotId }, data: { status: "OWNED" } });
      await notifyUser(
        auction.currentBidderId,
        {
          type: "AUCTION_LOST",
          title: "Winning bid could not be collected",
          message: `Your winning bid on plot (${auction.plot.x}, ${auction.plot.y}) could not be collected due to insufficient balance.`,
          data: { plotId: auction.plotId },
        },
        tx
      );
      await notifyUser(
        auction.sellerId,
        {
          type: "AUCTION_ENDED_SELLER",
          title: "Your auction ended",
          message: `Your auction for plot (${auction.plot.x}, ${auction.plot.y}) ended without a completed sale.`,
          data: { plotId: auction.plotId },
        },
        tx
      );
      return tx.auction.findUniqueOrThrow({ where: { id: auctionId } });
    }

    const ledger = await applyLedgerEntry(tx, {
      type: "AUCTION_SALE",
      grossCents: auction.currentBidCents!,
      fromUserId: auction.currentBidderId,
      toUserId: auction.sellerId,
      plotId: auction.plotId,
      auctionId: auction.id,
      description: `Auction sale of plot (${auction.plot.x}, ${auction.plot.y})`,
      applyPlatformFee: true,
    });

    await transferOwnership(tx, {
      plotId: auction.plotId,
      fromUserId: auction.sellerId,
      toUserId: auction.currentBidderId,
      priceCents: auction.currentBidCents!,
      via: "AUCTION_SALE",
    });

    await tx.auction.update({ where: { id: auctionId }, data: { status: "ENDED", settledAt: new Date() } });

    await notifyUser(
      auction.currentBidderId,
      {
        type: "AUCTION_WON",
        title: "You won the auction!",
        message: `You won plot (${auction.plot.x}, ${auction.plot.y}) for $${(auction.currentBidCents! / 100).toFixed(2)}.`,
        data: { plotId: auction.plotId },
      },
      tx
    );
    await notifyUser(
      auction.sellerId,
      {
        type: "AUCTION_ENDED_SELLER",
        title: "Your auction sold!",
        message: `Plot (${auction.plot.x}, ${auction.plot.y}) sold for $${(auction.currentBidCents! / 100).toFixed(2)}. You received $${(ledger.netCents / 100).toFixed(2)} after the ${ledger.feePercentApplied}% platform fee.`,
        data: { plotId: auction.plotId },
      },
      tx
    );
    for (const bidderId of distinctBidderIds) {
      if (bidderId === auction.currentBidderId) continue;
      await notifyUser(
        bidderId,
        {
          type: "AUCTION_LOST",
          title: "Auction ended",
          message: `You did not win the auction for plot (${auction.plot.x}, ${auction.plot.y}).`,
          data: { plotId: auction.plotId },
        },
        tx
      );
    }

    return tx.auction.findUniqueOrThrow({ where: { id: auctionId } });
  });
}

export async function findExpiredActiveAuctionIds(): Promise<string[]> {
  const rows = await prisma.auction.findMany({
    where: { status: "ACTIVE", endAt: { lte: new Date() } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
