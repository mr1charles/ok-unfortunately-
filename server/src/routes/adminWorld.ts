import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { adminOnly } from "../middleware/adminOnly.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as worldService from "../services/worldService.js";
import * as adminWorldService from "../services/adminWorldService.js";
import * as attackService from "../services/attackService.js";
import * as eventService from "../services/eventService.js";
import { listAdminActionLog } from "../services/adminActionLogService.js";

export const adminWorldRouter = Router();
adminWorldRouter.use(requireAuth, adminOnly);

// --- World CRUD ------------------------------------------------------------

const createWorldSchema = z.object({
  key: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(60),
  description: z.string().max(300).optional(),
  emoji: z.string().max(8).optional(),
  kind: z.enum(["STANDARD", "EVENT"]).optional(),
  pixelWidth: z.number().int().positive(),
  pixelHeight: z.number().int().positive(),
  pixelPriceCents: z.number().int().positive().optional(),
  chunkSize: z.number().int().positive().optional(),
  maxPixelsPerPurchase: z.number().int().positive().optional(),
  maxPropertiesPerPlayer: z.number().int().positive().nullable().optional(),
});

adminWorldRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createWorldSchema.parse(req.body);
    const world = await worldService.createWorld(req.user!.id, body);
    res.status(201).json({ world });
  })
);

const cloneSchema = z.object({ reason: z.string().max(300).optional() });

adminWorldRouter.post(
  "/:worldId/test-copy",
  asyncHandler(async (req, res) => {
    const { reason } = cloneSchema.parse(req.body ?? {});
    const world = await worldService.cloneAsTestWorld(req.user!.id, req.params.worldId, reason);
    res.status(201).json({ world });
  })
);

adminWorldRouter.delete(
  "/:worldId",
  asyncHandler(async (req, res) => {
    const { reason } = cloneSchema.parse(req.body ?? {});
    const result = await worldService.deleteWorld(req.user!.id, req.params.worldId, reason);
    res.json(result);
  })
);

const activeSchema = z.object({ isActive: z.boolean(), reason: z.string().max(300).optional() });

adminWorldRouter.patch(
  "/:worldId/active",
  asyncHandler(async (req, res) => {
    const { isActive, reason } = activeSchema.parse(req.body);
    const world = await worldService.setWorldActive(req.user!.id, req.params.worldId, isActive, reason);
    res.json({ world });
  })
);

const priceSchema = z.object({ pixelPriceCents: z.number().int().positive(), reason: z.string().max(300).optional() });

adminWorldRouter.patch(
  "/:worldId/pixel-price",
  asyncHandler(async (req, res) => {
    const { pixelPriceCents, reason } = priceSchema.parse(req.body);
    const world = await worldService.updateWorldPixelPrice(req.user!.id, req.params.worldId, pixelPriceCents, reason);
    res.json({ world });
  })
);

// --- Attack config -----------------------------------------------------

adminWorldRouter.get(
  "/attack-config",
  asyncHandler(async (_req, res) => {
    const config = await attackService.getOrCreateAttackConfig();
    res.json({ config });
  })
);

const attackConfigSchema = z.object({
  maxAttacksPerDay: z.number().int().positive().optional(),
  successRatePct: z.number().int().min(0).max(100).optional(),
  criticalRatePct: z.number().int().min(0).max(100).optional(),
  failRatePct: z.number().int().min(0).max(100).optional(),
  creditRewardMin: z.number().int().min(0).optional(),
  creditRewardMax: z.number().int().min(0).optional(),
  criticalRewardMin: z.number().int().min(0).optional(),
  criticalRewardMax: z.number().int().min(0).optional(),
  attacksEnabled: z.boolean().optional(),
  reason: z.string().max(300).optional(),
});

adminWorldRouter.patch(
  "/attack-config",
  asyncHandler(async (req, res) => {
    const { reason, ...params } = attackConfigSchema.parse(req.body);
    const config = await attackService.updateAttackConfig(req.user!.id, params, reason);
    res.json({ config });
  })
);

// --- Events --------------------------------------------------------------

const createEventSchema = z.object({
  key: z.string().min(2).max(40),
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  emoji: z.string().max(8).optional(),
  worldId: z.string().uuid().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  items: z.array(z.object({ objectType: z.string(), name: z.string(), emoji: z.string().optional(), isLimited: z.boolean().optional() })).default([]),
});

adminWorldRouter.post(
  "/events",
  asyncHandler(async (req, res) => {
    const body = createEventSchema.parse(req.body);
    const event = await eventService.createEvent(req.user!.id, body);
    res.status(201).json({ event });
  })
);

const eventActiveSchema = z.object({ isActive: z.boolean() });

