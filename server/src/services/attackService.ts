import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { creditUser, deductCreditsClamped } from "./creditService.js";
import { getActiveDefense, consumeDefenseCharge } from "./defenseService.js";
import { notifyUser } from "./notificationService.js";
import { logAdminAction } from "./adminActionLogService.js";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export async function getOrCreateAttackConfig() {
  const existing = await prisma.attackConfig.findFirst();
  if (existing) return existing;
  return prisma.attackConfig.create({ data: {} });
}

export interface UpdateAttackConfigParams {
  maxAttacksPerDay?: number;
  successRatePct?: number;
  criticalRatePct?: number;
  failRatePct?: number;
  creditRewardMin?: number;
  creditRewardMax?: number;
  criticalRewardMin?: number;
  criticalRewardMax?: number;
  attacksEnabled?: boolean;
}

export async function updateAttackConfig(adminId: string, params: UpdateAttackConfigParams, reason?: string) {
  const current = await getOrCreateAttackConfig();
  const next = { ...current, ...params };

  const probabilitySum = next.successRatePct + next.criticalRatePct + next.failRatePct;
  if (probabilitySum !== 100) {
    throw ApiError.badRequest(
      `successRatePct + criticalRatePct + failRatePct must add up to 100 (got ${probabilitySum})`
    );
  }
  if (next.creditRewardMin > next.creditRewardMax || next.criticalRewardMin > next.criticalRewardMax) {
    throw ApiError.badRequest("Reward minimums cannot exceed their maximums");
  }

  const updated = await prisma.attackConfig.update({
    where: { id: current.id },
    data: { ...params, updatedById: adminId },
  });

  await logAdminAction(adminId, {
    action: "UPDATE_ATTACK_CONFIG",
    targetType: "AttackConfig",
    targetId: String(updated.id),
    reason,
    metadata: { ...params },
  });

  return updated;
}

