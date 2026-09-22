-- CreateEnum
CREATE TYPE "WorldKind" AS ENUM ('STANDARD', 'EVENT', 'TEST_COPY');

-- CreateEnum
CREATE TYPE "DefenseKind" AS ENUM ('SHIELD', 'ENERGY_BARRIER', 'SECURITY_TOWER');

-- CreateEnum
CREATE TYPE "AttackResult" AS ENUM ('SUCCESS', 'BLOCKED', 'FAILED', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PropertyMarketStatus" AS ENUM ('NONE', 'LISTED', 'AUCTION');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "propertyAuctionId" TEXT,
ADD COLUMN     "propertyId" TEXT,
ADD COLUMN     "propertyListingId" TEXT;

-- CreateTable
CREATE TABLE "World" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🏙️',
    "kind" "WorldKind" NOT NULL DEFAULT 'STANDARD',
    "pixelWidth" INTEGER NOT NULL,
    "pixelHeight" INTEGER NOT NULL,
    "chunkSize" INTEGER NOT NULL DEFAULT 64,
    "pixelPriceCents" INTEGER NOT NULL DEFAULT 1,
    "maxPixelsPerPurchase" INTEGER NOT NULL DEFAULT 50000,
    "maxPropertiesPerPlayer" INTEGER,
    "developmentThresholds" JSONB NOT NULL,
    "ownedPixelCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "isTestCopy" BOOLEAN NOT NULL DEFAULT false,
    "sourceWorldId" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixelOwnership" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL DEFAULT '#4f7cff',
    "purchasePriceCents" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PixelOwnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT,
    "pixelCount" INTEGER NOT NULL DEFAULT 0,
    "minX" INTEGER NOT NULL,
    "minY" INTEGER NOT NULL,
    "maxX" INTEGER NOT NULL,
    "maxY" INTEGER NOT NULL,
    "marketStatus" "PropertyMarketStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyDecoration" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "placedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyDecoration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Defense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" "DefenseKind" NOT NULL,
    "charges" INTEGER NOT NULL DEFAULT 1,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Defense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttackConfig" (
    "id" SERIAL NOT NULL,
    "maxAttacksPerDay" INTEGER NOT NULL DEFAULT 3,
    "successRatePct" INTEGER NOT NULL DEFAULT 60,
    "criticalRatePct" INTEGER NOT NULL DEFAULT 10,
    "failRatePct" INTEGER NOT NULL DEFAULT 15,
    "creditRewardMin" INTEGER NOT NULL DEFAULT 5,
    "creditRewardMax" INTEGER NOT NULL DEFAULT 25,
    "criticalRewardMin" INTEGER NOT NULL DEFAULT 30,
    "criticalRewardMax" INTEGER NOT NULL DEFAULT 75,
    "attacksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AttackConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attack" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "attackerId" TEXT NOT NULL,
    "defenderId" TEXT NOT NULL,
    "targetPropertyId" TEXT NOT NULL,
    "result" "AttackResult" NOT NULL,
    "attackerCreditsChange" INTEGER NOT NULL DEFAULT 0,
    "defenderCreditsChange" INTEGER NOT NULL DEFAULT 0,
    "defenseUsed" "DefenseKind",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAttackAllowance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "attacksUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyAttackAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "worldId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🎉',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🎁',
    "isLimited" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EventItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerEventItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventItemId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerEventItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyListing" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "soldAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "PropertyListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAuction" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "description" TEXT,
    "startingPriceCents" INTEGER NOT NULL,
    "reservePriceCents" INTEGER,
    "currentBidCents" INTEGER,
    "currentBidderId" TEXT,
    "status" "AuctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyAuction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyBid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "World_key_key" ON "World"("key");

-- CreateIndex
CREATE INDEX "World_kind_idx" ON "World"("kind");

-- CreateIndex
CREATE INDEX "World_isTestCopy_idx" ON "World"("isTestCopy");

-- CreateIndex
CREATE INDEX "PixelOwnership_worldId_propertyId_idx" ON "PixelOwnership"("worldId", "propertyId");

-- CreateIndex
CREATE INDEX "PixelOwnership_ownerId_idx" ON "PixelOwnership"("ownerId");

-- CreateIndex
CREATE INDEX "PixelOwnership_worldId_x_y_idx" ON "PixelOwnership"("worldId", "x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "PixelOwnership_worldId_x_y_key" ON "PixelOwnership"("worldId", "x", "y");

-- CreateIndex
CREATE INDEX "Property_worldId_ownerId_idx" ON "Property"("worldId", "ownerId");

-- CreateIndex
CREATE INDEX "Property_marketStatus_idx" ON "Property"("marketStatus");

-- CreateIndex
CREATE INDEX "PropertyDecoration_propertyId_idx" ON "PropertyDecoration"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditBalance_userId_key" ON "CreditBalance"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "Defense_propertyId_isActive_idx" ON "Defense"("propertyId", "isActive");

-- CreateIndex
CREATE INDEX "Attack_attackerId_idx" ON "Attack"("attackerId");

-- CreateIndex
CREATE INDEX "Attack_defenderId_idx" ON "Attack"("defenderId");

-- CreateIndex
CREATE INDEX "Attack_createdAt_idx" ON "Attack"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttackAllowance_userId_date_key" ON "DailyAttackAllowance"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Event_key_key" ON "Event"("key");

-- CreateIndex
CREATE INDEX "Event_isActive_idx" ON "Event"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EventItem_eventId_objectType_key" ON "EventItem"("eventId", "objectType");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerEventItem_userId_eventItemId_key" ON "PlayerEventItem"("userId", "eventItemId");

-- CreateIndex
CREATE INDEX "AdminActionLog_adminId_idx" ON "AdminActionLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");

-- CreateIndex
CREATE INDEX "PropertyListing_status_idx" ON "PropertyListing"("status");

-- CreateIndex
CREATE INDEX "PropertyListing_propertyId_idx" ON "PropertyListing"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyAuction_status_idx" ON "PropertyAuction"("status");

-- CreateIndex
CREATE INDEX "PropertyAuction_endAt_idx" ON "PropertyAuction"("endAt");

-- CreateIndex
CREATE INDEX "PropertyAuction_propertyId_idx" ON "PropertyAuction"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyBid_auctionId_idx" ON "PropertyBid"("auctionId");

-- CreateIndex
CREATE INDEX "PropertyBid_bidderId_idx" ON "PropertyBid"("bidderId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyListingId_fkey" FOREIGN KEY ("propertyListingId") REFERENCES "PropertyListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyAuctionId_fkey" FOREIGN KEY ("propertyAuctionId") REFERENCES "PropertyAuction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "World" ADD CONSTRAINT "World_sourceWorldId_fkey" FOREIGN KEY ("sourceWorldId") REFERENCES "World"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "World" ADD CONSTRAINT "World_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixelOwnership" ADD CONSTRAINT "PixelOwnership_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixelOwnership" ADD CONSTRAINT "PixelOwnership_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixelOwnership" ADD CONSTRAINT "PixelOwnership_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDecoration" ADD CONSTRAINT "PropertyDecoration_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDecoration" ADD CONSTRAINT "PropertyDecoration_placedByUserId_fkey" FOREIGN KEY ("placedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBalance" ADD CONSTRAINT "CreditBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defense" ADD CONSTRAINT "Defense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttackConfig" ADD CONSTRAINT "AttackConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attack" ADD CONSTRAINT "Attack_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attack" ADD CONSTRAINT "Attack_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attack" ADD CONSTRAINT "Attack_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attack" ADD CONSTRAINT "Attack_targetPropertyId_fkey" FOREIGN KEY ("targetPropertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyAttackAllowance" ADD CONSTRAINT "DailyAttackAllowance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventItem" ADD CONSTRAINT "EventItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerEventItem" ADD CONSTRAINT "PlayerEventItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerEventItem" ADD CONSTRAINT "PlayerEventItem_eventItemId_fkey" FOREIGN KEY ("eventItemId") REFERENCES "EventItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyListing" ADD CONSTRAINT "PropertyListing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyListing" ADD CONSTRAINT "PropertyListing_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyListing" ADD CONSTRAINT "PropertyListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyListing" ADD CONSTRAINT "PropertyListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAuction" ADD CONSTRAINT "PropertyAuction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAuction" ADD CONSTRAINT "PropertyAuction_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAuction" ADD CONSTRAINT "PropertyAuction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAuction" ADD CONSTRAINT "PropertyAuction_currentBidderId_fkey" FOREIGN KEY ("currentBidderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyBid" ADD CONSTRAINT "PropertyBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "PropertyAuction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyBid" ADD CONSTRAINT "PropertyBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
