import { biomeTint } from "../../lib/plotVisuals";
import { formatCents } from "../../lib/format";
import type { Auction, Listing } from "../../types";
import { AuctionCountdown } from "../auctions/AuctionCountdown";

type Entry = { kind: "listing"; listing: Listing } | { kind: "auction"; auction: Auction };

export function PropertyCard({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const plot = entry.kind === "listing" ? entry.listing.plot : entry.auction.plot;
  const seller = entry.kind === "listing" ? entry.listing.seller : entry.auction.seller;
  const price = entry.kind === "listing" ? entry.listing.priceCents : entry.auction.currentBidCents ?? entry.auction.startingPriceCents;

  return (
    <button
      onClick={onOpen}
      className="panel text-left overflow-hidden hover:-translate-y-1 hover:shadow-panel transition-all duration-150 animate-pop-in group"
    >
      <div
        className="h-24 w-full flex items-center justify-center text-3xl relative"
        style={{ backgroundColor: plot ? biomeTint(plot.biomeSeed) : "#ddd" }}
      >
        {entry.kind === "auction" ? "🔨" : "🏷️"}
        <span
          className={`absolute top-2 right-2 badge ${
            entry.kind === "auction" ? "bg-orange-500" : "bg-amber-400"
          } text-white shadow`}
        >
          {entry.kind === "auction" ? "Auction" : "For Sale"}
        </span>
      </div>
      <div className="p-3">
        <p className="text-xs text-slate-400 font-bold">
          Plot ({plot?.x}, {plot?.y})
        </p>
        <p className="text-lg font-extrabold">{formatCents(price)}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">by {seller?.username}</p>
        {entry.kind === "auction" && (
          <p className="text-xs mt-1">
            Ends in <AuctionCountdown endAt={entry.auction.endAt} />
          </p>
        )}
      </div>
    </button>
  );
}

export type { Entry as MarketEntry };
