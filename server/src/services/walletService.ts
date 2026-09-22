import type { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { paymentProvider } from "../lib/payments/index.js";
import { computeFeeSplit, getPlatformFeePercent } from "./platformConfigService.js";
import { notifyUser } from "./notificationService.js";

type TxClient = Prisma.TransactionClient;

/**
 * All wallet mutations live here. This is the ONLY module allowed to write
 * to the Balance table. Every function either runs in its own atomic
 * `prisma.$transaction`, or accepts a `tx` client so callers (land/
 * marketplace/auction services) can compose the ledger movement with their
 * own ownership/listing/auction writes as a single atomic unit - the
 * balance change and the state change that caused it can never diverge.
 *
 * The client-supplied balance is NEVER trusted: every read here hits the
 * database fresh, and debits use a conditional `updateMany` guarded by
 * `balanceCents >= amount` so concurrent requests can never drive a
 * balance negative (classic double-spend race).
 */

export async function ensureBalanceRow(userId: string, startingCents = 0, tx: TxClient | typeof prisma = prisma) {
  const existing = await tx.balance.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.balance.create({ data: { userId, balanceCents: startingCents } });
}

export async function getBalanceCents(userId: string): Promise<number> {
  const bal = await prisma.balance.findUnique({ where: { userId } });
  return bal?.balanceCents ?? 0;
}

/** Atomically debit `amountCents` from a user's balance. Throws ApiError.insufficientFunds if the
 * balance is too low. Safe to call concurrently - never allows a negative balance. */
export async function debitBalance(tx: TxClient, userId: string, amountCents: number) {
  if (amountCents <= 0) throw ApiError.badRequest("Amount must be positive");
  const result = await tx.balance.updateMany({
    where: { userId, balanceCents: { gte: amountCents } },
    data: { balanceCents: { decrement: amountCents } },
  });
  if (result.count !== 1) {
    throw ApiError.insufficientFunds();
  }
}

export async function creditBalance(tx: TxClient, userId: string, amountCents: number) {
  if (amountCents < 0) throw ApiError.badRequest("Amount must not be negative");
  if (amountCents === 0) return;
  await ensureBalanceRow(userId, 0, tx);
  await tx.balance.update({
    where: { userId },
    data: { balanceCents: { increment: amountCents } },
  });
}

export interface LedgerParams {
  type: TransactionType;
  grossCents: number;
  fromUserId?: string | null;
  toUserId?: string | null;
  plotId?: string | null;
  listingId?: string | null;
  auctionId?: string | null;
  propertyId?: string | null;
  propertyListingId?: string | null;
  propertyAuctionId?: string | null;
  description: string;
  /** When true (marketplace/auction sales), the platform fee is deducted from
   * the gross amount before crediting `toUserId`. Platform-direct purchases
   * and deposits pass false since there is no revenue split to apply. */
  applyPlatformFee: boolean;
}

/**
 * Core ledger primitive: optionally debits the buyer, computes the platform
 * fee split (if applicable), credits the recipient with the net amount, and
 * writes one immutable Transaction row. Composable inside a larger
 * `prisma.$transaction` so it can be combined with ownership transfers.
 */
export async function applyLedgerEntry(tx: TxClient, params: LedgerParams) {
  const feePercent = params.applyPlatformFee ? await getPlatformFeePercent() : 0;
  const { feeCents, netCents } = params.applyPlatformFee
    ? computeFeeSplit(params.grossCents, feePercent)
    : { feeCents: 0, netCents: params.grossCents };

  if (params.fromUserId) {
    await debitBalance(tx, params.fromUserId, params.grossCents);
  }
  if (params.toUserId) {
    await creditBalance(tx, params.toUserId, netCents);
  }

  return tx.transaction.create({
    data: {
      type: params.type,
      grossCents: params.grossCents,
      feeCents,
      netCents,
      feePercentApplied: feePercent,
      fromUserId: params.fromUserId ?? null,
      toUserId: params.toUserId ?? null,
      plotId: params.plotId ?? null,
      listingId: params.listingId ?? null,
      auctionId: params.auctionId ?? null,
      propertyId: params.propertyId ?? null,
      propertyListingId: params.propertyListingId ?? null,
      propertyAuctionId: params.propertyAuctionId ?? null,
      description: params.description,
    },
  });
}

/** Mock/real deposit: adds funds to a user's wallet via the payment provider. */
export async function depositFunds(userId: string, amountCents: number, source: string) {
  if (amountCents <= 0) throw ApiError.badRequest("Deposit amount must be positive");
  const result = await paymentProvider.createDeposit({ userId, amountCents, metadata: { source } });
  if (result.status !== "succeeded") {
    throw ApiError.badRequest("Deposit could not be completed");
  }
  const transaction = await prisma.$transaction(async (tx) => {
    await ensureBalanceRow(userId, 0, tx);
    await creditBalance(tx, userId, amountCents);
    return tx.transaction.create({
      data: {
        type: "DEPOSIT",
        grossCents: amountCents,
        feeCents: 0,
        netCents: amountCents,
        feePercentApplied: 0,
        toUserId: userId,
        description: `Wallet top-up via ${paymentProvider.name} (${source}) [${result.providerRef}]`,
      },
    });
  });
  await notifyUser(userId, {
    type: "SYSTEM",
    title: "Funds added",
    message: `Your wallet was topped up.`,
  });
  return transaction;
}

/** Full transaction history for a user, both as buyer/payer and as
 * seller/recipient - the "Transactions" screen in My Land / Settings. */
export async function listUserTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      plot: { select: { x: true, y: true } },
      fromUser: { select: { username: true } },
      toUser: { select: { username: true } },
    },
  });
}

/** Withdrawal (cash-out) stub. Wired to the same PaymentProvider interface a
 * real payout flow (e.g. Stripe Connect transfers) would use. */
export async function withdrawFunds(userId: string, amountCents: number) {
  if (amountCents <= 0) throw ApiError.badRequest("Withdrawal amount must be positive");
  const transaction = await prisma.$transaction(async (tx) => {
    await debitBalance(tx, userId, amountCents);
    return tx.transaction.create({
      data: {
        type: "WITHDRAWAL",
        grossCents: amountCents,
        feeCents: 0,
        netCents: amountCents,
        feePercentApplied: 0,
        fromUserId: userId,
        description: `Wallet withdrawal request`,
      },
    });
  });
  const result = await paymentProvider.createWithdrawal({ userId, amountCents });
  return { transaction, providerRef: result.providerRef, status: result.status };
}
