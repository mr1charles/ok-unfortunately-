import { api } from "./client";
import type { WorldSummaryDTO } from "@pixel-estates/shared";

export interface AttackConfigDTO {
  id: number;
  maxAttacksPerDay: number;
  successRatePct: number;
  criticalRatePct: number;
  failRatePct: number;
  creditRewardMin: number;
  creditRewardMax: number;
  criticalRewardMin: number;
  criticalRewardMax: number;
  attacksEnabled: boolean;
}

export interface AdminActionLogRow {
  id: string;
  admin: { username: string };
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function fetchWorlds(includeTestCopies = false) {
  return api.get<{ worlds: WorldSummaryDTO[] }>(`/worlds?includeTestCopies=${includeTestCopies}`);
}

export function createTestWorldCopy(worldId: string, reason?: string) {
  return api.post<{ world: WorldSummaryDTO }>(`/admin/worlds/${worldId}/test-copy`, { reason });
}

export function deleteWorld(worldId: string, reason?: string) {
  return api.delete<{ deleted: boolean }>(`/admin/worlds/${worldId}`);
}

export function setWorldActive(worldId: string, isActive: boolean, reason?: string) {
  return api.patch<{ world: WorldSummaryDTO }>(`/admin/worlds/${worldId}/active`, { isActive, reason });
}

export function setWorldPixelPrice(worldId: string, pixelPriceCents: number, reason?: string) {
  return api.patch<{ world: WorldSummaryDTO }>(`/admin/worlds/${worldId}/pixel-price`, { pixelPriceCents, reason });
}

export function fetchAttackConfig() {
  return api.get<{ config: AttackConfigDTO }>("/admin/worlds/attack-config");
}

export function updateAttackConfig(patch: Partial<AttackConfigDTO> & { reason?: string }) {
  return api.patch<{ config: AttackConfigDTO }>("/admin/worlds/attack-config", patch);
}

export function fetchActionLog(limit = 100) {
  return api.get<{ log: AdminActionLogRow[] }>(`/admin/worlds/action-log?limit=${limit}`);
}

export function sandboxGrantCash(worldId: string, userId: string, amountCents: number, reason: string) {
  return api.post(`/admin/worlds/${worldId}/sandbox/grant-cash`, { userId, amountCents, reason });
}

export function sandboxGrantCredits(worldId: string, userId: string, amount: number, reason: string) {
  return api.post(`/admin/worlds/${worldId}/sandbox/grant-credits`, { userId, amount, reason });
}

export interface EventDTO {
  id: string;
  key: string;
  name: string;
  description: string | null;
  emoji: string;
  isActive: boolean;
  startAt: string;
  endAt: string;
  items: { id: string; objectType: string; name: string; emoji: string }[];
}

export function fetchEvents() {
  return api.get<{ events: EventDTO[] }>("/events");
}

export function createEvent(data: {
  key: string;
  name: string;
  description?: string;
  emoji?: string;
  worldId?: string;
  startAt: string;
  endAt: string;
  items: { objectType: string; name: string; emoji?: string }[];
}) {
  return api.post<{ event: EventDTO }>("/admin/worlds/events", data);
}

export function setEventActive(eventId: string, isActive: boolean) {
  return api.patch<{ event: EventDTO }>(`/admin/worlds/events/${eventId}/active`, { isActive });
}
