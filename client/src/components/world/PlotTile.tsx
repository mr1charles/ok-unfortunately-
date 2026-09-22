import { memo } from "react";
import type { Plot } from "../../types";
import { PLOT_STATUS_META, biomeTint } from "../../lib/plotVisuals";

export const PlotTile = memo(function PlotTile({
  plot,
  size,
  isMine,
  onClick,
}: {
  plot: Plot;
  size: number;
  isMine: boolean;
  onClick: () => void;
}) {
  const meta = PLOT_STATUS_META[plot.status];
  return (
    <button
      onClick={onClick}
      title={`(${plot.x}, ${plot.y}) - ${meta.label}`}
      className={`relative group border border-black/10 dark:border-white/10 transition-transform hover:z-10 hover:scale-110 hover:shadow-lg ${meta.bg} ${
        plot.status === "AUCTION" ? "animate-pulse-glow" : ""
      }`}
      style={{ width: size, height: size, backgroundColor: plot.status === "AVAILABLE" ? biomeTint(plot.biomeSeed) : undefined }}
    >
      <span className={`absolute inset-0 flex items-center justify-center text-[10px] ${meta.bg} opacity-80`} />
      {isMine && (
        <span className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full border border-brand-500" />
      )}
    </button>
  );
});
