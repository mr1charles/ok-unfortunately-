// Shared enums & DTO shapes used by both the server (Prisma maps to these
// same string unions) and the client. Keeping these hand-written (rather
// than importing generated Prisma types into the client) keeps the client
// bundle free of server/DB dependencies.

export type UserRole = "PLAYER" | "ADMIN";

export type PlotStatus =
  | "AVAILABLE" // 🟩 never purchased, owned by the platform
  | "OWNED" // 🟦 owned by a player, not listed
  | "LISTED" // 🟨 owned by a player, listed for direct sale
  | "AUCTION" // 🟧 owned by a player, in an active auction
  | "UNAVAILABLE"; // 🟥 frozen/removed by an admin

export type ListingStatus = "ACTIVE" | "PAUSED" | "SOLD" | "CANCELLED";

export type AuctionStatus = "ACTIVE" | "ENDED" | "CANCELLED";

export type TransactionType =
  | "PLATFORM_PURCHASE" // player buys unowned land directly from the platform
  | "MARKETPLACE_SALE" // player-to-player direct listing sale
  | "AUCTION_SALE" // player-to-player auction settlement
  | "DEPOSIT" // mock/real money added to wallet
  | "WITHDRAWAL"; // funds withdrawn from wallet (stubbed in prototype)

export type NotificationType =
  | "LAND_PURCHASED"
  | "LAND_SOLD"
  | "AUCTION_WON"
  | "AUCTION_LOST"
  | "OUTBID"
  | "AUCTION_ENDED_SELLER"
  | "LISTING_CREATED"
  | "LISTING_SOLD"
  | "LISTING_CANCELLED"
  | "ADMIN_ACTION"
  | "SYSTEM";

export interface CharacterAppearance {
  skinColor: string;
  hairStyle: "bald" | "short" | "long" | "mohawk" | "curly";
  hairColor: string;
  outfitColor: string;
  outfitStyle: "casual" | "formal" | "explorer" | "royal";
  accessory: "none" | "glasses" | "hat" | "cape" | "backpack";
  accentColor: string;
}

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  skinColor: "#e8b892",
  hairStyle: "short",
  hairColor: "#3b2519",
  outfitColor: "#4f7cff",
  outfitStyle: "casual",
  accessory: "none",
  accentColor: "#ffd166",
};

export interface DecorationItem {
  id: string; // instance id
  objectType: string; // catalog key, e.g. "tree", "house_small", "path"
  x: number; // sub-grid coordinate within the plot
  y: number;
  rotation?: 0 | 90 | 180 | 270;
}

export interface DecorationCatalogEntry {
  key: string;
  label: string;
  category: "building" | "nature" | "path" | "sign" | "furniture" | "lighting";
  emoji: string;
  footprint: { w: number; h: number };
}

export const DECORATION_CATALOG: DecorationCatalogEntry[] = [
  { key: "house_small", label: "Small House", category: "building", emoji: "🏠", footprint: { w: 2, h: 2 } },
  { key: "house_large", label: "Large House", category: "building", emoji: "🏛️", footprint: { w: 3, h: 3 } },
  { key: "tower", label: "Tower", category: "building", emoji: "🗼", footprint: { w: 1, h: 1 } },
  { key: "tree", label: "Tree", category: "nature", emoji: "🌳", footprint: { w: 1, h: 1 } },
  { key: "bush", label: "Bush", category: "nature", emoji: "🌿", footprint: { w: 1, h: 1 } },
  { key: "flower", label: "Flowers", category: "nature", emoji: "🌷", footprint: { w: 1, h: 1 } },
  { key: "pond", label: "Pond", category: "nature", emoji: "💧", footprint: { w: 2, h: 2 } },
  { key: "path", label: "Path Tile", category: "path", emoji: "🟫", footprint: { w: 1, h: 1 } },
  { key: "fence", label: "Fence", category: "path", emoji: "🚧", footprint: { w: 1, h: 1 } },
  { key: "sign", label: "Sign", category: "sign", emoji: "🪧", footprint: { w: 1, h: 1 } },
  { key: "bench", label: "Bench", category: "furniture", emoji: "🪑", footprint: { w: 1, h: 1 } },
  { key: "table", label: "Table", category: "furniture", emoji: "🍱", footprint: { w: 1, h: 1 } },
  { key: "lamp", label: "Lamp Post", category: "lighting", emoji: "💡", footprint: { w: 1, h: 1 } },
  { key: "firepit", label: "Fire Pit", category: "lighting", emoji: "🔥", footprint: { w: 1, h: 1 } },
  { key: "statue", label: "Statue", category: "building", emoji: "🗿", footprint: { w: 1, h: 1 } },
  { key: "fountain", label: "Fountain", category: "building", emoji: "⛲", footprint: { w: 2, h: 2 } },
];

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}

/** Cents-based money formatting helper shared by client & server. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
