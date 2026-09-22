import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type TxClient = Prisma.TransactionClient;

export interface NotifyInput {
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export async function notifyUser(userId: string, input: NotifyInput, tx: TxClient | typeof prisma = prisma) {
  return tx.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listNotifications(userId: string, unreadOnly = false) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
