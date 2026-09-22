import { api } from "./client";
import type { Plot, PlotDetail } from "../types";

export function fetchWorldMeta() {
  return api.get<{ width: number; height: number; platformFeePercent: number }>("/world/meta");
}

export function fetchPlots(filters: { status?: string; ownerId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.ownerId) params.set("ownerId", filters.ownerId);
  const qs = params.toString();
  return api.get<{ plots: Plot[] }>(`/world/plots${qs ? `?${qs}` : ""}`);
}

export function fetchPlot(id: string) {
  return api.get<{ plot: PlotDetail }>(`/world/plots/${id}`);
}

export function buyPlotFromPlatform(id: string) {
  return api.post<{ plot: Plot }>(`/world/plots/${id}/buy`);
}
