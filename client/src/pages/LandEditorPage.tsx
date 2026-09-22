import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PLOT_DECORATION_GRID_SIZE } from "@pixel-estates/shared";
import type { DecorationCatalogEntry } from "@pixel-estates/shared";
import * as worldApi from "../api/world";
import * as decorationsApi from "../api/decorations";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiClientError } from "../api/client";
import type { InventoryItem, LandDecoration, PlotDetail } from "../types";
import { biomeTint } from "../lib/plotVisuals";

const CELL_SIZE = 52;

export function LandEditorPage() {
  const { plotId } = useParams<{ plotId: string }>();
  const { me } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [plot, setPlot] = useState<PlotDetail | null>(null);
  const [catalog, setCatalog] = useState<DecorationCatalogEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [decorations, setDecorations] = useState<LandDecoration[]>([]);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCell, setBusyCell] = useState<string | null>(null);

  async function loadAll() {
    if (!plotId) return;
    setLoading(true);
    try {
      const [plotRes, catalogRes, inventoryRes, decorationsRes] = await Promise.all([
        worldApi.fetchPlot(plotId),
        decorationsApi.fetchCatalog(),
        decorationsApi.fetchInventory(),
        decorationsApi.fetchPlotDecorations(plotId),
      ]);
      setPlot(plotRes.plot);
      setCatalog(catalogRes.catalog);
      setInventory(inventoryRes.inventory);
      setDecorations(decorationsRes.decorations);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not load plot", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotId]);

  if (loading) {
    return <div className="panel p-10 text-center text-slate-400">Loading plot editor...</div>;
  }
  if (!plot || !plotId) {
    return <div className="panel p-10 text-center text-slate-400">Plot not found.</div>;
  }

  const isOwner = plot.ownerId === me?.id;

  function decorationAt(x: number, y: number) {
    return decorations.find((d) => d.x === x && d.y === y);
  }

  function inventoryFor(objectType: string) {
    return inventory.find((i) => i.objectType === objectType);
  }

  async function handleCellClick(x: number, y: number) {
    if (!isOwner || !plotId) return;
    const existing = decorationAt(x, y);
    const cellKey = `${x},${y}`;
    setBusyCell(cellKey);
    try {
      if (existing) {
        await decorationsApi.removeDecoration(existing.id);
        setDecorations((prev) => prev.filter((d) => d.id !== existing.id));
        setInventory((prev) =>
          prev.map((i) => (i.objectType === existing.objectType && i.quantity >= 0 ? { ...i, quantity: i.quantity + 1 } : i))
        );
      } else if (selectedTool) {
        const item = inventoryFor(selectedTool);
        if (item && item.quantity === 0) {
          toast("You don't have any more of this item.", "error");
          return;
        }
        const { decoration } = await decorationsApi.placeDecoration(plotId, { objectType: selectedTool, x, y });
        setDecorations((prev) => [...prev, decoration]);
        setInventory((prev) => prev.map((i) => (i.objectType === selectedTool && i.quantity > 0 ? { ...i, quantity: i.quantity - 1 } : i)));
      }
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not update this tile", "error");
    } finally {
      setBusyCell(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <button className="text-xs text-brand-500 font-bold hover:underline mb-1" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h2 className="text-xl font-extrabold">
            Decorate plot ({plot.x}, {plot.y})
          </h2>
          <p className="text-xs text-slate-400">
            {isOwner ? "Select an item, then click an empty tile to place it. Click a placed item to remove it." : "You can view this plot's decorations, but only the owner can edit them."}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px] gap-4 items-start">
        <div className="panel p-4 flex justify-center">
          <div
            className="grid rounded-xl2 overflow-hidden border-4 border-emerald-800/40 self-start"
            style={{
              gridTemplateColumns: `repeat(${PLOT_DECORATION_GRID_SIZE}, ${CELL_SIZE}px)`,
              gridAutoRows: `${CELL_SIZE}px`,
              backgroundColor: biomeTint(plot.biomeSeed),
            }}
          >
            {Array.from({ length: PLOT_DECORATION_GRID_SIZE * PLOT_DECORATION_GRID_SIZE }).map((_, idx) => {
              const x = idx % PLOT_DECORATION_GRID_SIZE;
              const y = Math.floor(idx / PLOT_DECORATION_GRID_SIZE);
              const deco = decorationAt(x, y);
              const catalogEntry = deco ? catalog.find((c) => c.key === deco.objectType) : null;
              const cellKey = `${x},${y}`;
              return (
                <button
                  key={cellKey}
                  onClick={() => handleCellClick(x, y)}
                  disabled={!isOwner || busyCell === cellKey}
                  className="flex items-center justify-center border border-black/10 text-2xl hover:bg-white/30 transition-colors disabled:cursor-default box-border"
                  style={{ width: CELL_SIZE, height: CELL_SIZE, minWidth: CELL_SIZE, minHeight: CELL_SIZE }}
                >
                  {catalogEntry?.emoji ?? ""}
                </button>
              );
            })}
          </div>
        </div>

        {isOwner && (
          <div className="panel p-4 h-fit">
            <h3 className="font-bold mb-3 text-sm">Decoration catalog</h3>
            <div className="grid grid-cols-3 gap-2">
              {catalog.map((item) => {
                const inv = inventoryFor(item.key);
                const remaining = inv?.quantity ?? 0;
                const disabled = remaining === 0;
                return (
                  <button
                    key={item.key}
                    disabled={disabled}
                    onClick={() => setSelectedTool(item.key)}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 text-center transition-colors ${
                      selectedTool === item.key
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
                        : "border-transparent bg-slate-50 dark:bg-white/5 hover:border-brand-200"
                    } disabled:opacity-30`}
                    title={item.label}
                  >
                    <span className="text-xl">{item.emoji}</span>
                    <span className="text-[10px] font-bold truncate w-full">{item.label}</span>
                    <span className="text-[9px] text-slate-400">{remaining < 0 ? "∞" : remaining}</span>
                  </button>
                );
              })}
            </div>
            {selectedTool && (
              <button className="btn-ghost !text-xs mt-3 w-full" onClick={() => setSelectedTool(null)}>
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
