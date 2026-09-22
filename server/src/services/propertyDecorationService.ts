import { DECORATION_CATALOG } from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";

/** Buildings/trees/roads/signs/lights placed on a Property. Reuses the same
 * DECORATION_CATALOG as the original 24x24 grid system's LandDecoration -
 * one catalog, two placement surfaces. */
export function getCatalog() {
  return DECORATION_CATALOG;
}

export async function listPropertyDecorations(propertyId: string) {
  return prisma.propertyDecoration.findMany({ where: { propertyId }, orderBy: { createdAt: "asc" } });
}

export async function placeDecoration(userId: string, propertyId: string, params: { objectType: string; x: number; y: number; rotation?: number }) {
  const catalogEntry = DECORATION_CATALOG.find((c) => c.key === params.objectType);
  if (!catalogEntry) throw ApiError.badRequest("Unknown decoration type");

  return prisma.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: propertyId } });
    if (!property) throw ApiError.notFound("Property not found");
    if (property.ownerId !== userId) throw ApiError.forbidden("You do not own this property");
    if (params.x < property.minX || params.x > property.maxX || params.y < property.minY || params.y > property.maxY) {
      throw ApiError.badRequest("Placement must be within your property's bounds");
    }

    // Must be placed on a pixel you actually own within this property.
    const pixel = await tx.pixelOwnership.findUnique({ where: { worldId_x_y: { worldId: property.worldId, x: params.x, y: params.y } } });
    if (!pixel || pixel.propertyId !== propertyId) {
      throw ApiError.badRequest("You can only decorate pixels that are part of this property");
    }

    const collision = await tx.propertyDecoration.findFirst({ where: { propertyId, x: params.x, y: params.y } });
    if (collision) throw ApiError.conflict("That tile already has something on it");

    return tx.propertyDecoration.create({
      data: { propertyId, objectType: params.objectType, x: params.x, y: params.y, rotation: params.rotation ?? 0, placedByUserId: userId },
    });
  });
}

export async function removeDecoration(userId: string, decorationId: string) {
  const decoration = await prisma.propertyDecoration.findUnique({ where: { id: decorationId }, include: { property: true } });
  if (!decoration) throw ApiError.notFound("Decoration not found");
  if (decoration.property.ownerId !== userId) throw ApiError.forbidden("You do not own this property");
  await prisma.propertyDecoration.delete({ where: { id: decorationId } });
  return decoration;
}
