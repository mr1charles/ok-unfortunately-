import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { worldRouter } from "./routes/world.js";
import { walletRouter } from "./routes/wallet.js";
import { marketplaceRouter } from "./routes/marketplace.js";
import { auctionsRouter } from "./routes/auctions.js";
import { decorationsRouter } from "./routes/decorations.js";
import { notificationsRouter } from "./routes/notifications.js";
import { reportsRouter } from "./routes/reports.js";
import { adminRouter } from "./routes/admin.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use("/api/auth", authRouter);
  app.use("/api/users/me", usersRouter);
  app.use("/api/world", worldRouter);
  app.use("/api/wallet", walletRouter);
  app.use("/api/marketplace", marketplaceRouter);
  app.use("/api/auctions", auctionsRouter);
  app.use("/api/decorations", decorationsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
