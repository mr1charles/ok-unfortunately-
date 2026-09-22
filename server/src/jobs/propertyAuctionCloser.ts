import { AUCTION_SWEEP_INTERVAL_MS } from "@pixel-estates/shared";
import { findExpiredPropertyAuctionIds, settlePropertyAuction } from "../services/propertyMarketService.js";

let timer: NodeJS.Timeout | null = null;

async function sweep() {
  try {
    const expiredIds = await findExpiredPropertyAuctionIds();
    for (const id of expiredIds) {
      try {
        await settlePropertyAuction(id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Failed to settle property auction ${id}:`, err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Property auction sweep failed:", err);
  }
}

export function startPropertyAuctionCloser() {
  if (timer) return;
  timer = setInterval(sweep, AUCTION_SWEEP_INTERVAL_MS);
  void sweep();
}

export function stopPropertyAuctionCloser() {
  if (timer) clearInterval(timer);
  timer = null;
}
