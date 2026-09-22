import type { DefenseKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { logAdminAction } from "./adminActionLogService.js";
import { getWorldById } from "./worldService.js";
import { purchasePixels, type PixelCoord } from "./pixelService.js";
import { depositFunds } from "./walletService.js";
import { creditUser, ensureCreditBalance } from "./creditService.js";
import { executeAttack } from "./attackService.js";
import { settlePropertyAuction } from "./propertyMarketService.js";

/**
 * Every function here is the "admin sandbox" surface described in the spec:
 * unlimited test money/credits, instant purchases, forced attacks/shields,
 * forced auction endings, bulk decoration spawning. To make it structurally
 * impossible for these to touch production, every function requires the
 * target world to be `isTestCopy: true` UNLESS `allowProduction` is
 * explicitly passed AND true - and every call still writes an
 * AdminActionLog row regardless of environment.
 */

async function assertSandboxAllowed(worldId: string, allowProduction: boolean) {
  const world = await getWorldById(worldId);
  if (!world.isTestCopy && !allowProduction) {
    throw ApiError.forbidden(
      "Sandbox actions only run in a test-copy world by default. Pass allowProduction=true to explicitly authorize a production action (this is still fully logged)."
    );
  }
  return world;
}

export async function sandboxGrantCash(
  adminId: string,
  worldId: string,
  targetUserId: string,
  amountCents: number,
  reason: string,
  allowProduction = false
) {
  await assertSandboxAllowed(worldId, allowProduction);
  const transaction = await depositFunds(targetUserId, amountCents, "admin-sandbox-grant");
  await logAdminAction(adminId, {
    action: "SANDBOX_GRANT_CASH",
    targetType: "User",
    targetId: targetUserId,
    reason,
    metadata: { worldId, amountCents, allowProduction },
  });
  return transaction;
}

export async function sandboxGrantCredits(
  adminId: string,
  worldId: string,
  targetUserId: string,
  amount: number,
  reason: string,
  allowProduction = false
) {
  await assertSandboxAllowed(worldId, allowProduction);
  await prisma.$transaction(async (tx) => {
    await ensureCreditBalance(targetUserId, tx);
    await creditUser(tx, targetUserId, amount, `Admin sandbox grant: ${reason}`, "ADMIN_GRANT", adminId);
  });
  await logAdminAction(adminId, {
    action: "SANDBOX_GRANT_CREDITS",
    targetType: "User",
    targetId: targetUserId,
    reason,
    metadata: { worldId, amount, allowProduction },
  });
  return { granted: amount };
}

export async function sandboxInstantBuy(
  adminId: string,
  worldId: string,
  targetUserId: string,
  coords: PixelCoord[],
  reason: string,
  allowProduction = false
) {
  await assertSandboxAllowed(worldId, allowProduction);
  const world = await getWorldById(worldId);
  const neededCents = coords.length * world.pixelPriceCents;

  // Auto top-up so the instant-buy can never fail on insufficient funds in
  // sandbox mode - still goes through the exact same purchasePixels path
  // (union-find merge, ledger entry, ownedPixelCount) as a real purchase.
  await depositFunds(targetUserId, neededCents + 1000, "admin-sandbox-instant-buy");

  const result = await purchasePixels(targetUserId, worldId, { coords });
  await logAdminAction(adminId, {
    action: "SANDBOX_INSTANT_BUY",
    targetType: "User",
    targetId: targetUserId,
    reason,
    metadata: { worldId, pixelCount: coords.length, allowProduction },
  });
  return result;
}

export async function sandboxTriggerAttack(adminId: string, worldId: string, attackerId: string, reason: string, allowProduction = false) {
  await assertSandboxAllowed(worldId, allowProduction);
  // Reset today's allowance so the forced attack is never blocked by the
  // attacker's normal daily limit.
  const date = new Date().toISOString().slice(0, 10);
  await prisma.dailyAttackAllowance.upsert({
    where: { userId_date: { userId: attackerId, date } },
    create: { userId: attackerId, date, attacksUsed: 0 },
    update: { attacksUsed: 0 },
  });
  const outcome = await executeAttack(attackerId, worldId);
  await logAdminAction(adminId, {
    action: "SANDBOX_TRIGGER_ATTACK",
    targetType: "Attack",
    targetId: outcome.attack.id,
    reason,
    metadata: { worldId, attackerId, result: outcome.result, allowProduction },
  });
  return outcome;
}

export async function sandboxForceShield(
  adminId: string,
  worldId: string,
  propertyId: string,
  kind: DefenseKind,
  charges: number,
  reason: string,
  allowProduction = false
) {
  await assertSandboxAllowed(worldId, allowProduction);
  const defense = await prisma.defense.create({ data: { propertyId, kind, charges } });
  await logAdminAction(adminId, {
    action: "SANDBOX_FORCE_SHIELD",
    targetType: "Property",
    targetId: propertyId,
    reason,
    metadata: { worldId, kind, charges, allowProduction },
  });
  return defense;
}

export async function sandboxEndAuctionNow(adminId: string, worldId: string, auctionId: string, reason: string, allowProduction = false) {
  await assertSandboxAllowed(worldId, allowProduction);
  await prisma.propertyAuction.update({ where: { id: auctionId }, data: { endAt: new Date(Date.now() - 1000) } });
  const settled = await settlePropertyAuction(auctionId);
  await logAdminAction(adminId, {
    action: "SANDBOX_END_AUCTION",
    targetType: "PropertyAuction",
    targetId: auctionId,
    reason,
    metadata: { worldId, allowProduction },
  });
  return settled;
}

export async function sandboxSpawnDecorations(
  adminId: string,
  worldId: string,
  propertyId: string,
  objectType: string,
  count: number,
  reason: string,
  allowProduction = false
) {
  await assertSandboxAllowed(worldId, allowProduction);
  const property = await prisma.property.findUnique({ where: { id: propertyId }, include: { pixels: true, decorations: true } });
  if (!property) throw ApiError.notFound("Property not found");

  const occupied = new Set(property.decorations.map((d) => `${d.x},${d.y}`));
  const available = property.pixels.filter((p) => !occupied.has(`${p.x},${p.y}`));
  const toPlace = available.slice(0, Math.min(count, available.length, 1000));

  const created = await prisma.$transaction(
    toPlace.map((p) =>
      prisma.propertyDecoration.create({ data: { propertyId, objectType, x: p.x, y: p.y, placedByUserId: adminId } })
    )
  );

  await logAdminAction(adminId, {
    action: "SANDBOX_SPAWN_DECORATIONS",
    targetType: "Property",
    targetId: propertyId,
    reason,
    metadata: { worldId, objectType, requested: count, placed: created.length, allowProduction },
  });

  return { placed: created.length };
}
