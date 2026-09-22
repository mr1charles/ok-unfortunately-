import { PrismaClient } from "@prisma/client";
import { env } from "../env.js";

// Reuse a single PrismaClient instance (important with tsx watch / hot
// reload, which would otherwise exhaust Postgres connections).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ["error", "warn"] : ["error", "warn"],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
