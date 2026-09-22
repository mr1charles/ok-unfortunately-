import { api } from "./client";
import type { Auction } from "../types";

export function fetchAuctions() {
  return api.get<{ auctions: Auction[] }>("/auctions");
}

export function fetchAuction(id: string) {
  return api.get<{ auction: Auction }>(`/auctions/${id}`);
}

export function createAuction(data: {
  plotId: string;
  startingPriceCents: number;
  reservePriceCents?: number;
  durationMinutes: number;
  description?: string;
}) {
  return api.post<{ auction: Auction }>("/auctions", data);
}

export function placeBid(id: string, amountCents: number) {
  return api.post<{ auction: Auction }>(`/auctions/${id}/bids`, { amountCents });
}

export function cancelAuction(id: string) {
  return api.delete<{ auction: Auction }>(`/auctions/${id}`);
}
