import type {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  PaymentProviderEventStatus,
  Prisma,
} from "../../generated/prisma/client";

export interface InitiateProductPaymentInput {
  storefrontCode: string;
  userId: string;
  orderNumber: string;
  provider: string;
  providerReference: string;
  idempotencyKey: string;
  method: OrderPaymentMethod;
  providerMetadata?:
    Prisma.InputJsonValue;
}

export type ProductPaymentEventOutcome =
  | "SUCCEEDED"
  | "FAILED";

export interface ProcessProductPaymentEventInput {
  provider: string;
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  payload:
    Prisma.InputJsonValue;
  signatureVerified: boolean;
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

export interface ProductPaymentTransitionView {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  storefrontId: string;
  currencyCode: string;
  amount: string;
  method:
    OrderPaymentMethod |
    null;
  paymentStatus:
    OrderPaymentStatus;
  provider: string | null;
  providerReference:
    string |
    null;
  idempotencyKey:
    string |
    null;
  orderStatus:
    OrderStatus;
  productPaymentStatus:
    OrderPaymentStatus;
  initiatedAt: string;
  paidAt:
    string |
    null;
  failedAt:
    string |
    null;
}

export type ProductPaymentEventDisposition =
  | "PAID"
  | "FAILED"
  | "IGNORED"
  | "REJECTED";

export interface ProductPaymentEventResult {
  eventId: string;
  eventStatus:
    PaymentProviderEventStatus;
  disposition:
    ProductPaymentEventDisposition;
  duplicate: boolean;
  failureCode:
    string |
    null;
  failureMessage:
    string |
    null;
  payment:
    ProductPaymentTransitionView |
    null;
}
