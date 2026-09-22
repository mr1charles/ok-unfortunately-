/**
 * Payment provider abstraction.
 *
 * The rest of the app (walletService, routes/wallet.ts) never talks to a
 * payment vendor directly - it only calls this interface. That means the
 * entire game (land purchases, marketplace, auctions) is built on top of an
 * internal wallet ledger (Balance + Transaction tables), and real money only
 * crosses the platform boundary at two points: deposits (top-ups) and
 * withdrawals (cash-outs). Swapping MockPaymentProvider for a real
 * StripePaymentProvider later means implementing this same interface with
 * Stripe PaymentIntents (deposits) and Stripe Connect transfers/payouts
 * (withdrawals) - no other file in the app needs to change.
 *
 * A production implementation would typically make createDeposit()
 * return status "pending" and rely on a webhook route to call
 * walletService.confirmDeposit() once Stripe confirms the charge. The mock
 * implementation instead resolves instantly with status "succeeded" since
 * there is no real money movement to wait on.
 */

export type PaymentStatus = "succeeded" | "pending" | "failed";

export interface PaymentResult {
  providerRef: string;
  status: PaymentStatus;
  amountCents: number;
}

export interface DepositParams {
  userId: string;
  amountCents: number;
  /** e.g. { source: "dev-mock-topup" } or a real card/payment-method token in production */
  metadata?: Record<string, string>;
}

export interface WithdrawalParams {
  userId: string;
  amountCents: number;
  metadata?: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: string;
  createDeposit(params: DepositParams): Promise<PaymentResult>;
  createWithdrawal(params: WithdrawalParams): Promise<PaymentResult>;
}
