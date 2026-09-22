import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN } from "@pixel-estates/shared";
import { env } from "../env.js";

export interface AuthTokenPayload {
  userId: string;
  role: "PLAYER" | "ADMIN";
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}
