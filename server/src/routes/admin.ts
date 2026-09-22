import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { adminOnly } from "../middleware/adminOnly.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as adminService from "../services/adminService.js";
import { cancelListing, pauseListing } from "../services/marketplaceService.js";
import { cancelAuction } from "../services/auctionService.js";
import { getOrCreateConfig, setPlatformFeePercent } from "../services/platformConfigService.js";
import { listReports, resolveReport } from "../services/reportService.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, adminOnly);

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const stats = await adminService.getPlatformStats();
    res.json({ stats });
  })
);

adminRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const config = await getOrCreateConfig();
    res.json({ config });
  })
);

const feeSchema = z.object({ platformFeePercent: z.number().int().min(0).max(100) });

adminRouter.patch(
  "/config",
  asyncHandler(async (req, res) => {
    const { platformFeePercent } = feeSchema.parse(req.body);
    const config = await setPlatformFeePercent(platformFeePercent, req.user!.id);
    res.json({ config });
  })
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await adminService.listUsers(req.query.q as string | undefined);
    res.json({ users });
  })
);

const banSchema = z.object({ banned: z.boolean() });

adminRouter.patch(
  "/users/:id/ban",
  asyncHandler(async (req, res) => {
    const { banned } = banSchema.parse(req.body);
    const user = await adminService.setUserBanned(req.params.id, banned);
    res.json({ user });
  })
);

adminRouter.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const transactions = await adminService.listRecentTransactions(limit);
    res.json({ transactions });
  })
);

const flagSchema = z.object({ flagged: z.boolean(), reason: z.string().optional() });

adminRouter.patch(
  "/transactions/:id/flag",
  asyncHandler(async (req, res) => {
    const { flagged, reason } = flagSchema.parse(req.body);
    const transaction = await adminService.setTransactionFlag(req.params.id, flagged, reason);
    res.json({ transaction });
  })
);

const pauseSchema = z.object({ paused: z.boolean() });

adminRouter.patch(
  "/listings/:id/pause",
  asyncHandler(async (req, res) => {
    const { paused } = pauseSchema.parse(req.body);
    const listing = await pauseListing(req.params.id, paused);
    res.json({ listing });
  })
);

adminRouter.delete(
  "/listings/:id",
  asyncHandler(async (req, res) => {
    const listing = await cancelListing(req.user!.id, req.params.id, true);
    res.json({ listing });
  })
);

adminRouter.delete(
  "/auctions/:id",
  asyncHandler(async (req, res) => {
    const auction = await cancelAuction(req.user!.id, req.params.id, true);
    res.json({ auction });
  })
);

const unavailableSchema = z.object({ unavailable: z.boolean() });

adminRouter.patch(
  "/plots/:id/availability",
  asyncHandler(async (req, res) => {
    const { unavailable } = unavailableSchema.parse(req.body);
    const plot = await adminService.setPlotUnavailable(req.params.id, unavailable);
    res.json({ plot });
  })
);

adminRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const reports = await listReports(req.query.status as string | undefined);
    res.json({ reports });
  })
);

const resolveReportSchema = z.object({ status: z.enum(["RESOLVED", "DISMISSED"]) });

adminRouter.patch(
  "/reports/:id",
  asyncHandler(async (req, res) => {
    const { status } = resolveReportSchema.parse(req.body);
    const report = await resolveReport(req.params.id, status);
    res.json({ report });
  })
);
