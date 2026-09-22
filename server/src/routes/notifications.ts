import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listNotifications, markAllNotificationsRead, markNotificationRead, unreadCount } from "../services/notificationService.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await listNotifications(req.user!.id);
    res.json({ notifications });
  })
);

notificationsRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const count = await unreadCount(req.user!.id);
    res.json({ count });
  })
);

notificationsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await markNotificationRead(req.user!.id, req.params.id);
    res.status(204).end();
  })
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await markAllNotificationsRead(req.user!.id);
    res.status(204).end();
  })
);
