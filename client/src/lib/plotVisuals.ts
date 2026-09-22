import type { PlotStatus } from "@pixel-estates/shared";

export const PLOT_STATUS_META: Record<PlotStatus, { emoji: string; label: string; color: string; bg: string }> = {
  AVAILABLE: { emoji: "🟩", label: "Available", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-plot-available" },
  OWNED: { emoji: "🟦", label: "Owned", color: "text-blue-600 dark:text-blue-400", bg: "bg-plot-owned" },
  LISTED: { emoji: "🟨", label: "For Sale", color: "text-amber-600 dark:text-amber-400", bg: "bg-plot-listed" },
  AUCTION: { emoji: "🟧", label: "Auction", color: "text-orange-600 dark:text-orange-400", bg: "bg-plot-auction" },
  UNAVAILABLE: { emoji: "🟥", label: "Unavailable", color: "text-red-600 dark:text-red-400", bg: "bg-plot-unavailable" },
};

const BIOME_TINTS = ["#bbf7d0", "#bfdbfe", "#fde68a", "#fbcfe8", "#ddd6fe"];

export function biomeTint(seed: number): string {
  return BIOME_TINTS[seed % BIOME_TINTS.length];
}
