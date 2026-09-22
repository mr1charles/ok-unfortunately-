import { useState } from "react";
import { usePolling } from "../../hooks/usePolling";
import * as notificationsApi from "../../api/notifications";
import { timeAgo } from "../../lib/format";

const TYPE_EMOJI: Record<string, string> = {
  LAND_PURCHASED: "🏡",
  LAND_SOLD: "💰",
  AUCTION_WON: "🏆",
  AUCTION_LOST: "📉",
  OUTBID: "⚠️",
  AUCTION_ENDED_SELLER: "🔨",
  LISTING_CREATED: "🏷️",
  LISTING_SOLD: "✅",
  LISTING_CANCELLED: "🚫",
  ADMIN_ACTION: "🛡️",
  SYSTEM: "🔔",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, reload } = usePolling(() => notificationsApi.fetchNotifications(), 15000);
  const { data: countData, reload: reloadCount } = usePolling(() => notificationsApi.fetchUnreadCount(), 15000);

  const notifications = data?.notifications ?? [];
  const unread = countData?.count ?? 0;

  async function handleOpen() {
    setOpen((o) => !o);
    if (!open) await reload();
  }

  async function markAll() {
    await notificationsApi.markAllRead();
    await reload();
    await reloadCount();
  }

  return (
    <div className="relative">
      <button onClick={handleOpen} className="relative btn-ghost !p-2 rounded-full text-lg">
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 panel p-3 z-40 animate-pop-in max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-bold text-sm">Notifications</h4>
            <button onClick={markAll} className="text-xs text-brand-500 font-bold hover:underline">
              Mark all read
            </button>
          </div>
          {notifications.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">No notifications yet.</p>
          )}
          <div className="flex flex-col gap-1">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex gap-2 p-2 rounded-lg text-sm ${n.isRead ? "opacity-60" : "bg-brand-50 dark:bg-brand-900/30"}`}
              >
                <span className="text-lg leading-none">{TYPE_EMOJI[n.type] ?? "🔔"}</span>
                <div className="min-w-0">
                  <p className="font-bold truncate">{n.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
