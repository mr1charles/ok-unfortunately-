import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../common/Modal";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import * as worldApi from "../../api/world";
import * as marketplaceApi from "../../api/marketplace";
import * as auctionsApi from "../../api/auctions";
import * as reportsApi from "../../api/reports";
import { ApiClientError } from "../../api/client";
import { formatCents, dollarsToCents, timeAgo } from "../../lib/format";
import { PLOT_STATUS_META } from "../../lib/plotVisuals";
import type { PlotDetail } from "../../types";
import { CreateAuctionModal } from "../auctions/CreateAuctionModal";
import { ListForSaleModal } from "../marketplace/ListForSaleModal";
import { AuctionCountdown } from "../auctions/AuctionCountdown";
import { MIN_BID_INCREMENT_CENTS } from "@pixel-estates/shared";

export function PlotPanel({ plotId, onClose }: { plotId: string; onClose: () => void }) {
  const { me, refresh } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [plot, setPlot] = useState<PlotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [bidAmount, setBidAmount] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { plot } = await worldApi.fetchPlot(plotId);
      setPlot(plot);
      const activeAuction = plot.auctions.find((a) => a.status === "ACTIVE");
      if (activeAuction) {
        const min = (activeAuction.currentBidCents ?? activeAuction.startingPriceCents - MIN_BID_INCREMENT_CENTS) + MIN_BID_INCREMENT_CENTS;
        setBidAmount((min / 100).toFixed(2));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotId]);

  if (loading || !plot) {
    return (
      <Modal title="Loading plot..." onClose={onClose}>
        <div className="h-40 flex items-center justify-center text-slate-400">Loading...</div>
      </Modal>
    );
  }

  const meta = PLOT_STATUS_META[plot.status];
  const isMine = plot.ownerId === me?.id;
  const activeListing = plot.listings.find((l) => l.status === "ACTIVE");
  const activeAuction = plot.auctions.find((a) => a.status === "ACTIVE");

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await load();
      await refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  }

  async function buyFromPlatform() {
    await withBusy(async () => {
      await worldApi.buyPlotFromPlatform(plot!.id);
      toast(`You bought plot (${plot!.x}, ${plot!.y})!`, "success");
    });
  }

  async function buyListingNow() {
    if (!activeListing) return;
    await withBusy(async () => {
      await marketplaceApi.buyListing(activeListing.id);
      toast(`You bought plot (${plot!.x}, ${plot!.y}) for ${formatCents(activeListing.priceCents)}!`, "success");
    });
  }

  async function cancelListing() {
    if (!activeListing) return;
    await withBusy(async () => {
      await marketplaceApi.cancelListing(activeListing.id);
      toast("Listing removed.", "success");
    });
  }

  async function cancelAuction() {
    if (!activeAuction) return;
    await withBusy(async () => {
      await auctionsApi.cancelAuction(activeAuction.id);
      toast("Auction cancelled.", "success");
    });
  }

  async function submitBid() {
    if (!activeAuction) return;
    await withBusy(async () => {
      await auctionsApi.placeBid(activeAuction.id, dollarsToCents(bidAmount));
      toast("Bid placed!", "success");
    });
  }

  async function submitReport() {
    if (!reportReason.trim()) return;
    try {
      await reportsApi.fileReport({ targetType: "PLOT", targetId: plot!.id, plotId: plot!.id, reason: reportReason });
      toast("Report submitted. An admin will review it.", "success");
      setShowReport(false);
      setReportReason("");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not submit report", "error");
    }
  }

  return (
    <>
      <Modal title={`Plot (${plot.x}, ${plot.y})`} onClose={onClose} width="max-w-lg">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className={`badge ${meta.bg} text-slate-900`}>
              {meta.emoji} {meta.label}
            </span>
            {plot.owner && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Owned by <strong>{isMine ? "you" : plot.owner.username}</strong>
              </span>
            )}
          </div>

          {/* AVAILABLE - buy from platform */}
          {plot.status === "AVAILABLE" && (
            <div className="panel !shadow-none bg-emerald-50 dark:bg-emerald-900/20 p-4">
              <p className="text-sm mb-2">This plot is unowned and available directly from the platform.</p>
              <div className="flex items-center justify-between">
                <span className="text-xl font-extrabold">{formatCents(plot.platformPriceCents)}</span>
                <button className="btn-primary" onClick={buyFromPlatform} disabled={busy}>
                  Buy now
                </button>
              </div>
            </div>
          )}

          {/* LISTED */}
          {plot.status === "LISTED" && activeListing && (
            <div className="panel !shadow-none bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-sm mb-2">
                Listed by <strong>{activeListing.seller?.username}</strong>
                {activeListing.description && <span className="block text-slate-500 mt-1">{activeListing.description}</span>}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xl font-extrabold">{formatCents(activeListing.priceCents)}</span>
                {isMine ? (
                  <button className="btn-danger" onClick={cancelListing} disabled={busy}>
                    Remove listing
                  </button>
                ) : (
                  <button className="btn-primary" onClick={buyListingNow} disabled={busy}>
                    Buy now
                  </button>
                )}
              </div>
            </div>
          )}

          {/* AUCTION */}
          {plot.status === "AUCTION" && activeAuction && (
            <div className="panel !shadow-none bg-orange-50 dark:bg-orange-900/20 p-4">
              {activeAuction.description && <p className="text-sm mb-3 text-slate-600 dark:text-slate-300">{activeAuction.description}</p>}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="label !mb-0">Current bid</p>
                  <p className="text-lg font-extrabold">
                    {formatCents(activeAuction.currentBidCents ?? activeAuction.startingPriceCents)}
                  </p>
                </div>
                <div>
                  <p className="label !mb-0">Highest bidder</p>
                  <p className="text-lg font-extrabold truncate">
                    {activeAuction.currentBidder?.username ?? "No bids yet"}
                  </p>
                </div>
                <div>
                  <p className="label !mb-0">Time remaining</p>
                  <AuctionCountdown endAt={activeAuction.endAt} className="text-lg" />
                </div>
                <div>
                  <p className="label !mb-0">Seller</p>
                  <p className="text-lg font-extrabold truncate">{activeAuction.seller?.username}</p>
                </div>
              </div>

              {!isMine && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                  />
                  <button className="btn-primary shrink-0" onClick={submitBid} disabled={busy}>
                    Place bid
                  </button>
                </div>
              )}
              {isMine && !activeAuction.currentBidderId && (
                <button className="btn-danger" onClick={cancelAuction} disabled={busy}>
                  Cancel auction
                </button>
              )}
              {isMine && activeAuction.currentBidderId && (
                <p className="text-xs text-slate-400">
                  This auction has bids and can no longer be cancelled by you.
                </p>
              )}
            </div>
          )}

          {plot.status === "UNAVAILABLE" && (
            <div className="panel !shadow-none bg-red-50 dark:bg-red-900/20 p-4 text-sm">
              This plot has been temporarily disabled by an administrator.
            </div>
          )}

          {/* Owner actions when just OWNED */}
          {isMine && plot.status === "OWNED" && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => navigate(`/my-land/${plot.id}/decorate`)}>
                🎨 Customize
              </button>
              <button className="btn-secondary" onClick={() => setShowListModal(true)}>
                🏷️ List for sale
              </button>
              <button className="btn-secondary" onClick={() => setShowAuctionModal(true)}>
                🔨 Start auction
              </button>
            </div>
          )}
          {isMine && plot.status !== "AVAILABLE" && plot.status !== "OWNED" && (
            <button className="btn-secondary self-start" onClick={() => navigate(`/my-land/${plot.id}/decorate`)}>
              🎨 View / customize
            </button>
          )}

          {/* Ownership history */}
          <details className="text-sm">
            <summary className="cursor-pointer font-bold text-slate-500">Ownership history ({plot.ownershipHistory.length})</summary>
            <ul className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto">
              {plot.ownershipHistory.map((h) => (
                <li key={h.id} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>{h.user.username}</span>
                  <span>{formatCents(h.acquiredPriceCents)} · {timeAgo(h.acquiredAt)}</span>
                </li>
              ))}
              {plot.ownershipHistory.length === 0 && <li className="text-xs text-slate-400">Never owned by a player.</li>}
            </ul>
          </details>

          {/* Report */}
          {!isMine && (
            <div>
              {!showReport ? (
                <button className="text-xs text-slate-400 hover:text-red-500 font-bold" onClick={() => setShowReport(true)}>
                  🚩 Report this listing
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="input !text-xs"
                    rows={2}
                    placeholder="Why are you reporting this?"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button className="btn-secondary !text-xs" onClick={() => setShowReport(false)}>
                      Cancel
                    </button>
                    <button className="btn-danger !text-xs" onClick={submitReport}>
                      Submit report
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {showAuctionModal && (
        <CreateAuctionModal plotId={plot.id} onClose={() => setShowAuctionModal(false)} onCreated={() => { void load(); void refresh(); }} />
      )}
      {showListModal && (
        <ListForSaleModal plotId={plot.id} onClose={() => setShowListModal(false)} onCreated={() => { void load(); void refresh(); }} />
      )}
    </>
  );
}
