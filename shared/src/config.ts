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

// ---------------------------------------------------------------------------
// Pixel-world system (Worlds/Islands, City Island, chunk streaming, credits,
// attacks/defenses). These are seed/display defaults only - the live,
// authoritative values live in the World and AttackConfig database rows
// (server/src/services/worldService.ts, attackService.ts). No route or
// service should hardcode these numbers; always read them from the relevant
// World/AttackConfig row.
// ---------------------------------------------------------------------------

/** City Island: 10,000 x 10,000 = 100,000,000 purchasable pixels. */
export const CITY_ISLAND_WIDTH = 10_000;
export const CITY_ISLAND_HEIGHT = 10_000;
export const CITY_ISLAND_TOTAL_PIXELS = CITY_ISLAND_WIDTH * CITY_ISLAND_HEIGHT;

/** $0.01 per pixel by default. */
export const PIXEL_PRICE_CENTS_DEFAULT = 1;

/** Pixels per chunk edge; the client streams chunks around the player/camera. */
export const DEFAULT_CHUNK_SIZE = 64;

/** A single purchase request (single pixel, rectangle, or explicit list) is
 * capped at this many pixels to keep each transaction bounded and fast. */
export const DEFAULT_MAX_PIXELS_PER_PURCHASE = 50_000;

/** How the world visually evolves as ownedPixelCount / totalPixels grows. */
export interface DevelopmentThreshold {
  percent: number;
  stage: string;
  label: string;
}

export const DEFAULT_DEVELOPMENT_THRESHOLDS: DevelopmentThreshold[] = [
  { percent: 0, stage: "blank", label: "Blank gray world" },
  { percent: 10, stage: "infrastructure", label: "Basic infrastructure appears" },
  { percent: 25, stage: "roads", label: "Road systems become available" },
  { percent: 50, stage: "buildings", label: "Buildings and city systems expand" },
  { percent: 75, stage: "advanced", label: "Advanced city structures unlock" },
  { percent: 100, stage: "developed", label: "Fully developed island" },
];

/** Default daily attack allowance and mining reward range (mirrors
 * AttackConfig's DB defaults; used for client-side display before the
 * authoritative config loads). */
export const DEFAULT_MAX_ATTACKS_PER_DAY = 3;
export const DEFAULT_MINING_CREDIT_MIN = 3;
export const DEFAULT_MINING_CREDIT_MAX = 12;
export const MINING_HOLD_DURATION_MS = 1_500;
export const MINING_COOLDOWN_MS = 10_000;

/** New-player starting credits (dev + production; credits aren't real money
 * so there's no dev/prod split the way DEV_STARTING_BALANCE_CENTS has). */
export const STARTING_CREDITS = 100;
