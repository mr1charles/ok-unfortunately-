import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { CharacterSprite } from "../character/CharacterSprite";
import { NotificationBell } from "../notifications/NotificationBell";
import { formatCents } from "../../lib/format";
import { DEFAULT_CHARACTER_APPEARANCE } from "@pixel-estates/shared";

const NAV_ITEMS = [
  { to: "/world", label: "World", icon: "🗺️" },
  { to: "/marketplace", label: "Marketplace", icon: "🏪" },
  { to: "/my-land", label: "My Land", icon: "🏘️" },
  { to: "/transactions", label: "Transactions", icon: "🧾" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

function navClass(isActive: boolean) {
  return `flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-colors ${
    isActive
      ? "bg-brand-500 text-white shadow-md shadow-brand-500/30"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
  }`;
}

export function Sidebar() {
  const { me, logout, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();

  if (!me) return null;
  const appearance = me.character?.appearance ?? DEFAULT_CHARACTER_APPEARANCE;

  return (
    <aside className="w-72 shrink-0 h-screen sticky top-0 flex flex-col panel !rounded-none !border-l-0 !border-t-0 !border-b-0 border-r p-4 gap-4 overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏝️</span>
          <span className="font-display font-extrabold text-lg">Pixel Estates</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button onClick={toggle} className="btn-ghost !p-2 rounded-full text-lg" title="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Character card */}
      <div className="panel !shadow-none bg-gradient-to-br from-brand-500/10 to-brand-500/0 p-4 flex items-center gap-3">
        <CharacterSprite appearance={appearance} size={56} />
        <div className="min-w-0">
          <p className="font-extrabold truncate">{me.username}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAdmin ? "Administrator" : "Landowner"}
          </p>
        </div>
      </div>

      {/* Stats HUD */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Balance" value={formatCents(me.balanceCents)} accent="text-emerald-500" />
        <StatTile label="Land" value={`${me.landCount} plot${me.landCount === 1 ? "" : "s"}`} accent="text-blue-500" />
        <StatTile label="Listings" value={`${me.activeListings} active`} accent="text-amber-500" />
        <StatTile label="Bids" value={`${me.activeBids} active`} accent="text-orange-500" />
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 mt-2">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => navClass(isActive)}>
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => navClass(isActive)}>
            <span className="text-lg">🛡️</span>
            Admin Dashboard
          </NavLink>
        )}
      </nav>

      <div className="mt-auto pt-2 border-t border-black/5 dark:border-white/10">
        <button onClick={logout} className="btn-ghost w-full justify-start gap-3 !px-3">
          <span className="text-lg">🚪</span>
          Log out
        </button>
      </div>
    </aside>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-white/5 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm font-extrabold ${accent}`}>{value}</p>
    </div>
  );
}
