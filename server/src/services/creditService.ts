import type { Prisma } from "@prisma/client";
import { STARTING_CREDITS } from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";

type TxClient = Prisma.TransactionClient;

/**
 * Credits are a separate, non-cash gameplay currency (Balance/Transaction
 * above are exclusively real money). Never let credits and cash mix: no
 * function in this file touches Balance, and no function in walletService
 * touches CreditBalance.
 */

export async function ensureCreditBalance(userId: string, tx: TxClient | typeof prisma = prisma) {
  const existing = await tx.creditBalance.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.creditBalance.create({ data: { userId, credits: STARTING_CREDITS } });
}

export async function getCredits(userId: string): Promise<number> {
  const bal = await prisma.creditBalance.findUnique({ where: { userId } });
  return bal?.credits ?? 0;
}

export async function creditUser(
  tx: TxClient,
  userId: string,
  amount: number,
  reason: string,
  relatedType?: string,
  relatedId?: string
) {
  if (amount <= 0) return;
  await ensureCreditBalance(userId, tx);
  await tx.creditBalance.update({ where: { userId }, data: { credits: { increment: amount } } });
  await tx.creditTransaction.create({ data: { userId, amount, reason, relatedType, relatedId } });
}

/** Atomically debits credits, guarded so a balance can never go negative
 * (same conditional-update pattern as walletService.debitBalance). */
export async function spendCredits(
  tx: TxClient,
  userId: string,
  amount: number,
  reason: string,
  relatedType?: string,
  relatedId?: string
) {
  if (amount <= 0) return;
  await ensureCreditBalance(userId, tx);
  const result = await tx.creditBalance.updateMany({
    where: { userId, credits: { gte: amount } },
    data: { credits: { decrement: amount } },
  });
  if (result.count !== 1) {
    throw new ApiError(402, "INSUFFICIENT_CREDITS", "You don't have enough credits for this");
  }
  await tx.creditTransaction.create({ data: { userId, amount: -amount, reason, relatedType, relatedId } });
}

/** Deducts up to `amount` credits, silently clamped at 0 - used for
 * attack-outcome penalties, which should never throw or go negative. */
export async function deductCreditsClamped(
  tx: TxClient,
  userId: string,
  amount: number,
  reason: string,
  relatedType?: string,
  relatedId?: string
) {
  if (amount <= 0) return 0;
  const balance = await ensureCreditBalance(userId, tx);
  const actual = Math.min(amount, balance.credits);
  if (actual <= 0) return 0;
  await tx.creditBalance.update({ where: { userId }, data: { credits: { decrement: actual } } });
  await tx.creditTransaction.create({ data: { userId, amount: -actual, reason, relatedType, relatedId } });
  return actual;
}

export async function listCreditTransactions(userId: string) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
