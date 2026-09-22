import { usePolling } from "../hooks/usePolling";
import * as walletApi from "../api/wallet";
import { useAuth } from "../context/AuthContext";
import { formatCents, timeAgo } from "../lib/format";
import type { LedgerTransaction } from "../types";

const TYPE_LABEL: Record<string, string> = {
  PLATFORM_PURCHASE: "Bought from platform",
  MARKETPLACE_SALE: "Marketplace sale",
  AUCTION_SALE: "Auction sale",
  DEPOSIT: "Wallet deposit",
  WITHDRAWAL: "Wallet withdrawal",
};

const TYPE_COLOR: Record<string, string> = {
  PLATFORM_PURCHASE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  MARKETPLACE_SALE: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  AUCTION_SALE: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  DEPOSIT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  WITHDRAWAL: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

export function TransactionsPage() {
  const { me } = useAuth();
  const { data } = usePolling(() => walletApi.fetchMyTransactions(), 15000);
  const transactions = data?.transactions ?? [];

  function direction(tx: LedgerTransaction): "in" | "out" {
    return tx.toUserId === me?.id ? "in" : "out";
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-extrabold">Transaction History</h2>
        <p className="text-xs text-slate-400">Every purchase, sale, deposit, and fee is recorded here permanently.</p>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-white/5 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="p-3">Type</th>
              <th className="p-3">Plot</th>
              <th className="p-3">Counterparty</th>
              <th className="p-3 text-right">Gross</th>
              <th className="p-3 text-right">Fee</th>
              <th className="p-3 text-right">Net</th>
              <th className="p-3 text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const dir = direction(tx);
              const counterparty = dir === "in" ? tx.fromUser?.username : tx.toUser?.username;
              return (
                <tr key={tx.id} className="border-t border-black/5 dark:border-white/5">
                  <td className="p-3">
                    <span className={`badge ${TYPE_COLOR[tx.type] ?? ""}`}>{TYPE_LABEL[tx.type] ?? tx.type}</span>
                    {tx.flagged && <span className="badge bg-red-500 text-white ml-1">Flagged</span>}
                  </td>
                  <td className="p-3 text-slate-500">{tx.plot ? `(${tx.plot.x}, ${tx.plot.y})` : "—"}</td>
                  <td className="p-3 text-slate-500">{counterparty ?? (tx.type === "PLATFORM_PURCHASE" ? "Platform" : "—")}</td>
                  <td className="p-3 text-right font-mono">{formatCents(tx.grossCents)}</td>
                  <td className="p-3 text-right font-mono text-slate-400">{tx.feeCents > 0 ? formatCents(tx.feeCents) : "—"}</td>
                  <td className={`p-3 text-right font-mono font-bold ${dir === "in" ? "text-emerald-500" : "text-slate-600 dark:text-slate-300"}`}>
                    {dir === "in" ? "+" : "-"}
                    {formatCents(tx.netCents)}
                  </td>
                  <td className="p-3 text-right text-xs text-slate-400">{timeAgo(tx.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {transactions.length === 0 && <p className="p-10 text-center text-slate-400">No transactions yet.</p>}
      </div>
    </div>
  );
}
