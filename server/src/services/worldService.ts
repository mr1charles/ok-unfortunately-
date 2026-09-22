import type { World } from "@prisma/client";
import type { WorldSummaryDTO, DevelopmentThreshold } from "@pixel-estates/shared";
import { CITY_ISLAND_WIDTH, CITY_ISLAND_HEIGHT, DEFAULT_DEVELOPMENT_THRESHOLDS, DEFAULT_CHUNK_SIZE, PIXEL_PRICE_CENTS_DEFAULT, DEFAULT_MAX_PIXELS_PER_PURCHASE } from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { logAdminAction } from "./adminActionLogService.js";

export function toWorldSummary(world: World): WorldSummaryDTO {
  const totalPixels = world.pixelWidth * world.pixelHeight;
  return {
    id: world.id,
    key: world.key,
    name: world.name,
    description: world.description,
    emoji: world.emoji,
    kind: world.kind,
    pixelWidth: world.pixelWidth,
    pixelHeight: world.pixelHeight,
    chunkSize: world.chunkSize,
    pixelPriceCents: world.pixelPriceCents,
    maxPixelsPerPurchase: world.maxPixelsPerPurchase,
    maxPropertiesPerPlayer: world.maxPropertiesPerPlayer,
    developmentThresholds: world.developmentThresholds as unknown as DevelopmentThreshold[],
    ownedPixelCount: world.ownedPixelCount,
    totalPixels,
    developmentPercent: totalPixels > 0 ? (world.ownedPixelCount / totalPixels) * 100 : 0,
    isActive: world.isActive,
    isTestCopy: world.isTestCopy,
    sourceWorldId: world.sourceWorldId,
  };
}

export async function listWorlds(opts: { includeTestCopies?: boolean; includeInactive?: boolean } = {}) {
  const worlds = await prisma.world.findMany({
    where: {
      ...(opts.includeTestCopies ? {} : { isTestCopy: false }),
      ...(opts.includeInactive ? {} : { isActive: true }),
    },
    orderBy: { createdAt: "asc" },
  });
  return worlds.map(toWorldSummary);
}

export async function getWorldByKey(key: string) {
  const world = await prisma.world.findUnique({ where: { key } });
  if (!world) throw ApiError.notFound("World not found");
  return world;
}

export async function getWorldById(id: string) {
  const world = await prisma.world.findUnique({ where: { id } });
  if (!world) throw ApiError.notFound("World not found");
  return world;
}

/** Ensures the default "City Island" world exists. Called from the seed
 * script; safe to call multiple times. */
export async function ensureCityIsland() {
  const existing = await prisma.world.findUnique({ where: { key: "city-island" } });
  if (existing) return existing;
  return prisma.world.create({
    data: {
      key: "city-island",
      name: "City Island",
      description: "The original island. 100,000,000 pixels of blank gray ground, waiting to become a city.",
      emoji: "🏙️",
      kind: "STANDARD",
      pixelWidth: CITY_ISLAND_WIDTH,
      pixelHeight: CITY_ISLAND_HEIGHT,
      chunkSize: DEFAULT_CHUNK_SIZE,
      pixelPriceCents: PIXEL_PRICE_CENTS_DEFAULT,
      maxPixelsPerPurchase: DEFAULT_MAX_PIXELS_PER_PURCHASE,
      developmentThresholds: DEFAULT_DEVELOPMENT_THRESHOLDS as unknown as object,
    },
  });
}

export interface CreateWorldParams {
  key: string;
  name: string;
  description?: string;
  emoji?: string;
  kind?: "STANDARD" | "EVENT";
  pixelWidth: number;
  pixelHeight: number;
  pixelPriceCents?: number;
  chunkSize?: number;
  maxPixelsPerPurchase?: number;
  maxPropertiesPerPlayer?: number | null;
}

