import { api } from "./client";
import type { Listing } from "../types";

export function fetchListings() {
  return api.get<{ listings: Listing[] }>("/marketplace/listings");
}

export function fetchListing(id: string) {
  return api.get<{ listing: Listing }>(`/marketplace/listings/${id}`);
}

export function createListing(data: { plotId: string; priceCents: number; description?: string }) {
  return api.post<{ listing: Listing }>("/marketplace/listings", data);
}

export function buyListing(id: string) {
  return api.post<{ listing: Listing }>(`/marketplace/listings/${id}/buy`);
}

export function cancelListing(id: string) {
  return api.delete<{ listing: Listing }>(`/marketplace/listings/${id}`);
}
