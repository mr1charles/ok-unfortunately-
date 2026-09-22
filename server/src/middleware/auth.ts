import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export interface AuthedUser {
  id: string;
  username: string;
  email: string;
  role: "PLAYER" | "ADMIN";
  isBanned: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

/** Requires a valid JWT. Loads the current user fresh from the DB so role/ban
 * changes and balance-affecting state are always authoritative, never trusted
 * from the token payload alone. */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized();
  }
  const token = header.slice("Bearer ".length);

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired session");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) throw ApiError.unauthorized("Account no longer exists");
  if (user.isBanned) throw ApiError.forbidden("This account has been suspended");

  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isBanned: user.isBanned,
  };
  next();
});

/** Optional auth: attaches req.user if a valid token is present, but never rejects. */
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      const payload = verifyAuthToken(header.slice("Bearer ".length));
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (user && !user.isBanned) {
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isBanned: user.isBanned,
        };
      }
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
});
