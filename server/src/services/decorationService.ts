import { DECORATION_CATALOG, PLOT_DECORATION_GRID_SIZE } from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";

export function getCatalog() {
  return DECORATION_CATALOG;
}

export async function getUserInventory(userId: string) {
  return prisma.inventoryItem.findMany({ where: { userId } });
}

export async function listPlotDecorations(plotId: string) {
  return prisma.landDecoration.findMany({ where: { plotId }, orderBy: { createdAt: "asc" } });
}

/**
 * Places a decoration on the owner's plot. Uses a simple tile-based grid
 * (PLOT_DECORATION_GRID_SIZE x PLOT_DECORATION_GRID_SIZE per plot) with
 * single-cell occupancy collision checking - a deliberately simple v1 that
 * a future pass can extend to full multi-cell footprint collision using
 * each catalog entry's `footprint`.
 */
export async function placeDecoration(
  userId: string,
  plotId: string,
  params: { objectType: string; x: number; y: number; rotation?: number }
) {
  const catalogEntry = DECORATION_CATALOG.find((c) => c.key === params.objectType);
  if (!catalogEntry) throw ApiError.badRequest("Unknown decoration type");
  if (params.x < 0 || params.y < 0 || params.x >= PLOT_DECORATION_GRID_SIZE || params.y >= PLOT_DECORATION_GRID_SIZE) {
    throw ApiError.badRequest("Placement is outside the plot's buildable area");
  }

  return prisma.$transaction(async (tx) => {
    const plot = await tx.landPlot.findUnique({ where: { id: plotId } });
    if (!plot) throw ApiError.notFound("Plot not found");
    if (plot.ownerId !== userId) throw ApiError.forbidden("You do not own this plot");

    const inventoryItem = await tx.inventoryItem.findUnique({
      where: { userId_objectType: { userId, objectType: params.objectType } },
    });
    if (!inventoryItem || inventoryItem.quantity === 0) {
      throw ApiError.forbidden("You have not unlocked this decoration");
    }

    const collision = await tx.landDecoration.findFirst({
      where: { plotId, x: params.x, y: params.y },
    });
    if (collision) throw ApiError.conflict("That tile is already occupied");

    const decoration = await tx.landDecoration.create({
      data: {
        plotId,
        objectType: params.objectType,
        x: params.x,
        y: params.y,
        rotation: params.rotation ?? 0,
        placedByUserId: userId,
      },
    });

    if (inventoryItem.quantity > 0) {
      await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: { quantity: { decrement: 1 } },
      });
    }

    return decoration;
  });
}

export async function removeDecoration(userId: string, decorationId: string) {
  return prisma.$transaction(async (tx) => {
    const decoration = await tx.landDecoration.findUnique({ where: { id: decorationId }, include: { plot: true } });
    if (!decoration) throw ApiError.notFound("Decoration not found");
    if (decoration.plot.ownerId !== userId) throw ApiError.forbidden("You do not own this plot");

    await tx.landDecoration.delete({ where: { id: decorationId } });

    const inventoryItem = await tx.inventoryItem.findUnique({
      where: { userId_objectType: { userId, objectType: decoration.objectType } },
    });
    if (inventoryItem && inventoryItem.quantity >= 0) {
      await tx.inventoryItem.update({ where: { id: inventoryItem.id }, data: { quantity: { increment: 1 } } });
    }

    return decoration;
  });
}
