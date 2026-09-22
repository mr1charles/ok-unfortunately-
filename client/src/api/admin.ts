import { api } from "./client";
import type { AdminStats, AdminUserRow, LedgerTransaction, Report } from "../types";

export function fetchAdminStats() {
  return api.get<{ stats: AdminStats }>("/admin/stats");
}

export function fetchAdminConfig() {
  return api.get<{ config: { id: number; platformFeePercent: number } }>("/admin/config");
}

export function updatePlatformFee(platformFeePercent: number) {
  return api.patch<{ config: { id: number; platformFeePercent: number } }>("/admin/config", { platformFeePercent });
}

export function fetchAdminUsers(query?: string) {
  return api.get<{ users: AdminUserRow[] }>(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`);
}

export function setUserBanned(userId: string, banned: boolean) {
  return api.patch<{ user: AdminUserRow }>(`/admin/users/${userId}/ban`, { banned });
}

export function fetchAdminTransactions(limit = 100) {
  return api.get<{ transactions: LedgerTransaction[] }>(`/admin/transactions?limit=${limit}`);
}

export function flagTransaction(id: string, flagged: boolean, reason?: string) {
  return api.patch<{ transaction: LedgerTransaction }>(`/admin/transactions/${id}/flag`, { flagged, reason });
}

export function pauseListing(id: string, paused: boolean) {
  return api.patch<{ listing: unknown }>(`/admin/listings/${id}/pause`, { paused });
}

export function adminRemoveListing(id: string) {
  return api.delete<{ listing: unknown }>(`/admin/listings/${id}`);
}

export function adminCancelAuction(id: string) {
  return api.delete<{ auction: unknown }>(`/admin/auctions/${id}`);
}

export function setPlotAvailability(id: string, unavailable: boolean) {
  return api.patch<{ plot: unknown }>(`/admin/plots/${id}/availability`, { unavailable });
}

export function fetchAdminReports(status?: string) {
  return api.get<{ reports: Report[] }>(`/admin/reports${status ? `?status=${status}` : ""}`);
}

export function resolveReport(id: string, status: "RESOLVED" | "DISMISSED") {
  return api.patch<{ report: Report }>(`/admin/reports/${id}`, { status });
}
