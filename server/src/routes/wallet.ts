import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { depositFunds, getBalanceCents, listUserTransactions, withdrawFunds } from "../services/walletService.js";
import { env } from "../env.js";
import { ApiError } from "../utils/apiError.js";

export const walletRouter = Router();
walletRouter.use(requireAuth);

walletRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const balanceCents = await getBalanceCents(req.user!.id);
    res.json({ balanceCents });
  })
);

const depositSchema = z.object({ amountCents: z.number().int().positive() });

/** Mock wallet top-up. In development this is a free "add test funds"
 * button; in production this same endpoint would instead kick off a real
 * PaymentProvider deposit flow (e.g. return a Stripe client secret) -
 * the request/response shape is designed to not need to change. */
walletRouter.post(
  "/deposit",
  asyncHandler(async (req, res) => {
    const { amountCents } = depositSchema.parse(req.body);
    if (env.isProduction) {
      throw ApiError.forbidden("Real-money deposits are not enabled in this prototype");
    }
    const transaction = await depositFunds(req.user!.id, amountCents, "dev-mock-topup");
    const balanceCents = await getBalanceCents(req.user!.id);
    res.status(201).json({ transaction, balanceCents });
  })
);

const withdrawSchema = z.object({ amountCents: z.number().int().positive() });

walletRouter.post(
  "/withdraw",
  asyncHandler(async (req, res) => {
    const { amountCents } = withdrawSchema.parse(req.body);
    const result = await withdrawFunds(req.user!.id, amountCents);
    const balanceCents = await getBalanceCents(req.user!.id);
    res.status(201).json({ ...result, balanceCents });
  })
);

walletRouter.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const transactions = await listUserTransactions(req.user!.id);
    res.json({ transactions });
  })
);
