import { useState } from "react";
import { Modal } from "../common/Modal";
import { dollarsToCents } from "../../lib/format";
import * as auctionsApi from "../../api/auctions";
import { useToast } from "../../context/ToastContext";
import { ApiClientError } from "../../api/client";
import { MAX_AUCTION_DURATION_MINUTES, MIN_AUCTION_DURATION_MINUTES } from "@pixel-estates/shared";

const DURATION_PRESETS = [
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 60 * 6 },
  { label: "1 day", minutes: 60 * 24 },
  { label: "3 days", minutes: 60 * 24 * 3 },
  { label: "7 days", minutes: 60 * 24 * 7 },
];

export function CreateAuctionModal({
  plotId,
  onClose,
  onCreated,
}: {
  plotId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [startingPrice, setStartingPrice] = useState("1.00");
  const [reservePrice, setReservePrice] = useState("");
  const [duration, setDuration] = useState(60 * 24);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await auctionsApi.createAuction({
        plotId,
        startingPriceCents: dollarsToCents(startingPrice),
        reservePriceCents: reservePrice ? dollarsToCents(reservePrice) : undefined,
        durationMinutes: duration,
        description: description || undefined,
      });
      toast("Auction created!", "success");
      onCreated();
      onClose();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not create auction", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Start an auction"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Creating..." : "Create auction"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="label">Starting price ($)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            className="input"
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Reserve price ($, optional)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={reservePrice}
            onChange={(e) => setReservePrice(e.target.value)}
            placeholder="No reserve"
          />
          <p className="text-xs text-slate-400 mt-1">If the highest bid doesn't reach this, the land won't sell.</p>
        </div>
        <div>
          <label className="label">Duration</label>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.minutes}
                type="button"
                onClick={() => setDuration(p.minutes)}
                className={`btn !px-3 !py-1.5 !text-xs ${
                  duration === p.minutes ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-white/10"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <textarea
            className="input"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell buyers what makes this plot special..."
          />
        </div>
        <p className="text-xs text-slate-400">
          Duration must be between {MIN_AUCTION_DURATION_MINUTES} minutes and{" "}
          {Math.round(MAX_AUCTION_DURATION_MINUTES / 60 / 24)} days. A 10% platform fee applies to the winning bid.
        </p>
      </div>
    </Modal>
  );
}
