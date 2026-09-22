import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { applyLedgerEntry } from "./walletService.js";
import { notifyUser } from "./notificationService.js";
import { getWorldById } from "./worldService.js";

type TxClient = Prisma.TransactionClient;

/** Hard cap on the padded bounding box we'll prefetch/scan for a single
 * purchase request, independent of the world's own maxPixelsPerPurchase.
 * Keeps a single purchase O(a few hundred thousand rows) worst case even if
 * a caller crafts a pathological scattered selection. */
const MAX_BBOX_DIM = 620;

export interface PixelCoord {
  x: number;
  y: number;
}

function coordKey(x: number, y: number) {
  return `${x},${y}`;
}

function boundsOf(coords: PixelCoord[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of coords) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Expands a rectangle (inclusive) into individual pixel coordinates. */
export function expandRect(x1: number, y1: number, x2: number, y2: number): PixelCoord[] {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const coords: PixelCoord[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      coords.push({ x, y });
    }
  }
  return coords;
}

// --- Chunk streaming ---------------------------------------------------

/**
 * Returns every OWNED pixel within the requested chunk range (chunks are
 * chunkSize x chunkSize pixels). Unowned pixels are never returned - their
 * absence *is* "available" - so the payload size is proportional to actual
 * ownership density, not to world size. This is what the Godot client (and
 * the web world-preview) streams as the player/camera moves.
 */
export async function getChunkPixels(worldId: string, chunkX: number, chunkY: number, radius: number) {
  const world = await getWorldById(worldId);
  const clampedRadius = Math.max(0, Math.min(radius, 6));
  const minChunkX = chunkX - clampedRadius;
  const maxChunkX = chunkX + clampedRadius;
  const minChunkY = chunkY - clampedRadius;
  const maxChunkY = chunkY + clampedRadius;

  const minX = Math.max(0, minChunkX * world.chunkSize);
  const maxX = Math.min(world.pixelWidth - 1, (maxChunkX + 1) * world.chunkSize - 1);
  const minY = Math.max(0, minChunkY * world.chunkSize);
  const maxY = Math.min(world.pixelHeight - 1, (maxChunkY + 1) * world.chunkSize - 1);

  const pixels = await prisma.pixelOwnership.findMany({
    where: { worldId, x: { gte: minX, lte: maxX }, y: { gte: minY, lte: maxY } },
    select: { x: true, y: true, colorHex: true, ownerId: true, propertyId: true, owner: { select: { username: true } } },
  });

  return { chunkSize: world.chunkSize, minX, minY, maxX, maxY, pixels };
}

/** A single pixel's live status, used by the "look at a pixel" interaction
 * panel in both the web preview and the Godot client. */
export async function getPixelInfo(worldId: string, x: number, y: number) {
  const world = await getWorldById(worldId);
  if (x < 0 || y < 0 || x >= world.pixelWidth || y >= world.pixelHeight) {
    throw ApiError.badRequest("Coordinates are outside the world bounds");
  }
  const owned = await prisma.pixelOwnership.findUnique({
    where: { worldId_x_y: { worldId, x, y } },
    include: { owner: { select: { id: true, username: true } }, property: true },
  });
  return {
    worldId,
    x,
    y,
    priceCents: world.pixelPriceCents,
    owned: !!owned,
    owner: owned?.owner ?? null,
    colorHex: owned?.colorHex ?? null,
    propertyId: owned?.propertyId ?? null,
  };
}

// --- Purchase (with connected-property union-find merge) ---------------

export interface PurchaseResult {
  purchasedCount: number;
  totalCents: number;
  propertyIds: string[];
  newlyConnected: boolean;
}

