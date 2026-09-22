import type { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { applyLedgerEntry } from "./walletService.js";
import { notifyUser } from "./notificationService.js";

type TxClient = Prisma.TransactionClient;

/**
 * Transfers ownership of a plot inside an existing transaction. Closes the
 * previous LandOwnership stint (if any) and opens a new one, and updates
 * the LandPlot's denormalized owner/status fields. Callers are responsible
 * for the money movement (applyLedgerEntry) and for setting the plot back
 * to OWNED status is handled here; callers of listings/auctions still need
 * to close out their own Listing/Auction rows.
 */
export async function transferOwnership(
  tx: TxClient,
  params: {
    plotId: string;
    fromUserId: string | null;
    toUserId: string;
    priceCents: number;
    via: TransactionType;
  }
) {
  const openStint = await tx.landOwnership.findFirst({
    where: { plotId: params.plotId, releasedAt: null },
  });
  if (openStint) {
    await tx.landOwnership.update({
      where: { id: openStint.id },
      data: { releasedAt: new Date() },
    });
  }

  await tx.landOwnership.create({
    data: {
      plotId: params.plotId,
      userId: params.toUserId,
      acquiredPriceCents: params.priceCents,
      acquiredVia: params.via,
    },
  });

  await tx.landPlot.update({
    where: { id: params.plotId },
    data: {
      ownerId: params.toUserId,
      status: "OWNED",
      lastSalePriceCents: params.priceCents,
    },
  });
}

export interface PlotFilters {
  status?: string;
  ownerId?: string;
}

export async function listPlots(filters: PlotFilters = {}) {
  return prisma.landPlot.findMany({
    where: {
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    },
    include: {
      owner: { select: { id: true, username: true } },
      listings: { where: { status: "ACTIVE" }, take: 1 },
      auctions: { where: { status: "ACTIVE" }, take: 1 },
    },
    orderBy: [{ y: "asc" }, { x: "asc" }],
  });
}

export async function getPlotDetail(plotId: string) {
  const plot = await prisma.landPlot.findUnique({
    where: { id: plotId },
    include: {
      owner: { select: { id: true, username: true } },
      listings: { orderBy: { createdAt: "desc" }, take: 10, include: { seller: { select: { username: true } }, buyer: { select: { username: true } } } },
      auctions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          seller: { select: { username: true } },
          currentBidder: { select: { username: true } },
          bids: { orderBy: { amountCents: "desc" }, take: 10, include: { bidder: { select: { username: true } } } },
        },
      },
      decorations: true,
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      ownershipHistory: {
        orderBy: { acquiredAt: "desc" },
        take: 20,
        include: { user: { select: { username: true } } },
      },
    },
  });
  if (!plot) throw ApiError.notFound("Plot not found");
  return plot;
}

/** Direct primary-market purchase: buying unowned land straight from the
 * platform at its listed platform price. Tracked as TransactionType
 * PLATFORM_PURCHASE, distinct from player-to-player MARKETPLACE_SALE /
 * AUCTION_SALE transactions. No marketplace fee applies (there is no
 * seller to pay a net amount to). */
export async function buyFromPlatform(userId: string, plotId: string) {
  return prisma.$transaction(async (tx) => {
    const plot = await tx.landPlot.findUnique({ where: { id: plotId } });
    if (!plot) throw ApiError.notFound("Plot not found");
    if (plot.status !== "AVAILABLE") {
      throw ApiError.conflict("This plot is no longer available from the platform");
    }

    await applyLedgerEntry(tx, {
      type: "PLATFORM_PURCHASE",
      grossCents: plot.platformPriceCents,
      fromUserId: userId,
      toUserId: null,
      plotId: plot.id,
      description: `Purchased plot (${plot.x}, ${plot.y}) directly from the platform`,
      applyPlatformFee: false,
    });

    await transferOwnership(tx, {
      plotId: plot.id,
      fromUserId: null,
      toUserId: userId,
      priceCents: plot.platformPriceCents,
      via: "PLATFORM_PURCHASE",
    });

    await notifyUser(
      userId,
      {
        type: "LAND_PURCHASED",
        title: "Land purchased",
        message: `You purchased plot (${plot.x}, ${plot.y}) for the first time.`,
        data: { plotId: plot.id },
      },
      tx
    );

    return tx.landPlot.findUniqueOrThrow({ where: { id: plotId } });
  });
}
