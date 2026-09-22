import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { fileReport } from "../services/reportService.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const reportSchema = z.object({
  targetType: z.enum(["LISTING", "AUCTION", "USER", "PLOT"]),
  targetId: z.string(),
  plotId: z.string().uuid().optional(),
  reason: z.string().min(3).max(500),
});

reportsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = reportSchema.parse(req.body);
    const report = await fileReport(req.user!.id, body);
    res.status(201).json({ report });
  })
);