adminWorldRouter.patch(
  "/events/:eventId/active",
  asyncHandler(async (req, res) => {
    const { isActive } = eventActiveSchema.parse(req.body);
    const event = await eventService.setEventActive(req.user!.id, req.params.eventId, isActive);
    res.json({ event });
  })
);

// --- Action log ----------------------------------------------------------

adminWorldRouter.get(
  "/action-log",
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 200;
    const log = await listAdminActionLog(limit);
    res.json({ log });
  })
);

// --- Sandbox ---------------------------------------------------------------
// Every sandbox action defaults to test-copy-only; see adminWorldService for
// the allowProduction escape hatch (still fully logged either way).

const grantCashSchema = z.object({ userId: z.string().uuid(), amountCents: z.number().int().positive(), reason: z.string().min(1).max(300), allowProduction: z.boolean().optional() });

adminWorldRouter.post(
  "/:worldId/sandbox/grant-cash",
  asyncHandler(async (req, res) => {
    const { userId, amountCents, reason, allowProduction } = grantCashSchema.parse(req.body);
    const result = await adminWorldService.sandboxGrantCash(req.user!.id, req.params.worldId, userId, amountCents, reason, allowProduction);
    res.status(201).json({ result });
  })
);

const grantCreditsSchema = z.object({ userId: z.string().uuid(), amount: z.number().int().positive(), reason: z.string().min(1).max(300), allowProduction: z.boolean().optional() });

adminWorldRouter.post(
  "/:worldId/sandbox/grant-credits",
  asyncHandler(async (req, res) => {
    const { userId, amount, reason, allowProduction } = grantCreditsSchema.parse(req.body);
    const result = await adminWorldService.sandboxGrantCredits(req.user!.id, req.params.worldId, userId, amount, reason, allowProduction);
    res.status(201).json({ result });
  })
);

const instantBuySchema = z.object({
  userId: z.string().uuid(),
  coords: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1).max(5000),
  reason: z.string().min(1).max(300),
  allowProduction: z.boolean().optional(),
});

adminWorldRouter.post(
  "/:worldId/sandbox/instant-buy",
  asyncHandler(async (req, res) => {
    const { userId, coords, reason, allowProduction } = instantBuySchema.parse(req.body);
    const result = await adminWorldService.sandboxInstantBuy(req.user!.id, req.params.worldId, userId, coords, reason, allowProduction);
    res.status(201).json({ result });
  })
);

const triggerAttackSchema = z.object({ attackerId: z.string().uuid(), reason: z.string().min(1).max(300), allowProduction: z.boolean().optional() });

adminWorldRouter.post(
  "/:worldId/sandbox/trigger-attack",
  asyncHandler(async (req, res) => {
    const { attackerId, reason, allowProduction } = triggerAttackSchema.parse(req.body);
    const outcome = await adminWorldService.sandboxTriggerAttack(req.user!.id, req.params.worldId, attackerId, reason, allowProduction);
    res.status(201).json(outcome);
  })
);

const forceShieldSchema = z.object({
  propertyId: z.string().uuid(),
  kind: z.enum(["SHIELD", "ENERGY_BARRIER", "SECURITY_TOWER"]),
  charges: z.number().int().positive().default(5),
  reason: z.string().min(1).max(300),
  allowProduction: z.boolean().optional(),
});

adminWorldRouter.post(
  "/:worldId/sandbox/force-shield",
  asyncHandler(async (req, res) => {
    const { propertyId, kind, charges, reason, allowProduction } = forceShieldSchema.parse(req.body);
    const defense = await adminWorldService.sandboxForceShield(req.user!.id, req.params.worldId, propertyId, kind, charges, reason, allowProduction);
    res.status(201).json({ defense });
  })
);

const endAuctionSchema = z.object({ auctionId: z.string().uuid(), reason: z.string().min(1).max(300), allowProduction: z.boolean().optional() });

adminWorldRouter.post(
  "/:worldId/sandbox/end-auction",
  asyncHandler(async (req, res) => {
    const { auctionId, reason, allowProduction } = endAuctionSchema.parse(req.body);
    const auction = await adminWorldService.sandboxEndAuctionNow(req.user!.id, req.params.worldId, auctionId, reason, allowProduction);
    res.json({ auction });
  })
);

const spawnDecorationsSchema = z.object({
  propertyId: z.string().uuid(),
  objectType: z.string(),
  count: z.number().int().positive().max(1000),
  reason: z.string().min(1).max(300),
  allowProduction: z.boolean().optional(),
});

adminWorldRouter.post(
  "/:worldId/sandbox/spawn-decorations",
  asyncHandler(async (req, res) => {
    const { propertyId, objectType, count, reason, allowProduction } = spawnDecorationsSchema.parse(req.body);
    const result = await adminWorldService.sandboxSpawnDecorations(req.user!.id, req.params.worldId, propertyId, objectType, count, reason, allowProduction);
    res.status(201).json(result);
  })
);
