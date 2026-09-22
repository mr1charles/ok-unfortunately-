import { api } from "./client";
import type { AppNotification } from "../types";

export function fetchNotifications() {
  return api.get<{ notifications: AppNotification[] }>("/notifications");
}

export function fetchUnreadCount() {
  return api.get<{ count: number }>("/notifications/unread-count");
}

export function markRead(id: string) {
  return api.post<void>(`/notifications/${id}/read`);
}

export function markAllRead() {
  return api.post<void>("/notifications/read-all");
}
