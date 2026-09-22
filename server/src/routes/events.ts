import { Router } from "express";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as eventService from "../services/eventService.js";

export const eventsRouter = Router();

eventsRouter.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const activeOnly = req.query.active === "true";
    const events = await eventService.listEvents(activeOnly);
    res.json({ events });
  })
);

eventsRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const event = await eventService.getEvent(req.params.id);
    res.json({ event });
  })
);

const claimSchema = z.object({ eventItemId: z.string().uuid() });

eventsRouter.post(
  "/items/claim",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { eventItemId } = claimSchema.parse(req.body);
    const claimed = await eventService.claimEventItem(req.user!.id, eventItemId);
    res.status(201).json({ claimed });
  })
);

eventsRouter.get(
  "/me/inventory",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await eventService.listPlayerEventItems(req.user!.id);
    res.json({ items });
  })
);
