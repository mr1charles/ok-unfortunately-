import { useState } from "react";
import { Modal } from "../common/Modal";
import { dollarsToCents } from "../../lib/format";
import * as marketplaceApi from "../../api/marketplace";
import { useToast } from "../../context/ToastContext";
import { ApiClientError } from "../../api/client";
import { PLATFORM_FEE_PERCENT_DEFAULT } from "@pixel-estates/shared";

export function ListForSaleModal({
  plotId,
  onClose,
  onCreated,
}: {
  plotId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [price, setPrice] = useState("5.00");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const priceCents = dollarsToCents(price);
  const feeCents = Math.round((priceCents * PLATFORM_FEE_PERCENT_DEFAULT) / 100);

  async function submit() {
    setBusy(true);
    try {
      await marketplaceApi.createListing({ plotId, priceCents, description: description || undefined });
      toast("Your land is listed for sale!", "success");
      onCreated();
      onClose();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Could not create listing", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="List land for sale"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || priceCents <= 0}>
            {busy ? "Listing..." : "List for sale"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="label">Sale price ($)</label>
          <input type="number" min="1" step="0.01" className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <textarea
            className="input"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-3 text-xs text-slate-500 dark:text-slate-400">
          If this sells at your asking price, the platform fee (currently {PLATFORM_FEE_PERCENT_DEFAULT}%, ≈
          {" "}
          ${(feeCents / 100).toFixed(2)}) is deducted automatically and you receive the rest instantly. Prices are set
          by you — there's no guarantee your land will sell at this price.
        </div>
      </div>
    </Modal>
  );
}
