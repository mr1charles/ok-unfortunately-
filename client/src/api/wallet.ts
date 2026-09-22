import { api } from "./client";
import type { LedgerTransaction } from "../types";

export function fetchBalance() {
  return api.get<{ balanceCents: number }>("/wallet");
}

export function depositMockFunds(amountCents: number) {
  return api.post<{ transaction: LedgerTransaction; balanceCents: number }>("/wallet/deposit", { amountCents });
}

export function withdrawFunds(amountCents: number) {
  return api.post<{ balanceCents: number; providerRef: string; status: string }>("/wallet/withdraw", { amountCents });
}

export function fetchMyTransactions() {
  return api.get<{ transactions: LedgerTransaction[] }>("/wallet/transactions");
}
