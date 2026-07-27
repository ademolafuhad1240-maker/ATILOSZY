import "server-only";

import type {
  CompleteProductPaymentReconciliationAttemptInput,
  ProcessProductPaymentEventInput,
  ProductPaymentEventResult,
  ProductPaymentReconciliationStart,
  ProductPaymentTransitionView,
  ReconcileProductPaymentInput,
} from "../types";
import type {
  PaymentVerificationProvider,
} from "../verification";

export type PaymentReconciliationDisposition =
  | "PAID"
  | "FAILED"
  | "PENDING"
  | "RATE_LIMITED"
  | "UNCHANGED";

export interface PaymentReconciliationResult {
  disposition:
    PaymentReconciliationDisposition;
  checkedAt: string | null;
  retryAfterSeconds: number;
  payment:
    ProductPaymentTransitionView;
}

export interface PaymentReconciliationStore {
  begin(
    input:
      ReconcileProductPaymentInput,
  ): Promise<
    ProductPaymentReconciliationStart
  >;

  complete(
    input:
      CompleteProductPaymentReconciliationAttemptInput,
  ): Promise<void>;

  processEvent(
    input:
      ProcessProductPaymentEventInput,
  ): Promise<
    ProductPaymentEventResult
  >;
}

export interface PaymentReconciliationDependencies {
  store:
    PaymentReconciliationStore;
  resolveProvider(
    providerName: string,
  ): PaymentVerificationProvider;
}
