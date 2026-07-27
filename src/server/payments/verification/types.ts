import "server-only";

import type {
  OrderPaymentMethod,
  Prisma,
} from "@/generated/prisma/client";

export type PaymentVerificationOutcome =
  | "SUCCEEDED"
  | "FAILED"
  | "PENDING";

export interface PaymentVerificationRequest {
  providerReference: string;
  transactionId?: string;
}

export interface PaymentVerificationResult {
  provider: string;
  transactionId: string;
  providerReference: string;
  amount: string;
  currencyCode: string;
  providerStatus: string;
  outcome:
    PaymentVerificationOutcome;
  method?:
    OrderPaymentMethod;
  payload:
    Prisma.InputJsonValue;
}

export interface PaymentVerificationProvider {
  readonly name: string;

  verify(
    request:
      PaymentVerificationRequest,
  ): Promise<
    PaymentVerificationResult
  >;
}