export async function purchasePixels(
  userId: string,
  worldId: string,
  params: { coords: PixelCoord[]; colorHex?: string }
): Promise<PurchaseResult> {
  const world = await getWorldById(worldId);
  if (!world.isActive) throw ApiError.forbidden("This world is not currently accepting purchases");

  // Dedupe + validate bounds.
  const seen = new Set<string>();
  const coords: PixelCoord[] = [];
  for (const c of params.coords) {
    if (!Number.isInteger(c.x) || !Number.isInteger(c.y)) continue;
    if (c.x < 0 || c.y < 0 || c.x >= world.pixelWidth || c.y >= world.pixelHeight) {
      throw ApiError.badRequest(`Pixel (${c.x}, ${c.y}) is outside the world bounds`);
    }
    const key = coordKey(c.x, c.y);
    if (seen.has(key)) continue;
    seen.add(key);
    coords.push(c);
  }
  if (coords.length === 0) throw ApiError.badRequest("No valid pixels selected");
  if (coords.length > world.maxPixelsPerPurchase) {
    throw ApiError.badRequest(`You can purchase at most ${world.maxPixelsPerPurchase} pixels per transaction`);
  }

  const { minX, minY, maxX, maxY } = boundsOf(coords);
  if (maxX - minX + 1 > MAX_BBOX_DIM || maxY - minY + 1 > MAX_BBOX_DIM) {
    throw ApiError.badRequest("Selection is too spread out - buy in smaller, more local batches");
  }

  const colorHex = params.colorHex && /^#[0-9a-fA-F]{6}$/.test(params.colorHex) ? params.colorHex : "#4f7cff";
  const totalCents = coords.length * world.pixelPriceCents;

  const result = await prisma.$transaction(async (tx) => {
    // Prefetch the padded bounding box in one query: gives us conflicts
    // (already-owned target pixels) AND neighbor ownership for the merge
    // step, without one query per pixel.
    const padded = await tx.pixelOwnership.findMany({
      where: {
        worldId,
        x: { gte: Math.max(0, minX - 1), lte: Math.min(world.pixelWidth - 1, maxX + 1) },
        y: { gte: Math.max(0, minY - 1), lte: Math.min(world.pixelHeight - 1, maxY + 1) },
      },
      select: { x: true, y: true, ownerId: true, propertyId: true },
    });
    const existingMap = new Map<string, { ownerId: string; propertyId: string }>();
    for (const p of padded) existingMap.set(coordKey(p.x, p.y), { ownerId: p.ownerId, propertyId: p.propertyId });

    const conflicts = coords.filter((c) => existingMap.has(coordKey(c.x, c.y)));
    if (conflicts.length > 0) {
      throw ApiError.conflict(
        `${conflicts.length} pixel${conflicts.length === 1 ? "" : "s"} in your selection ${conflicts.length === 1 ? "is" : "are"} already owned`,
        { conflicts: conflicts.slice(0, 20) }
      );
    }

    // --- Union-find over target pixels + adjacent existing properties ---
    const N = coords.length;
    const parent = new Array<number>(N);
    for (let i = 0; i < N; i++) parent[i] = i;
    const targetIndex = new Map<string, number>();
    coords.forEach((c, i) => targetIndex.set(coordKey(c.x, c.y), i));

    // Synthetic nodes: one per distinct existing-property-of-mine touched.
    const propertySyntheticIndex = new Map<string, number>(); // propertyId -> node index (>= N)
    const syntheticParent: number[] = []; // parallel array, index 0 => node N

    function find(i: number): number {
      if (i < N) {
        if (parent[i] !== i) parent[i] = find(parent[i]);
        return parent[i];
      }
      const si = i - N;
      if (syntheticParent[si] !== i) {
        syntheticParent[si] = find(syntheticParent[si]);
      }
      return syntheticParent[si];
    }
    function union(a: number, b: number) {
      const ra = find(a);
      const rb = find(b);
      if (ra === rb) return;
      // Prefer keeping a pixel-index (< N) as root when possible so the
      // "does this root have a synthetic node" check below stays simple.
      if (ra < N) setParent(rb, ra);
      else setParent(ra, rb);
    }
    function setParent(node: number, newParent: number) {
      if (node < N) parent[node] = newParent;
      else syntheticParent[node - N] = newParent;
    }

    function getOrCreateSynthetic(propertyId: string): number {
      const existingIdx = propertySyntheticIndex.get(propertyId);
      if (existingIdx !== undefined) return existingIdx;
      const idx = N + syntheticParent.length;
      syntheticParent.push(idx);
      propertySyntheticIndex.set(propertyId, idx);
      return idx;
    }

    const NEIGHBOR_OFFSETS = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    for (let i = 0; i < N; i++) {
      const c = coords[i];
      for (const [dx, dy] of NEIGHBOR_OFFSETS) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        const key = coordKey(nx, ny);
        const targetNeighborIdx = targetIndex.get(key);
        if (targetNeighborIdx !== undefined) {
          union(i, targetNeighborIdx);
          continue;
        }
        const existing = existingMap.get(key);
        if (existing && existing.ownerId === userId) {
          union(i, getOrCreateSynthetic(existing.propertyId));
        }
      }
    }

    // Group target pixels by root, and note which existing property (if
    // any/multiple) each root maps to.
    const groups = new Map<number, PixelCoord[]>();
    for (let i = 0; i < N; i++) {
      const root = find(i);
      const arr = groups.get(root);
      if (arr) arr.push(coords[i]);
      else groups.set(root, [coords[i]]);
    }
    const rootToExistingProperties = new Map<number, Set<string>>();
    for (const [propertyId, synIdx] of propertySyntheticIndex) {
      const root = find(synIdx);
      // Only relevant if that root corresponds to an actual pixel group
      // (it always will, since every synthetic node was unioned with at
      // least one pixel index).
      const set = rootToExistingProperties.get(root) ?? new Set<string>();
      set.add(propertyId);
      rootToExistingProperties.set(root, set);
    }

    const affectedPropertyIds: string[] = [];
    let newlyConnected = false;

    for (const [root, groupCoords] of groups) {
      const existingIds = [...(rootToExistingProperties.get(root) ?? [])];
      let targetPropertyId: string;

      if (existingIds.length === 0) {
        const b = boundsOf(groupCoords);
        const created = await tx.property.create({
          data: {
            worldId,
            ownerId: userId,
            pixelCount: 0,
            minX: b.minX,
            minY: b.minY,
            maxX: b.maxX,
            maxY: b.maxY,
          },
        });
        targetPropertyId = created.id;
      } else {
        // Connecting to (or bridging) at least one existing property of
        // mine is always a "connection" event worth animating client-side,
        // whether it's one property growing or several merging into one.
        newlyConnected = true;
        targetPropertyId = existingIds[0];
        if (existingIds.length > 1) {
          const others = existingIds.slice(1);
          await tx.pixelOwnership.updateMany({
            where: { propertyId: { in: others } },
            data: { propertyId: targetPropertyId },
          });
          await tx.propertyDecoration.updateMany({
            where: { propertyId: { in: others } },
            data: { propertyId: targetPropertyId },
          });
          await tx.defense.updateMany({ where: { propertyId: { in: others } }, data: { propertyId: targetPropertyId } });
          await tx.property.deleteMany({ where: { id: { in: others } } });
        }
      }

      await tx.pixelOwnership.createMany({
        data: groupCoords.map((c) => ({
          worldId,
          x: c.x,
          y: c.y,
          ownerId: userId,
          propertyId: targetPropertyId,
          colorHex,
          purchasePriceCents: world.pixelPriceCents,
        })),
      });

      const agg = await tx.pixelOwnership.aggregate({
        where: { propertyId: targetPropertyId },
        _count: true,
        _min: { x: true, y: true },
        _max: { x: true, y: true },
      });
      await tx.property.update({
        where: { id: targetPropertyId },
        data: {
          pixelCount: agg._count,
          minX: agg._min.x ?? 0,
          minY: agg._min.y ?? 0,
          maxX: agg._max.x ?? 0,
          maxY: agg._max.y ?? 0,
        },
      });

      affectedPropertyIds.push(targetPropertyId);
    }

    await applyLedgerEntry(tx, {
      type: "PLATFORM_PURCHASE",
      grossCents: totalCents,
      fromUserId: userId,
      toUserId: null,
      propertyId: affectedPropertyIds.length === 1 ? affectedPropertyIds[0] : null,
      description: `Purchased ${coords.length.toLocaleString()} pixel${coords.length === 1 ? "" : "s"} on ${world.name}`,
      applyPlatformFee: false,
    });

    await tx.world.update({ where: { id: worldId }, data: { ownedPixelCount: { increment: coords.length } } });

    await notifyUser(
      userId,
      {
        type: "LAND_PURCHASED",
        title: "Land purchased",
        message: `You bought ${coords.length.toLocaleString()} pixel${coords.length === 1 ? "" : "s"} on ${world.name}.`,
        data: { worldId, propertyIds: affectedPropertyIds },
      },
      tx
    );

    return { purchasedCount: coords.length, totalCents, propertyIds: [...new Set(affectedPropertyIds)], newlyConnected };
  });

  return result;
}

