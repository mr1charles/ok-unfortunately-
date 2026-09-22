import { useState } from "react";
import { usePolling } from "../hooks/usePolling";
import * as adminApi from "../api/admin";
import { useToast } from "../context/ToastContext";
import { ApiClientError } from "../api/client";
import { formatCents, timeAgo } from "../lib/format";

type Tab = "overview" | "users" | "transactions" | "reports";

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const { toast } = useToast();

  const { data: statsData, reload: reloadStats } = usePolling(() => adminApi.fetchAdminStats(), 15000);
  const { data: configData, reload: reloadConfig } = usePolling(() => adminApi.fetchAdminConfig(), 30000);
  const { data: usersData, reload: reloadUsers } = usePolling(() => adminApi.fetchAdminUsers(), 20000);
  const { data: txData, reload: reloadTx } = usePolling(() => adminApi.fetchAdminTransactions(50), 20000);
  const { data: reportsData, reload: reloadReports } = usePolling(() => adminApi.fetchAdminReports(), 20000);

  const stats = statsData?.stats;
  const [feeInput, setFeeInput] = useState<string>("");

  async function saveFee() {
    const value = Number(feeInput);
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      toast("Fee must be a whole number between 0 and 100", "error");
      return;
    }
    try {
      await adminApi.updatePlatformFee(value);
      toast(`Platform fee updated to ${value}%`, "success");
      await reloadConfig();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not update fee", "error");
    }
  }

  async function toggleBan(userId: string, banned: boolean) {
    try {
      await adminApi.setUserBanned(userId, banned);
      toast(banned ? "User suspended." : "User reinstated.", "success");
      await reloadUsers();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Action failed", "error");
    }
  }

  async function toggleFlag(txId: string, flagged: boolean) {
    try {
      await adminApi.flagTransaction(txId, flagged, flagged ? "Flagged for manual review" : undefined);
      toast(flagged ? "Transaction flagged." : "Flag cleared.", "success");
      await reloadTx();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Action failed", "error");
    }
  }

  async function handleResolveReport(id: string, status: "RESOLVED" | "DISMISSED") {
    try {
      await adminApi.resolveReport(id, status);
      toast("Report updated.", "success");
      await reloadReports();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Action failed", "error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-extrabold">Admin Dashboard</h2>
        <p className="text-xs text-slate-400">Platform health, moderation tools, and economy controls.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["overview", "users", "transactions", "reports"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`btn !px-4 !py-2 !text-xs capitalize ${tab === t ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-white/10"}`}
          >
            {t}
            {t === "reports" && (stats?.openReports ?? 0) > 0 && (
              <span className="ml-1 badge bg-red-500 text-white !px-1.5">{stats?.openReports}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && stats && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total users" value={stats.totalUsers.toString()} sub={`${stats.bannedUsers} suspended`} />
            <StatCard label="Total plots" value={stats.totalPlots.toString()} sub={`${stats.plotsOwned} owned`} />
            <StatCard label="Land sold" value={stats.landSoldCount.toString()} sub="player-to-player" />
            <StatCard label="Active listings" value={stats.activeListings.toString()} />
            <StatCard label="Active auctions" value={stats.activeAuctions.toString()} />
            <StatCard label="Marketplace volume" value={formatCents(stats.marketplaceVolumeCents)} sub="gross, all-time" />
            <StatCard label="Platform fees collected" value={formatCents(stats.platformFeesCollectedCents)} accent="text-emerald-500" />
            <StatCard label="Direct platform sales" value={formatCents(stats.platformPrimarySalesCents)} sub={`${stats.platformPrimarySalesCount} sales`} />
            <StatCard label="Total transactions" value={stats.totalTransactions.toString()} />
            <StatCard label="Flagged transactions" value={stats.flaggedTransactions.toString()} accent={stats.flaggedTransactions > 0 ? "text-red-500" : undefined} />
            <StatCard label="Open reports" value={stats.openReports.toString()} accent={stats.openReports > 0 ? "text-red-500" : undefined} />
          </div>

          <div className="panel p-5 max-w-md">
            <h3 className="font-bold mb-1">Marketplace fee</h3>
            <p className="text-xs text-slate-400 mb-3">
              Currently <strong>{configData?.config.platformFeePercent ?? "..."}%</strong> is taken from every
              player-to-player sale (listing or auction). This is the single source of truth used by every fee
              calculation in the app.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={100}
                className="input !w-24"
                placeholder={String(configData?.config.platformFeePercent ?? "")}
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
              />
              <button className="btn-primary" onClick={saveFee}>
                Update fee %
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3">Username</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3 text-right">Plots</th>
                <th className="p-3">Joined</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(usersData?.users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-black/5 dark:border-white/5">
                  <td className="p-3 font-bold">{u.username}</td>
                  <td className="p-3 text-slate-500">{u.email}</td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3 text-right font-mono">{formatCents(u.balance?.balanceCents ?? 0)}</td>
                  <td className="p-3 text-right">{u._count.ownedPlots}</td>
                  <td className="p-3 text-xs text-slate-400">{timeAgo(u.createdAt)}</td>
                  <td className="p-3">
                    {u.isBanned ? <span className="badge bg-red-500 text-white">Suspended</span> : <span className="badge bg-emerald-100 text-emerald-700">Active</span>}
                  </td>
                  <td className="p-3 text-right">
                    {u.role !== "ADMIN" && (
                      <button
                        className={u.isBanned ? "btn-secondary !text-xs !px-2 !py-1" : "btn-danger !text-xs !px-2 !py-1"}
                        onClick={() => toggleBan(u.id, !u.isBanned)}
                      >
                        {u.isBanned ? "Reinstate" : "Suspend"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "transactions" && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">From</th>
                <th className="p-3">To</th>
                <th className="p-3 text-right">Gross</th>
                <th className="p-3 text-right">Fee</th>
                <th className="p-3">When</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(txData?.transactions ?? []).map((tx) => (
                <tr key={tx.id} className={`border-t border-black/5 dark:border-white/5 ${tx.flagged ? "bg-red-50 dark:bg-red-900/20" : ""}`}>
                  <td className="p-3">{tx.type}</td>
                  <td className="p-3 text-slate-500">{tx.fromUser?.username ?? "—"}</td>
                  <td className="p-3 text-slate-500">{tx.toUser?.username ?? "Platform"}</td>
                  <td className="p-3 text-right font-mono">{formatCents(tx.grossCents)}</td>
                  <td className="p-3 text-right font-mono text-slate-400">{formatCents(tx.feeCents)}</td>
                  <td className="p-3 text-xs text-slate-400">{timeAgo(tx.createdAt)}</td>
                  <td className="p-3 text-right">
                    <button
                      className={tx.flagged ? "btn-secondary !text-xs !px-2 !py-1" : "btn-danger !text-xs !px-2 !py-1"}
                      onClick={() => toggleFlag(tx.id, !tx.flagged)}
                    >
                      {tx.flagged ? "Clear flag" : "Flag"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "reports" && (
        <div className="flex flex-col gap-2">
          {(reportsData?.reports ?? []).length === 0 && (
            <div className="panel p-10 text-center text-slate-400">No reports filed.</div>
          )}
          {(reportsData?.reports ?? []).map((r) => (
            <div key={r.id} className="panel p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm">
                  {r.targetType} reported by {r.reporter?.username}
                </p>
                <p className="text-xs text-slate-500">{r.reason}</p>
                <p className="text-[10px] text-slate-400 mt-1">{timeAgo(r.createdAt)}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <span className="badge bg-slate-200 dark:bg-white/10">{r.status}</span>
                {r.status === "OPEN" && (
                  <>
                    <button className="btn-secondary !text-xs !px-2 !py-1" onClick={() => handleResolveReport(r.id, "DISMISSED")}>
                      Dismiss
                    </button>
                    <button className="btn-primary !text-xs !px-2 !py-1" onClick={() => handleResolveReport(r.id, "RESOLVED")}>
                      Resolve
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xl font-extrabold ${accent ?? ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}
