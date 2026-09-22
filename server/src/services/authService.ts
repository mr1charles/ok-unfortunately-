import bcrypt from "bcryptjs";
import {
  DEFAULT_CHARACTER_APPEARANCE,
  DEV_STARTING_BALANCE_CENTS,
  DECORATION_CATALOG,
} from "@pixel-estates/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../env.js";
import { ApiError } from "../utils/apiError.js";
import { signAuthToken } from "../lib/jwt.js";
import { ensureBalanceRow } from "./walletService.js";

const BCRYPT_ROUNDS = 10;

export async function registerUser(params: { email: string; username: string; password: string }) {
  const email = params.email.trim().toLowerCase();
  const username = params.username.trim();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    throw ApiError.conflict(
      existing.email === email ? "An account with that email already exists" : "That username is taken"
    );
  }

  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, username, passwordHash },
    });
    await tx.character.create({
      data: {
        userId: created.id,
        appearance: DEFAULT_CHARACTER_APPEARANCE as unknown as Prisma.InputJsonValue,
      },
    });
    // Unlock the full starter decoration catalog for free so new players
    // can decorate their first plot immediately.
    await tx.inventoryItem.createMany({
      data: DECORATION_CATALOG.map((item) => ({
        userId: created.id,
        objectType: item.key,
        quantity: -1,
      })),
    });
    const startingBalance = env.isProduction ? 0 : DEV_STARTING_BALANCE_CENTS;
    await ensureBalanceRow(created.id, startingBalance, tx);
    return created;
  });

  const token = signAuthToken({ userId: user.id, role: user.role });
  return { user, token };
}

export async function loginUser(params: { emailOrUsername: string; password: string }) {
  const key = params.emailOrUsername.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: key }, { username: params.emailOrUsername.trim() }] },
  });
  if (!user) throw ApiError.unauthorized("Invalid credentials");
  if (user.isBanned) throw ApiError.forbidden("This account has been suspended");

  const valid = await bcrypt.compare(params.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid credentials");

  const token = signAuthToken({ userId: user.id, role: user.role });
  return { user, token };
}
