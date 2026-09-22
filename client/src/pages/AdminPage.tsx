import { useState } from "react";
import { usePolling } from "../hooks/usePolling";
import * as adminApi from "../api/admin";
import * as adminWorldApi from "../api/adminWorld";
import { useToast } from "../context/ToastContext";
import { ApiClientError } from "../api/client";
import { formatCents, timeAgo } from "../lib/format";

type Tab = "overview" | "users" | "transactions" | "reports" | "islands";

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const { toast } = useToast();

  const { data: statsData, reload: reloadStats } = usePolling(() => adminApi.fetchAdminStats(), 15000);
  const { data: configData, reload: reloadConfig } = usePolling(() => adminApi.fetchAdminConfig(), 30000);
  const { data: usersData, reload: reloadUsers } = usePolling(() => adminApi.fetchAdminUsers(), 20000);
  const { data: txData, reload: reloadTx } = usePolling(() => adminApi.fetchAdminTransactions(50), 20000);
  const { data: reportsData, reload: reloadReports } = usePolling(() => adminApi.fetchAdminReports(), 20000);
  const { data: worldsData, reload: reloadWorlds } = usePolling(() => adminWorldApi.fetchWorlds(true), 15000);
  const { data: attackConfigData, reload: reloadAttackConfig } = usePolling(() => adminWorldApi.fetchAttackConfig(), 20000);
  const { data: eventsData, reload: reloadEvents } = usePolling(() => adminWorldApi.fetchEvents(), 20000);
  const { data: actionLogData, reload: reloadActionLog } = usePolling(() => adminWorldApi.fetchActionLog(50), 15000);

  const stats = statsData?.stats;
  const [feeInput, setFeeInput] = useState<string>("");
  const [attackConfigInput, setAttackConfigInput] = useState<Partial<adminWorldApi.AttackConfigDTO>>({});
  const [newEventName, setNewEventName] = useState("");
  const [newEventKey, setNewEventKey] = useState("");
  const [newEventDays, setNewEventDays] = useState("14");

  async function handleCloneTestWorld(worldId: string) {
    try {
      const { world } = await adminWorldApi.createTestWorldCopy(worldId, "Created from admin dashboard");
      toast(`Created test copy: ${world.name}`, "success");
      await reloadWorlds();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not create test world", "error");
    }
  }

  async function handleDeleteWorld(worldId: string) {
    try {
      await adminWorldApi.deleteWorld(worldId);
      toast("World deleted.", "success");
      await reloadWorlds();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not delete world (only empty/test worlds can be deleted)", "error");
    }
  }

  async function handleSaveAttackConfig() {
    try {
      const config = attackConfigData?.config;
      if (!config) return;
      const merged = { ...config, ...attackConfigInput };
      await adminWorldApi.updateAttackConfig(merged);
      toast("Attack config updated.", "success");
      setAttackConfigInput({});
      await reloadAttackConfig();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not update attack config", "error");
    }
  }

  async function handleCreateEvent() {
    if (!newEventKey || !newEventName) {
      toast("Event key and name are required", "error");
      return;
    }
    try {
      const now = new Date();
      const end = new Date(now.getTime() + Number(newEventDays) * 24 * 60 * 60 * 1000);
      await adminWorldApi.createEvent({
        key: newEventKey,
        name: newEventName,
        startAt: now.toISOString(),
        endAt: end.toISOString(),
        items: [],
      });
      toast("Event created.", "success");
      setNewEventKey("");
      setNewEventName("");
      await reloadEvents();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not create event", "error");
    }
  }

  async function handleToggleEvent(eventId: string, isActive: boolean) {
    try {
      await adminWorldApi.setEventActive(eventId, isActive);
      await reloadEvents();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not update event", "error");
    }
  }

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
        {(["overview", "users", "transactions", "reports", "islands"] as Tab[]).map((t) => (
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

      {tab === "islands" && (
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="font-bold mb-2">Worlds / Islands</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(worldsData?.worlds ?? []).map((w) => (
                <div key={w.id} className="panel p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-extrabold">
                      {w.emoji} {w.name}
                    </p>
                    {w.isTestCopy && <span className="badge bg-orange-500 text-white">TEST</span>}
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    {w.ownedPixelCount.toLocaleString()} / {w.totalPixels.toLocaleString()} pixels owned (
                    {w.developmentPercent.toFixed(4)}%)
                  </p>
                  <p className="text-xs text-slate-400 mb-3">{formatCents(w.pixelPriceCents)}/pixel</p>
                  <div className="flex flex-wrap gap-1.5">
                    {!w.isTestCopy && (
                      <button className="btn-secondary !text-xs !px-2 !py-1" onClick={() => handleCloneTestWorld(w.id)}>
                        ⚠ Clone as test world
                      </button>
                    )}
                    {(w.isTestCopy || w.ownedPixelCount === 0) && (
                      <button className="btn-danger !text-xs !px-2 !py-1" onClick={() => handleDeleteWorld(w.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5 max-w-2xl">
            <h3 className="font-bold mb-1">Daily attack configuration</h3>
            <p className="text-xs text-slate-400 mb-3">
              Controls the odds for every attack across all worlds. Success + Critical + Fail must add up to 100.
            </p>
            {attackConfigData?.config && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {(
                  [
                    ["maxAttacksPerDay", "Max attacks/day"],
                    ["successRatePct", "Success %"],
                    ["criticalRatePct", "Critical %"],
                    ["failRatePct", "Fail %"],
                    ["creditRewardMin", "Success reward min"],
                    ["creditRewardMax", "Success reward max"],
                    ["criticalRewardMin", "Critical reward min"],
                    ["criticalRewardMax", "Critical reward max"],
                  ] as [keyof adminWorldApi.AttackConfigDTO, string][]
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <input
                      type="number"
                      className="input"
                      defaultValue={attackConfigData.config[key] as number}
                      onChange={(e) => setAttackConfigInput((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            )}
            <button className="btn-primary mt-4" onClick={handleSaveAttackConfig}>
              Save attack config
            </button>
          </section>

          <section className="panel p-5 max-w-2xl">
            <h3 className="font-bold mb-3">Events</h3>
            <div className="flex flex-col gap-2 mb-4">
              {(eventsData?.events ?? []).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between text-sm border-b border-black/5 dark:border-white/5 py-2">
                  <span>
                    {ev.emoji} {ev.name} <span className="text-xs text-slate-400">({ev.items.length} items)</span>
                  </span>
                  <button
                    className={ev.isActive ? "btn-danger !text-xs !px-2 !py-1" : "btn-secondary !text-xs !px-2 !py-1"}
                    onClick={() => handleToggleEvent(ev.id, !ev.isActive)}
                  >
                    {ev.isActive ? "End event" : "Reactivate"}
                  </button>
                </div>
              ))}
              {(eventsData?.events ?? []).length === 0 && <p className="text-xs text-slate-400">No events yet.</p>}
            </div>
            <div className="flex gap-2 flex-wrap items-end">
              <div>
                <label className="label">Key</label>
                <input className="input !w-32" value={newEventKey} onChange={(e) => setNewEventKey(e.target.value)} />
              </div>
              <div>
                <label className="label">Name</label>
                <input className="input !w-40" value={newEventName} onChange={(e) => setNewEventName(e.target.value)} />
              </div>
              <div>
                <label className="label">Duration (days)</label>
                <input type="number" className="input !w-24" value={newEventDays} onChange={(e) => setNewEventDays(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={handleCreateEvent}>
                Create event
              </button>
            </div>
          </section>

          <section>
            <h3 className="font-bold mb-2">Admin action log</h3>
            <div className="panel overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-white/5 text-left uppercase text-slate-400">
                  <tr>
                    <th className="p-2">Admin</th>
                    <th className="p-2">Action</th>
                    <th className="p-2">Target</th>
                    <th className="p-2">Reason</th>
                    <th className="p-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {(actionLogData?.log ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-black/5 dark:border-white/5">
                      <td className="p-2 font-bold">{row.admin.username}</td>
                      <td className="p-2">{row.action}</td>
                      <td className="p-2 text-slate-500">{row.targetType ?? "—"}</td>
                      <td className="p-2 text-slate-500">{row.reason ?? "—"}</td>
                      <td className="p-2 text-slate-400">{timeAgo(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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