// --- Property queries & customization -----------------------------------

export async function listPlayerProperties(userId: string, worldId?: string) {
  return prisma.property.findMany({
    where: { ownerId: userId, ...(worldId ? { worldId } : {}) },
    include: { world: { select: { key: true, name: true } }, defenses: { where: { isActive: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPropertyDetail(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      world: true,
      owner: { select: { id: true, username: true } },
      decorations: true,
      defenses: { where: { isActive: true } },
      pixels: { select: { x: true, y: true, colorHex: true } },
    },
  });
  if (!property) throw ApiError.notFound("Property not found");
  return property;
}

export async function setPropertyColor(userId: string, propertyId: string, colorHex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) throw ApiError.badRequest("colorHex must look like #RRGGBB");
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw ApiError.notFound("Property not found");
  if (property.ownerId !== userId) throw ApiError.forbidden("You do not own this property");

  await prisma.pixelOwnership.updateMany({ where: { propertyId }, data: { colorHex } });
  return prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
}

export async function renameProperty(userId: string, propertyId: string, name: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw ApiError.notFound("Property not found");
  if (property.ownerId !== userId) throw ApiError.forbidden("You do not own this property");
  return prisma.property.update({ where: { id: propertyId }, data: { name: name.slice(0, 60) } });
}
