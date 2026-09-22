import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@pixel-estates/shared";
import type { CharacterAppearance } from "@pixel-estates/shared";

export async function getCharacter(userId: string) {
  const character = await prisma.character.findUnique({ where: { userId } });
  if (!character) throw ApiError.notFound("Character not found");
  return character;
}

export async function updateAppearance(userId: string, appearance: CharacterAppearance) {
  return prisma.character.update({
    where: { userId },
    data: { appearance: appearance as unknown as Prisma.InputJsonValue },
  });
}

export async function updatePosition(userId: string, x: number, y: number) {
  const clampedX = Math.max(0, Math.min(WORLD_WIDTH - 1, Math.round(x)));
  const clampedY = Math.max(0, Math.min(WORLD_HEIGHT - 1, Math.round(y)));
  return prisma.character.update({
    where: { userId },
    data: { positionX: clampedX, positionY: clampedY },
  });
}
