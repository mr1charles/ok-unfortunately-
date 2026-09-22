import { DEFAULT_MINING_CREDIT_MAX, DEFAULT_MINING_CREDIT_MIN, MINING_COOLDOWN_MS } from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { creditUser } from "./creditService.js";

/**
 * Mining/interacting with your own property never touches purchased pixel
 * ownership - it is purely a credit-earning gameplay loop layered on top.
 * Cooldown is tracked via the most recent MINING CreditTransaction for this
 * property rather than a dedicated table, keeping the schema smaller.
 */
export async function mineProperty(userId: string, propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw ApiError.notFound("Property not found");
  if (property.ownerId !== userId) throw ApiError.forbidden("You can only mine your own property");

  const lastMine = await prisma.creditTransaction.findFirst({
    where: { userId, relatedType: "MINING", relatedId: propertyId },
    orderBy: { createdAt: "desc" },
  });
  if (lastMine) {
    const elapsed = Date.now() - lastMine.createdAt.getTime();
    if (elapsed < MINING_COOLDOWN_MS) {
      throw ApiError.conflict(`This property needs to recharge for ${Math.ceil((MINING_COOLDOWN_MS - elapsed) / 1000)}s before mining again`);
    }
  }

  const reward = Math.floor(Math.random() * (DEFAULT_MINING_CREDIT_MAX - DEFAULT_MINING_CREDIT_MIN + 1)) + DEFAULT_MINING_CREDIT_MIN;

  const result = await prisma.$transaction(async (tx) => {
    await creditUser(tx, userId, reward, "Mined resources from property", "MINING", propertyId);
    return tx.creditBalance.findUniqueOrThrow({ where: { userId } });
  });

  return { reward, credits: result.credits };
}
