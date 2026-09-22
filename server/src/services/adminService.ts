import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";

export async function getPlatformStats() {
  const [
    totalUsers,
    totalPlots,
    plotsOwned,
    activeListings,
    activeAuctions,
    marketplaceSaleAgg,
    auctionSaleAgg,
    platformPurchaseAgg,
    totalTransactions,
    openReports,
    flaggedTransactions,
    bannedUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.landPlot.count(),
    prisma.landPlot.count({ where: { ownerId: { not: null } } }),
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.auction.count({ where: { status: "ACTIVE" } }),
    prisma.transaction.aggregate({
      where: { type: "MARKETPLACE_SALE" },
      _sum: { grossCents: true, feeCents: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: "AUCTION_SALE" },
      _sum: { grossCents: true, feeCents: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: "PLATFORM_PURCHASE" },
      _sum: { grossCents: true },
      _count: true,
    }),
    prisma.transaction.count(),
    prisma.report.count({ where: { status: "OPEN" } }),
    prisma.transaction.count({ where: { flagged: true } }),
    prisma.user.count({ where: { isBanned: true } }),
  ]);

  const marketplaceVolumeCents =
    (marketplaceSaleAgg._sum.grossCents ?? 0) + (auctionSaleAgg._sum.grossCents ?? 0);
  const platformFeesCollectedCents =
    (marketplaceSaleAgg._sum.feeCents ?? 0) + (auctionSaleAgg._sum.feeCents ?? 0);

  return {
    totalUsers,
    bannedUsers,
    totalPlots,
    plotsOwned,
    plotsAvailable: totalPlots - plotsOwned,
    landSoldCount: marketplaceSaleAgg._count + auctionSaleAgg._count,
    activeListings,
    activeAuctions,
    marketplaceVolumeCents,
    platformFeesCollectedCents,
    platformPrimarySalesCents: platformPurchaseAgg._sum.grossCents ?? 0,
    platformPrimarySalesCount: platformPurchaseAgg._count,
    totalTransactions,
    openReports,
    flaggedTransactions,
  };
}

export async function listUsers(query?: string) {
  return prisma.user.findMany({
    where: query
      ? { OR: [{ username: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] }
      : {},
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isBanned: true,
      createdAt: true,
      balance: { select: { balanceCents: true } },
      _count: { select: { ownedPlots: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function setUserBanned(userId: string, banned: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "ADMIN" && banned) {
    throw ApiError.badRequest("Cannot ban an admin account");
  }
  return prisma.user.update({ where: { id: userId }, data: { isBanned: banned } });
}

export async function listRecentTransactions(limit = 100) {
  return prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      fromUser: { select: { username: true } },
      toUser: { select: { username: true } },
      plot: { select: { x: true, y: true } },
    },
  });
}

export async function setTransactionFlag(transactionId: string, flagged: boolean, reason?: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw ApiError.notFound("Transaction not found");
  return prisma.transaction.update({
    where: { id: transactionId },
    data: { flagged, flagReason: flagged ? (reason ?? "Flagged by admin") : null },
  });
}

export async function setPlotUnavailable(plotId: string, unavailable: boolean) {
  const plot = await prisma.landPlot.findUnique({ where: { id: plotId } });
  if (!plot) throw ApiError.notFound("Plot not found");
  return prisma.landPlot.update({
    where: { id: plotId },
    data: { status: unavailable ? "UNAVAILABLE" : plot.ownerId ? "OWNED" : "AVAILABLE" },
  });
}
