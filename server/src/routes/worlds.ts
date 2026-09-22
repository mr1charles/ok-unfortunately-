import { Router } from "express";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as worldService from "../services/worldService.js";
import * as pixelService from "../services/pixelService.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";

export const worldsRouter = Router();

worldsRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const includeTestCopies = req.user?.role === "ADMIN" && req.query.includeTestCopies === "true";
    const worlds = await worldService.listWorlds({ includeTestCopies });
    res.json({ worlds });
  })
);

worldsRouter.get(
  "/:key",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const world = await worldService.getWorldByKey(req.params.key);
    res.json({ world: worldService.toWorldSummary(world) });
  })
);

const chunksQuerySchema = z.object({
  cx: z.coerce.number().int(),
  cy: z.coerce.number().int(),
  radius: z.coerce.number().int().min(0).max(6).default(2),
});

worldsRouter.get(
  "/:worldId/chunks",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { cx, cy, radius } = chunksQuerySchema.parse(req.query);
    const data = await pixelService.getChunkPixels(req.params.worldId, cx, cy, radius);
    res.json(data);
  })
);

const pixelParamsSchema = z.object({ x: z.coerce.number().int(), y: z.coerce.number().int() });

worldsRouter.get(
  "/:worldId/pixels/:x/:y",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { x, y } = pixelParamsSchema.parse(req.params);
    const info = await pixelService.getPixelInfo(req.params.worldId, x, y);
    res.json(info);
  })
);

const coordSchema = z.object({ x: z.number().int(), y: z.number().int() });
const purchaseSchema = z.union([
  z.object({ mode: z.literal("points"), coords: z.array(coordSchema).min(1).max(5000), colorHex: z.string().optional() }),
  z.object({
    mode: z.literal("rect"),
    x1: z.number().int(),
    y1: z.number().int(),
    x2: z.number().int(),
    y2: z.number().int(),
    colorHex: z.string().optional(),
  }),
]);

worldsRouter.post(
  "/:worldId/pixels/purchase",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = purchaseSchema.parse(req.body);
    const coords = body.mode === "rect" ? pixelService.expandRect(body.x1, body.y1, body.x2, body.y2) : body.coords;
    const result = await pixelService.purchasePixels(req.user!.id, req.params.worldId, { coords, colorHex: body.colorHex });
    res.status(201).json(result);
  })
);

worldsRouter.get(
  "/:worldId/properties/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const properties = await pixelService.listPlayerProperties(req.user!.id, req.params.worldId);
    res.json({ properties });
  })
);

/** Lightweight world-wide leaderboard: top property owners by total pixels. */
worldsRouter.get(
  "/:worldId/rankings",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const worldId = req.params.worldId;
    const world = await prisma.world.findUnique({ where: { id: worldId } });
    if (!world) throw ApiError.notFound("World not found");
    const grouped = await prisma.pixelOwnership.groupBy({
      by: ["ownerId"],
      where: { worldId },
      _count: { _all: true },
      orderBy: { _count: { ownerId: "desc" } },
      take: 20,
    });
    const users = await prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.ownerId) } },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.username]));
    res.json({
      rankings: grouped.map((g, i) => ({
        rank: i + 1,
        userId: g.ownerId,
        username: userMap.get(g.ownerId) ?? "unknown",
        pixelsOwned: g._count._all,
      })),
    });
  })
);
