import { PLATFORM_FEE_PERCENT_DEFAULT } from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Single authoritative source of the platform's marketplace fee. Every
 * fee calculation in the app MUST call getPlatformFeePercent() (or receive
 * an already-computed split from computeFeeSplit) rather than hardcoding a
 * number. Admins change the live value via setPlatformFeePercent(), which
 * is exposed through the admin dashboard.
 */

let cachedFeePercent: number | null = null;

export async function getOrCreateConfig() {
  const existing = await prisma.platformConfig.findFirst();
  if (existing) return existing;
  return prisma.platformConfig.create({
    data: { platformFeePercent: PLATFORM_FEE_PERCENT_DEFAULT },
  });
}

export async function getPlatformFeePercent(): Promise<number> {
  if (cachedFeePercent !== null) return cachedFeePercent;
  const config = await getOrCreateConfig();
  cachedFeePercent = config.platformFeePercent;
  return cachedFeePercent;
}

export async function setPlatformFeePercent(percent: number, adminUserId: string) {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw ApiError.badRequest("Fee percent must be an integer between 0 and 100");
  }
  const config = await getOrCreateConfig();
  const updated = await prisma.platformConfig.update({
    where: { id: config.id },
    data: { platformFeePercent: percent, updatedById: adminUserId },
  });
  cachedFeePercent = updated.platformFeePercent;
  return updated;
}

/** Given a gross sale amount and the fee percent in effect, split into (fee, net). */
export function computeFeeSplit(grossCents: number, feePercent: number) {
  const feeCents = Math.round((grossCents * feePercent) / 100);
  const netCents = grossCents - feeCents;
  return { feeCents, netCents };
}
