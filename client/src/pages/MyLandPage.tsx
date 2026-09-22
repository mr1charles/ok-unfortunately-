import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import * as worldApi from "../api/world";
import * as marketplaceApi from "../api/marketplace";
import * as auctionsApi from "../api/auctions";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiClientError } from "../api/client";
import { formatCents } from "../lib/format";
import { PLOT_STATUS_META, biomeTint } from "../lib/plotVisuals";
import { PlotPanel } from "../components/world/PlotPanel";
import { CreateAuctionModal } from "../components/auctions/CreateAuctionModal";
import { ListForSaleModal } from "../components/marketplace/ListForSaleModal";
import type { Plot } from "../types";

export function MyLandPage() {
  const { me, refresh } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data, reload } = usePolling(() => worldApi.fetchPlots({ ownerId: me?.id }), 10000, [me?.id]);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [auctionPlot, setAuctionPlot] = useState<Plot | null>(null);
  const [listPlot, setListPlot] = useState<Plot | null>(null);

  const plots = data?.plots ?? [];

  async function reloadAll() {
    await reload();
    await refresh();
  }

  async function handleCancelListing(plot: Plot) {
    const listing = plot.listings?.find((l) => l.status === "ACTIVE");
    if (!listing) return;
    try {
      await marketplaceApi.cancelListing(listing.id);
      toast("Listing removed.", "success");
      await reloadAll();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not remove listing", "error");
    }
  }

  async function handleCancelAuction(plot: Plot) {
    const auction = plot.auctions?.find((a) => a.status === "ACTIVE");
    if (!auction) return;
    try {
      await auctionsApi.cancelAuction(auction.id);
      toast("Auction cancelled.", "success");
      await reloadAll();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not cancel auction (it may already have bids)", "error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-extrabold">My Land</h2>
        <p className="text-xs text-slate-400">Manage the plots you own: customize, list for sale, or auction them off.</p>
      </div>

      {plots.length === 0 ? (
        <div className="panel p-10 text-center text-slate-400">
          You don't own any land yet.{" "}
          <button className="text-brand-500 font-bold hover:underline" onClick={() => navigate("/world")}>
            Explore the world
          </button>{" "}
          to buy your first plot.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plots.map((plot) => {
            const meta = PLOT_STATUS_META[plot.status];
            const activeListing = plot.listings?.find((l) => l.status === "ACTIVE");
            const activeAuction = plot.auctions?.find((a) => a.status === "ACTIVE");
            return (
              <div key={plot.id} className="panel overflow-hidden animate-pop-in">
                <button
                  className="h-20 w-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: biomeTint(plot.biomeSeed) }}
                  onClick={() => setSelectedPlotId(plot.id)}
                >
                  🏝️
                </button>
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold">
                      ({plot.x}, {plot.y})
                    </p>
                    <span className={`badge ${meta.bg} text-slate-900`}>{meta.emoji} {meta.label}</span>
                  </div>
                  {activeListing && <p className="text-xs text-slate-500">Listed at {formatCents(activeListing.priceCents)}</p>}
                  {activeAuction && (
                    <p className="text-xs text-slate-500">
                      Auction: {formatCents(activeAuction.currentBidCents ?? activeAuction.startingPriceCents)}
                      {activeAuction.currentBidderId ? " (has bids)" : " (no bids)"}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <button className="btn-secondary !text-xs !px-2 !py-1" onClick={() => setSelectedPlotId(plot.id)}>
                      View
                    </button>
                    <button
                      className="btn-secondary !text-xs !px-2 !py-1"
                      onClick={() => navigate(`/my-land/${plot.id}/decorate`)}
                    >
                      Customize
                    </button>
                    {plot.status === "OWNED" && (
                      <>
                        <button className="btn-secondary !text-xs !px-2 !py-1" onClick={() => setListPlot(plot)}>
                          List for sale
                        </button>
                        <button className="btn-secondary !text-xs !px-2 !py-1" onClick={() => setAuctionPlot(plot)}>
                          Start auction
                        </button>
                      </>
                    )}
                    {plot.status === "LISTED" && (
                      <button className="btn-danger !text-xs !px-2 !py-1" onClick={() => handleCancelListing(plot)}>
                        Remove listing
                      </button>
                    )}
                    {plot.status === "AUCTION" && !activeAuction?.currentBidderId && (
                      <button className="btn-danger !text-xs !px-2 !py-1" onClick={() => handleCancelAuction(plot)}>
                        Cancel auction
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPlotId && (
        <PlotPanel
          plotId={selectedPlotId}
          onClose={() => {
            setSelectedPlotId(null);
            void reloadAll();
          }}
        />
      )}
      {auctionPlot && (
        <CreateAuctionModal plotId={auctionPlot.id} onClose={() => setAuctionPlot(null)} onCreated={() => void reloadAll()} />
      )}
      {listPlot && (
        <ListForSaleModal plotId={listPlot.id} onClose={() => setListPlot(null)} onCreated={() => void reloadAll()} />
      )}
    </div>
  );
}
