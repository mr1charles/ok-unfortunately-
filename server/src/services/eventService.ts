import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { logAdminAction } from "./adminActionLogService.js";

export async function listEvents(activeOnly = false) {
  const now = new Date();
  return prisma.event.findMany({
    where: activeOnly ? { isActive: true, startAt: { lte: now }, endAt: { gte: now } } : {},
    include: { items: true, world: { select: { key: true, name: true } } },
    orderBy: { startAt: "desc" },
  });
}

export async function getEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { items: true } });
  if (!event) throw ApiError.notFound("Event not found");
  return event;
}

export interface CreateEventParams {
  key: string;
  name: string;
  description?: string;
  emoji?: string;
  worldId?: string;
  startAt: Date;
  endAt: Date;
  items: { objectType: string; name: string; emoji?: string; isLimited?: boolean }[];
}

export async function createEvent(adminId: string, params: CreateEventParams) {
  const existing = await prisma.event.findUnique({ where: { key: params.key } });
  if (existing) throw ApiError.conflict("An event with that key already exists");

  const event = await prisma.event.create({
    data: {
      key: params.key,
      name: params.name,
      description: params.description,
      emoji: params.emoji ?? "🎉",
      worldId: params.worldId,
      startAt: params.startAt,
      endAt: params.endAt,
      items: {
        create: params.items.map((i) => ({
          objectType: i.objectType,
          name: i.name,
          emoji: i.emoji ?? "🎁",
          isLimited: i.isLimited ?? true,
        })),
      },
    },
    include: { items: true },
  });

  await logAdminAction(adminId, {
    action: "CREATE_EVENT",
    targetType: "Event",
    targetId: event.id,
    metadata: { key: event.key, itemCount: event.items.length },
  });

  return event;
}

export async function setEventActive(adminId: string, eventId: string, isActive: boolean) {
  const event = await prisma.event.update({ where: { id: eventId }, data: { isActive } });
  await logAdminAction(adminId, {
    action: isActive ? "ACTIVATE_EVENT" : "END_EVENT",
    targetType: "Event",
    targetId: eventId,
  });
  return event;
}

/** Grants an event item to a player - only allowed while the event is
 * active, unless the player already owns it (so it never disappears once
 * acquired even after the event ends). */
export async function claimEventItem(userId: string, eventItemId: string) {
  const eventItem = await prisma.eventItem.findUnique({ where: { id: eventItemId }, include: { event: true } });
  if (!eventItem) throw ApiError.notFound("Event item not found");

  const now = new Date();
  const eventLive = eventItem.event.isActive && eventItem.event.startAt <= now && eventItem.event.endAt >= now;
  if (!eventLive) {
    throw ApiError.forbidden("This event has ended - the item is no longer available to claim");
  }

  return prisma.playerEventItem.upsert({
    where: { userId_eventItemId: { userId, eventItemId } },
    create: { userId, eventItemId },
    update: {},
  });
}

export async function listPlayerEventItems(userId: string) {
  return prisma.playerEventItem.findMany({
    where: { userId },
    include: { eventItem: { include: { event: { select: { name: true, key: true } } } } },
    orderBy: { acquiredAt: "desc" },
  });
}
