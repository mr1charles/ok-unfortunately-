import { useCallback, useEffect, useRef, useState } from "react";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@pixel-estates/shared";
import { usePolling } from "../../hooks/usePolling";
import * as worldApi from "../../api/world";
import * as authApi from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { PlotTile } from "./PlotTile";
import { PlotPanel } from "./PlotPanel";
import { CharacterSprite } from "../character/CharacterSprite";
import { PLOT_STATUS_META } from "../../lib/plotVisuals";

const TILE_SIZE = 24;

export function WorldMap() {
  const { me } = useAuth();
  const { data, reload } = usePolling(() => worldApi.fetchPlots(), 8000);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: me?.character?.positionX ?? 12, y: me?.character?.positionY ?? 12 });
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialized.current && me?.character) {
      setPosition({ x: me.character.positionX, y: me.character.positionY });
      initialized.current = true;
    }
  }, [me]);

  const persistPosition = useCallback((x: number, y: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void authApi.updateCharacterPosition(x, y);
    }, 350);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp" || e.key === "w") dy = -1;
      else if (e.key === "ArrowDown" || e.key === "s") dy = 1;
      else if (e.key === "ArrowLeft" || e.key === "a") dx = -1;
      else if (e.key === "ArrowRight" || e.key === "d") dx = 1;
      else return;
      e.preventDefault();
      setPosition((prev) => {
        const next = {
          x: Math.max(0, Math.min(WORLD_WIDTH - 1, prev.x + dx)),
          y: Math.max(0, Math.min(WORLD_HEIGHT - 1, prev.y + dy)),
        };
        persistPosition(next.x, next.y);
        return next;
      });
    },
    [persistPosition]
  );

  const plots = data?.plots ?? [];

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-extrabold">The World</h2>
          <p className="text-xs text-slate-400">Click a plot to see details. Use arrow keys / WASD to walk around.</p>
        </div>
        <Legend />
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative mx-auto overflow-auto rounded-xl2 border border-black/10 dark:border-white/10 outline-none focus:ring-2 focus:ring-brand-400 max-h-[70vh]"
        style={{ width: "100%", maxWidth: WORLD_WIDTH * TILE_SIZE + 4 }}
      >
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `repeat(${WORLD_WIDTH}, ${TILE_SIZE}px)`,
            width: WORLD_WIDTH * TILE_SIZE,
            height: WORLD_HEIGHT * TILE_SIZE,
          }}
        >
          {plots.map((plot) => (
            <PlotTile
              key={plot.id}
              plot={plot}
              size={TILE_SIZE}
              isMine={plot.ownerId === me?.id}
              onClick={() => setSelectedPlotId(plot.id)}
            />
          ))}

          {me?.character && (
            <div
              className="absolute pointer-events-none transition-all duration-200 ease-out z-20"
              style={{
                left: position.x * TILE_SIZE - TILE_SIZE * 0.6,
                top: position.y * TILE_SIZE - TILE_SIZE * 1.4,
              }}
            >
              <CharacterSprite appearance={me.character.appearance} size={TILE_SIZE * 2.2} animated label={me.username} />
            </div>
          )}
        </div>
      </div>

      {selectedPlotId && (
        <PlotPanel
          plotId={selectedPlotId}
          onClose={() => {
            setSelectedPlotId(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {Object.values(PLOT_STATUS_META).map((meta) => (
        <span key={meta.label} className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
          <span className={`w-3 h-3 rounded ${meta.bg} inline-block border border-black/10`} />
          {meta.label}
        </span>
      ))}
    </div>
  );
}
