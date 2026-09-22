import { AUCTION_SWEEP_INTERVAL_MS } from "@pixel-estates/shared";
import { findExpiredActiveAuctionIds, settleAuction } from "../services/auctionService.js";

let timer: NodeJS.Timeout | null = null;

async function sweep() {
  try {
    const expiredIds = await findExpiredActiveAuctionIds();
    for (const id of expiredIds) {
      try {
        await settleAuction(id);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Failed to settle auction ${id}:`, err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Auction sweep failed:", err);
  }
}

/**
 * Prototype-friendly auction settlement scheduler: polls for auctions whose
 * endAt has passed and settles each one (determine winner, transfer funds
 * + ownership, deduct platform fee, notify buyer/seller). A production
 * deployment would replace this with a durable job queue (e.g. a cron-
 * triggered serverless function or BullMQ worker) so settlement survives
 * server restarts precisely at each auction's endAt - the settlement logic
 * itself (settleAuction) is already decoupled from this scheduler.
 */
export function startAuctionCloser() {
  if (timer) return;
  timer = setInterval(sweep, AUCTION_SWEEP_INTERVAL_MS);
  // Run one sweep immediately on boot too.
  void sweep();
}

export function stopAuctionCloser() {
  if (timer) clearInterval(timer);
  timer = null;
}
