import type { DefenseKind } from "@prisma/client";
import { DEFENSE_CATALOG } from "@pixel-estates/shared";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { spendCredits } from "./creditService.js";

export function getCatalog() {
  return DEFENSE_CATALOG;
}

export async function listPropertyDefenses(propertyId: string) {
  return prisma.defense.findMany({ where: { propertyId, isActive: true } });
}

/** The strongest active defense (most remaining charges) on a property, or
 * null if undefended. Used by attackService to decide BLOCKED vs. rolled. */
export async function getActiveDefense(propertyId: string) {
  return prisma.defense.findFirst({
    where: { propertyId, isActive: true, charges: { gt: 0 } },
    orderBy: { charges: "desc" },
  });
}

export async function purchaseDefense(userId: string, propertyId: string, kind: DefenseKind) {
  const catalogEntry = DEFENSE_CATALOG.find((d) => d.kind === kind);
  if (!catalogEntry) throw ApiError.badRequest("Unknown defense type");

  return prisma.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: propertyId } });
    if (!property) throw ApiError.notFound("Property not found");
    if (property.ownerId !== userId) throw ApiError.forbidden("You do not own this property");

    await spendCredits(tx, userId, catalogEntry.creditCost, `Purchased ${catalogEntry.label}`, "DEFENSE", propertyId);

    const existing = await tx.defense.findFirst({ where: { propertyId, kind, isActive: true } });
    if (existing) {
      return tx.defense.update({
        where: { id: existing.id },
        data: { charges: { increment: catalogEntry.charges } },
      });
    }
    return tx.defense.create({
      data: { propertyId, kind, charges: catalogEntry.charges },
    });
  });
}

/** Consumes one charge of a defense (e.g. after blocking an attack),
 * deactivating it once depleted. */
export async function consumeDefenseCharge(defenseId: string) {
  const defense = await prisma.defense.findUnique({ where: { id: defenseId } });
  if (!defense) return null;
  const remaining = Math.max(0, defense.charges - 1);
  return prisma.defense.update({
    where: { id: defenseId },
    data: { charges: remaining, isActive: remaining > 0 },
  });
}
