import type {
  AuctionStatus,
  CharacterAppearance,
  ListingStatus,
  NotificationType,
  PlotStatus,
  TransactionType,
  UserRole,
} from "@pixel-estates/shared";

export interface Character {
  id: string;
  userId: string;
  appearance: CharacterAppearance;
  positionX: number;
  positionY: number;
}

export interface Me {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  hasOnboarded: boolean;
  createdAt: string;
  character: Character | null;
  balanceCents: number;
  landCount: number;
  activeListings: number;
  activeBids: number;
}

export interface UserRef {
  id: string;
  username: string;
}

export interface Plot {
  id: string;
  x: number;
  y: number;
  status: PlotStatus;
  ownerId: string | null;
  owner: UserRef | null;
  platformPriceCents: number;
  lastSalePriceCents: number | null;
  biomeSeed: number;
  createdAt: string;
  updatedAt: string;
  listings?: Listing[];
  auctions?: Auction[];
}

export interface PlotDetail extends Plot {
  listings: (Listing & { seller: { username: string }; buyer: { username: string } | null })[];
  auctions: (Auction & {
    seller: { username: string };
    currentBidder: { username: string } | null;
    bids: (Bid & { bidder: { username: string } })[];
  })[];
  decorations: LandDecoration[];
  transactions: LedgerTransaction[];
  ownershipHistory: {
    id: string;
    userId: string;
    user: { username: string };
    acquiredAt: string;
    releasedAt: string | null;
    acquiredPriceCents: number;
    acquiredVia: TransactionType;
  }[];
}

export interface Listing {
  id: string;
  plotId: string;
  plot?: Plot;
  sellerId: string;
  seller?: UserRef;
  buyerId: string | null;
  buyer?: UserRef | null;
  priceCents: number;
  status: ListingStatus;
  description: string | null;
  createdAt: string;
  soldAt: string | null;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidder?: { username: string };
  amountCents: number;
  createdAt: string;
}

export interface Auction {
  id: string;
  plotId: string;
  plot?: Plot;
  sellerId: string;
  seller?: UserRef;
  description: string | null;
  startingPriceCents: number;
  reservePriceCents: number | null;
  currentBidCents: number | null;
  currentBidderId: string | null;
  currentBidder?: UserRef | null;
  status: AuctionStatus;
  startAt: string;
  endAt: string;
  bids?: Bid[];
}

export interface LandDecoration {
  id: string;
  plotId: string;
  objectType: string;
  x: number;
  y: number;
  rotation: number;
  placedByUserId: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  userId: string;
  objectType: string;
  quantity: number;
}

export interface LedgerTransaction {
  id: string;
  type: TransactionType;
  grossCents: number;
  feeCents: number;
  netCents: number;
  feePercentApplied: number;
  fromUserId: string | null;
  fromUser?: { username: string } | null;
  toUserId: string | null;
  toUser?: { username: string } | null;
  plotId: string | null;
  plot?: { x: number; y: number } | null;
  description: string;
  flagged: boolean;
  flagReason: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  bannedUsers: number;
  totalPlots: number;
  plotsOwned: number;
  plotsAvailable: number;
  landSoldCount: number;
  activeListings: number;
  activeAuctions: number;
  marketplaceVolumeCents: number;
  platformFeesCollectedCents: number;
  platformPrimarySalesCents: number;
  platformPrimarySalesCount: number;
  totalTransactions: number;
  openReports: number;
  flaggedTransactions: number;
}

export interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isBanned: boolean;
  createdAt: string;
  balance: { balanceCents: number } | null;
  _count: { ownedPlots: number };
}

export interface Report {
  id: string;
  reporterId: string;
  reporter?: { username: string };
  targetType: string;
  targetId: string;
  plotId: string | null;
  plot?: Plot | null;
  reason: string;
  status: string;
  createdAt: string;
}
