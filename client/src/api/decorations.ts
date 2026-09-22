import { api } from "./client";
import type { InventoryItem, LandDecoration } from "../types";
import type { DecorationCatalogEntry } from "@pixel-estates/shared";

export function fetchCatalog() {
  return api.get<{ catalog: DecorationCatalogEntry[] }>("/decorations/catalog");
}

export function fetchInventory() {
  return api.get<{ inventory: InventoryItem[] }>("/decorations/inventory");
}

export function fetchPlotDecorations(plotId: string) {
  return api.get<{ decorations: LandDecoration[] }>(`/decorations/plots/${plotId}`);
}

export function placeDecoration(plotId: string, data: { objectType: string; x: number; y: number; rotation?: number }) {
  return api.post<{ decoration: LandDecoration }>(`/decorations/plots/${plotId}`, data);
}

export function removeDecoration(id: string) {
  return api.delete<{ decoration: LandDecoration }>(`/decorations/${id}`);
}