export async function getDailyAllowance(userId: string) {
  const date = todayKey();
  const config = await getOrCreateAttackConfig();
  const existing = await prisma.dailyAttackAllowance.findUnique({ where: { userId_date: { userId, date } } });
  return {
    date,
    attacksUsed: existing?.attacksUsed ?? 0,
    maxAttacksPerDay: config.maxAttacksPerDay,
    remaining: Math.max(0, config.maxAttacksPerDay - (existing?.attacksUsed ?? 0)),
  };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Picks a random property in `worldId` not owned by `userId`. Throws a
 * friendly error if no eligible target exists yet (e.g. an empty world). */
async function pickRandomTarget(worldId: string, userId: string) {
  const count = await prisma.property.count({ where: { worldId, ownerId: { not: userId } } });
  if (count === 0) {
    throw ApiError.conflict("No other players own property in this world yet - nobody to attack!");
  }
  const skip = Math.floor(Math.random() * count);
  const [target] = await prisma.property.findMany({
    where: { worldId, ownerId: { not: userId } },
    skip,
    take: 1,
  });
  if (!target) throw ApiError.conflict("Could not find an eligible target, try again");
  return target;
}

export interface AttackOutcome {
  attack: Awaited<ReturnType<typeof prisma.attack.findUniqueOrThrow>>;
  result: "SUCCESS" | "BLOCKED" | "FAILED" | "CRITICAL";
  message: string;
}

/**
 * Executes one of the player's (up to `maxAttacksPerDay`) daily attacks
 * against a randomly-selected other player's property. Purchased pixel
 * ownership is never touched by an attack - only credits and defense
 * charges move. See schema.prisma `Attack`/`Defense`/`AttackConfig`.
 */
export async function executeAttack(attackerId: string, worldId: string): Promise<AttackOutcome> {
  const config = await getOrCreateAttackConfig();
  if (!config.attacksEnabled) {
    throw ApiError.forbidden("Attacks are temporarily disabled by an administrator");
  }

  const date = todayKey();
  const allowance = await prisma.dailyAttackAllowance.upsert({
    where: { userId_date: { userId: attackerId, date } },
    create: { userId: attackerId, date, attacksUsed: 0 },
    update: {},
  });
  if (allowance.attacksUsed >= config.maxAttacksPerDay) {
    throw ApiError.conflict(`You've used all ${config.maxAttacksPerDay} of your attacks today. Come back tomorrow!`);
  }

  const targetProperty = await pickRandomTarget(worldId, attackerId);
  const defense = await getActiveDefense(targetProperty.id);

  const attack = await prisma.$transaction(async (tx) => {
    await tx.dailyAttackAllowance.update({
      where: { userId_date: { userId: attackerId, date } },
      data: { attacksUsed: { increment: 1 } },
    });

    if (defense) {
      await consumeDefenseCharge(defense.id);
      return tx.attack.create({
        data: {
          worldId,
          attackerId,
          defenderId: targetProperty.ownerId,
          targetPropertyId: targetProperty.id,
          result: "BLOCKED",
          attackerCreditsChange: 0,
          defenderCreditsChange: 0,
          defenseUsed: defense.kind,
        },
      });
    }

    const roll = Math.random() * 100;
    let result: "SUCCESS" | "FAILED" | "CRITICAL";
    if (roll < config.criticalRatePct) result = "CRITICAL";
    else if (roll < config.criticalRatePct + config.failRatePct) result = "FAILED";
    else result = "SUCCESS";

    let attackerGain = 0;
    let defenderLoss = 0;

    if (result === "SUCCESS") {
      attackerGain = randomInt(config.creditRewardMin, config.creditRewardMax);
      defenderLoss = randomInt(config.creditRewardMin, config.creditRewardMax);
      await creditUser(tx, attackerId, attackerGain, `Successful attack on a rival property`, "ATTACK", targetProperty.id);
      defenderLoss = await deductCreditsClamped(
        tx,
        targetProperty.ownerId,
        defenderLoss,
        `Lost credits defending against an attack`,
        "ATTACK",
        targetProperty.id
      );
    } else if (result === "CRITICAL") {
      attackerGain = randomInt(config.criticalRewardMin, config.criticalRewardMax);
      await creditUser(tx, attackerId, attackerGain, `Critical attack bonus`, "ATTACK", targetProperty.id);
    }

    return tx.attack.create({
      data: {
        worldId,
        attackerId,
        defenderId: targetProperty.ownerId,
        targetPropertyId: targetProperty.id,
        result,
        attackerCreditsChange: attackerGain,
        defenderCreditsChange: -defenderLoss,
      },
    });
  });

  const messages: Record<string, string> = {
    BLOCKED: `Your attack was blocked by the defender's ${defense?.kind.toLowerCase().replace("_", " ")}.`,
    SUCCESS: `Your attack succeeded! You gained ${attack.attackerCreditsChange} credits.`,
    FAILED: `Your attack failed and had no effect.`,
    CRITICAL: `Critical hit! You gained ${attack.attackerCreditsChange} bonus credits.`,
  };

  await notifyUser(attackerId, {
    type: "SYSTEM",
    title: "Attack result",
    message: messages[attack.result],
    data: { attackId: attack.id, result: attack.result },
  });
  await notifyUser(targetProperty.ownerId, {
    type: "SYSTEM",
    title: attack.result === "BLOCKED" ? "Your defense blocked an attack!" : "Your property was attacked",
    message:
      attack.result === "BLOCKED"
        ? `A ${attack.defenseUsed?.toLowerCase().replace("_", " ")} blocked an incoming attack.`
        : attack.result === "SUCCESS"
          ? `You lost ${Math.abs(attack.defenderCreditsChange)} credits in an attack. Consider building a shield!`
          : `You were attacked but suffered no losses.`,
    data: { attackId: attack.id, result: attack.result },
  });

  return { attack, result: attack.result, message: messages[attack.result] };
}

export async function getAttackHistory(userId: string) {
  const [made, received] = await Promise.all([
    prisma.attack.findMany({
      where: { attackerId: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { defender: { select: { username: true } }, targetProperty: { select: { worldId: true, minX: true, minY: true } } },
    }),
    prisma.attack.findMany({
      where: { defenderId: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { attacker: { select: { username: true } }, targetProperty: { select: { worldId: true, minX: true, minY: true } } },
    }),
  ]);
  return { made, received };
}