export async function createWorld(adminId: string, params: CreateWorldParams) {
  const existing = await prisma.world.findUnique({ where: { key: params.key } });
  if (existing) throw ApiError.conflict("A world with that key already exists");

  const world = await prisma.world.create({
    data: {
      key: params.key,
      name: params.name,
      description: params.description,
      emoji: params.emoji ?? "🌍",
      kind: params.kind ?? "STANDARD",
      pixelWidth: params.pixelWidth,
      pixelHeight: params.pixelHeight,
      pixelPriceCents: params.pixelPriceCents ?? PIXEL_PRICE_CENTS_DEFAULT,
      chunkSize: params.chunkSize ?? DEFAULT_CHUNK_SIZE,
      maxPixelsPerPurchase: params.maxPixelsPerPurchase ?? DEFAULT_MAX_PIXELS_PER_PURCHASE,
      maxPropertiesPerPlayer: params.maxPropertiesPerPlayer ?? null,
      developmentThresholds: DEFAULT_DEVELOPMENT_THRESHOLDS as unknown as object,
      createdByAdminId: adminId,
    },
  });

  await logAdminAction(adminId, {
    action: "CREATE_WORLD",
    targetType: "World",
    targetId: world.id,
    metadata: { key: world.key, name: world.name, pixelWidth: world.pixelWidth, pixelHeight: world.pixelHeight },
  });

  return world;
}

/**
 * Creates a private admin sandbox copy of an existing world: same
 * dimensions/price/config, but starts completely blank (no pixel ownership
 * is copied) and is clearly flagged isTestCopy=true / kind=TEST_COPY. Every
 * gameplay system (purchases, attacks, credits) treats a test-copy world
 * exactly like any other World row, but it is never returned by the normal
 * world list, and it can be deleted freely without touching production data.
 */
export async function cloneAsTestWorld(adminId: string, sourceWorldId: string, reason?: string) {
  const source = await getWorldById(sourceWorldId);

  const existingCopies = await prisma.world.count({ where: { sourceWorldId: source.id, isTestCopy: true } });
  const testNumber = existingCopies + 1;
  const key = `${source.key}-test-${testNumber}-${Date.now().toString(36)}`;

  const testWorld = await prisma.world.create({
    data: {
      key,
      name: `${source.name} — TEST #${String(testNumber).padStart(2, "0")}`,
      description: `Admin sandbox copy of "${source.name}". Nothing here affects production.`,
      emoji: source.emoji,
      kind: "TEST_COPY",
      pixelWidth: source.pixelWidth,
      pixelHeight: source.pixelHeight,
      chunkSize: source.chunkSize,
      pixelPriceCents: source.pixelPriceCents,
      maxPixelsPerPurchase: source.maxPixelsPerPurchase,
      maxPropertiesPerPlayer: source.maxPropertiesPerPlayer,
      developmentThresholds: source.developmentThresholds as unknown as object,
      isTestCopy: true,
      sourceWorldId: source.id,
      createdByAdminId: adminId,
    },
  });

  await logAdminAction(adminId, {
    action: "CREATE_TEST_WORLD",
    targetType: "World",
    targetId: testWorld.id,
    reason,
    metadata: { sourceWorldId: source.id, sourceWorldKey: source.key, testKey: testWorld.key },
  });

  return testWorld;
}

/** Deletes a world. Restricted to test copies and admin-created custom
 * worlds with no owned pixels, to make it structurally impossible to
 * accidentally wipe a live production island through this endpoint. */
export async function deleteWorld(adminId: string, worldId: string, reason?: string) {
  const world = await getWorldById(worldId);
  if (!world.isTestCopy && world.ownedPixelCount > 0) {
    throw ApiError.forbidden("Only empty or test-copy worlds can be deleted. Deactivate a live world instead.");
  }

  await prisma.world.delete({ where: { id: worldId } });

  await logAdminAction(adminId, {
    action: "DELETE_WORLD",
    targetType: "World",
    targetId: worldId,
    reason,
    metadata: { key: world.key, name: world.name, wasTestCopy: world.isTestCopy },
  });

  return { deleted: true };
}

export async function setWorldActive(adminId: string, worldId: string, isActive: boolean, reason?: string) {
  const world = await prisma.world.update({ where: { id: worldId }, data: { isActive } });
  await logAdminAction(adminId, {
    action: isActive ? "ACTIVATE_WORLD" : "DEACTIVATE_WORLD",
    targetType: "World",
    targetId: worldId,
    reason,
  });
  return world;
}

export async function updateWorldPixelPrice(adminId: string, worldId: string, pixelPriceCents: number, reason?: string) {
  if (!Number.isInteger(pixelPriceCents) || pixelPriceCents < 1) {
    throw ApiError.badRequest("Pixel price must be a positive integer number of cents");
  }
  const world = await prisma.world.update({ where: { id: worldId }, data: { pixelPriceCents } });
  await logAdminAction(adminId, {
    action: "SET_PIXEL_PRICE",
    targetType: "World",
    targetId: worldId,
    reason,
    metadata: { pixelPriceCents },
  });
  return world;
}
