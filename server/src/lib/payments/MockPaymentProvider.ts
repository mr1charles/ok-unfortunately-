import { randomUUID } from "node:crypto";
import type {
  DepositParams,
  PaymentProvider,
  PaymentResult,
  WithdrawalParams,
} from "./PaymentProvider.js";

/**
 * Development/prototype payment provider. Simulates an instantly-successful
 * charge or payout with no real money movement, so the whole game can be
 * exercised end-to-end (deposits, purchases, auctions, payouts) without any
 * external payment vendor configured. Never used when a real provider
 * (e.g. Stripe) is wired up for production.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createDeposit(params: DepositParams): Promise<PaymentResult> {
    return {
      providerRef: `mock_dep_${randomUUID()}`,
      status: "succeeded",
      amountCents: params.amountCents,
    };
  }

  async createWithdrawal(params: WithdrawalParams): Promise<PaymentResult> {
    return {
      providerRef: `mock_wd_${randomUUID()}`,
      status: "succeeded",
      amountCents: params.amountCents,
    };
  }
}
