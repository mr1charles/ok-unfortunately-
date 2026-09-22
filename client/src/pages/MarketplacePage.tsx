import { useMemo, useState } from "react";
import { usePolling } from "../hooks/usePolling";
import * as marketplaceApi from "../api/marketplace";
import * as auctionsApi from "../api/auctions";
import { useAuth } from "../context/AuthContext";
import { PropertyCard, type MarketEntry } from "../components/marketplace/PropertyCard";
import { PlotPanel } from "../components/world/PlotPanel";

type TypeFilter = "all" | "listing" | "auction";
type SortKey = "newest" | "price_asc" | "price_desc" | "ending_soon";

export function MarketplacePage() {
  const { me } = useAuth();
  const { data: listingsData, reload: reloadListings } = usePolling(() => marketplaceApi.fetchListings(), 10000);
  const { data: auctionsData, reload: reloadAuctions } = usePolling(() => auctionsApi.fetchAuctions(), 10000);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [maxPrice, setMaxPrice] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const entries: MarketEntry[] = useMemo(() => {
    const listingEntries: MarketEntry[] = (listingsData?.listings ?? []).map((listing) => ({ kind: "listing", listing }));
    const auctionEntries: MarketEntry[] = (auctionsData?.auctions ?? []).map((auction) => ({ kind: "auction", auction }));
    let combined = [...listingEntries, ...auctionEntries];

    if (typeFilter !== "all") combined = combined.filter((e) => e.kind === typeFilter);
    if (mineOnly && me) {
      combined = combined.filter((e) => (e.kind === "listing" ? e.listing.sellerId === me.id : e.auction.sellerId === me.id));
    }
    const maxCents = maxPrice ? Math.round(parseFloat(maxPrice) * 100) : null;
    if (maxCents !== null && !Number.isNaN(maxCents)) {
      combined = combined.filter((e) => {
        const price = e.kind === "listing" ? e.listing.priceCents : e.auction.currentBidCents ?? e.auction.startingPriceCents;
        return price <= maxCents;
      });
    }

    const priceOf = (e: MarketEntry) => (e.kind === "listing" ? e.listing.priceCents : e.auction.currentBidCents ?? e.auction.startingPriceCents);
    const dateOf = (e: MarketEntry) => (e.kind === "listing" ? e.listing.createdAt : e.auction.startAt);

    combined.sort((a, b) => {
      switch (sort) {
        case "price_asc":
          return priceOf(a) - priceOf(b);
        case "price_desc":
          return priceOf(b) - priceOf(a);
        case "ending_soon": {
          const aEnd = a.kind === "auction" ? new Date(a.auction.endAt).getTime() : Infinity;
          const bEnd = b.kind === "auction" ? new Date(b.auction.endAt).getTime() : Infinity;
          return aEnd - bEnd;
        }
        default:
          return new Date(dateOf(b)).getTime() - new Date(dateOf(a)).getTime();
      }
    });

    return combined;
  }, [listingsData, auctionsData, typeFilter, sort, maxPrice, mineOnly, me]);

  function reloadAll() {
    void reloadListings();
    void reloadAuctions();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-extrabold">Marketplace</h2>
        <p className="text-xs text-slate-400">Browse land listed for sale or up for auction by other players.</p>
      </div>

      <div className="panel p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Type</label>
          <select className="input !w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
            <option value="all">All</option>
            <option value="listing">Direct sale</option>
            <option value="auction">Auctions</option>
          </select>
        </div>
        <div>
          <label className="label">Sort by</label>
          <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="ending_soon">Auction ending soon</option>
          </select>
        </div>
        <div>
          <label className="label">Max price ($)</label>
          <input
            type="number"
            className="input !w-28"
            placeholder="Any"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-bold pb-2 cursor-pointer">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
          Owned by me
        </label>
      </div>

      {entries.length === 0 ? (
        <div className="panel p-10 text-center text-slate-400">
          No listings match your filters right now. Check back soon, or list your own land!
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {entries.map((entry) => (
            <PropertyCard
              key={entry.kind === "listing" ? `l-${entry.listing.id}` : `a-${entry.auction.id}`}
              entry={entry}
              onOpen={() => setSelectedPlotId(entry.kind === "listing" ? entry.listing.plotId : entry.auction.plotId)}
            />
          ))}
        </div>
      )}

      {selectedPlotId && (
        <PlotPanel
          plotId={selectedPlotId}
          onClose={() => {
            setSelectedPlotId(null);
            reloadAll();
          }}
        />
      )}
    </div>
  );
}
