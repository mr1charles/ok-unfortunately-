import { api } from "./client";
import type { Report } from "../types";

export function fileReport(data: { targetType: "LISTING" | "AUCTION" | "USER" | "PLOT"; targetId: string; plotId?: string; reason: string }) {
  return api.post<{ report: Report }>("/reports", data);
}
