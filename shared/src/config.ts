/**
 * Central platform configuration.
 *
 * IMPORTANT: PLATFORM_FEE_PERCENT below is only the *default* fee used to
 * seed the database on first run. The live, authoritative fee percentage
 * lives in the single-row `PlatformConfig` database table and is read by
 * the server through `getPlatformFeePercent()` (server/src/services/
 * platformConfigService.ts). Admins can change it at runtime from the
 * admin dashboard without a redeploy. No other file in this codebase
 * should hardcode a fee percentage — always resolve it through that
 * service (server-side) or read it from `GET /api/admin/config` /
 * the `platformFeePercent` field returned alongside listings/auctions
 * (client-side), so the UI and the ledger never disagree.
 */
export const PLATFORM_FEE_PERCENT_DEFAULT = 10;

/** New accounts in development mode start with this many cents ($100.00). */
export const DEV_STARTING_BALANCE_CENTS = 10_000;

/** World grid dimensions (plots). WORLD_WIDTH * WORLD_HEIGHT plots are seeded. */
export const WORLD_WIDTH = 24;
export const WORLD_HEIGHT = 24;

/** Minimum/maximum listing & starting-land prices, in cents. */
export const MIN_LAND_PRICE_CENTS = 100; // $1.00
export const MAX_LAND_PRICE_CENTS = 100_000_00; // $100,000.00

/** Auction constraints. */
export const MIN_AUCTION_DURATION_MINUTES = 5;
export const MAX_AUCTION_DURATION_MINUTES = 60 * 24 * 14; // 14 days
export const MIN_BID_INCREMENT_CENTS = 25; // $0.25 minimum raise over current bid

/** Land decoration grid: each plot has an N x N buildable sub-grid. */
export const PLOT_DECORATION_GRID_SIZE = 6;

/** JWT session lifetime. */
export const JWT_EXPIRES_IN = "7d";

/** Pagination defaults for marketplace browsing. */
export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

/**
 * Auction settlement sweep interval (ms). A prototype-friendly polling
 * job rather than a distributed scheduler; see server/src/jobs/auctionCloser.ts.
 */
export const AUCTION_SWEEP_INTERVAL_MS = 5_000;
