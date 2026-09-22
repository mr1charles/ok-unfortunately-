import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type TxClient = Prisma.TransactionClient;

export interface AdminActionInput {
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Every administrative action that touches game state MUST call this. It is
 * the audit trail required before any admin action affecting a production
 * user or world is considered acceptable - see AdminActionLog in
 * schema.prisma. Never bypass this when writing a new admin capability.
 */
export async function logAdminAction(adminId: string, input: AdminActionInput, tx: TxClient | typeof prisma = prisma) {
  return tx.adminActionLog.create({
    data: {
      adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listAdminActionLog(limit = 200) {
  return prisma.adminActionLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { admin: { select: { username: true } } },
  });
}
