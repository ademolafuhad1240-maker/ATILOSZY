import "server-only";

import type {
  OrderPaymentMethod,
  Prisma,
} from "@/generated/prisma/client";

import type {
  ProductPaymentEventOutcome,
} from "../types";

export interface PaymentWebhookRequest {
  rawBody: Uint8Array;
  rawText: string;
  signature:
    string |
    null;
}

export interface NormalizedPaymentWebhookEvent {
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  payload:
    Prisma.InputJsonValue;
  providerReference: string;
  amount: string;
  currencyCode: string;
  outcome:
    ProductPaymentEventOutcome;
  method?:
    OrderPaymentMethod;
  failureCode?: string;
  failureMessage?: string;
}

export type PaymentWebhookNormalization =
  | {
      kind: "IGNORED";
      eventType:
        string |
        null;
    }
  | {
      kind: "EVENT";
      event:
        NormalizedPaymentWebhookEvent;
    };

export interface PaymentWebhookProvider {
  readonly name: string;
  readonly signatureHeader: string;

  normalize(
    request:
      PaymentWebhookRequest,
  ): Promise<
    PaymentWebhookNormalization
  >;
}
