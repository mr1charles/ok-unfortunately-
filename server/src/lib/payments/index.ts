import { MockPaymentProvider } from "./MockPaymentProvider.js";
import type { PaymentProvider } from "./PaymentProvider.js";

// When a real processor is ready, branch here on env.paymentProvider
// (e.g. "stripe") and return a `new StripePaymentProvider(...)` that
// implements the same interface. Nothing else in the codebase changes.
export const paymentProvider: PaymentProvider = new MockPaymentProvider();

export type { PaymentProvider, DepositParams, WithdrawalParams, PaymentResult } from "./PaymentProvider.js";
