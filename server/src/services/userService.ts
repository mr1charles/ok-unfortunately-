import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { getBalanceCents } from "./walletService.js";

/** Full "me" payload consumed by the client's AuthContext + sidebar HUD. */
export async function getMePayload(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { character: true },
  });
  if (!user) throw ApiError.notFound("User not found");

  const [balanceCents, landCount, activeListings, activeBidsAuctions] = await Promise.all([
    getBalanceCents(userId),
    prisma.landPlot.count({ where: { ownerId: userId } }),
    prisma.listing.count({ where: { sellerId: userId, status: "ACTIVE" } }),
    prisma.auction.findMany({
      where: { status: "ACTIVE", bids: { some: { bidderId: userId } } },
      select: { id: true },
    }),
  ]);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    hasOnboarded: user.hasOnboarded,
    createdAt: user.createdAt,
    character: user.character,
    balanceCents,
    landCount,
    activeListings,
    activeBids: activeBidsAuctions.length,
  };
}

export async function completeOnboarding(userId: string) {
  return prisma.user.update({ where: { id: userId }, data: { hasOnboarded: true } });
}
