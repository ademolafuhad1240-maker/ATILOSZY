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

export interface ReconcileProductPaymentInput {
  storefrontCode: string;
  userId: string;
  orderNumber: string;
}

export interface ProductPaymentReconciliationAttempt {
  kind: "ATTEMPT";
  attemptEventId: string;
  provider: string;
  providerReference: string;
  amount: string;
  currencyCode: string;
  method:
    OrderPaymentMethod |
    null;
  checkedAt: string;
  retryAfterSeconds: number;
  payment:
    ProductPaymentTransitionView;
}

export interface ProductPaymentReconciliationTerminal {
  kind: "TERMINAL";
  payment:
    ProductPaymentTransitionView;
}

export interface ProductPaymentReconciliationRateLimited {
  kind: "RATE_LIMITED";
  checkedAt: string;
  retryAfterSeconds: number;
  payment:
    ProductPaymentTransitionView;
}

export type ProductPaymentReconciliationStart =
  | ProductPaymentReconciliationAttempt
  | ProductPaymentReconciliationTerminal
  | ProductPaymentReconciliationRateLimited;

export interface CompleteProductPaymentReconciliationAttemptInput {
  attemptEventId: string;
  status:
    | "PROCESSED"
    | "IGNORED"
    | "FAILED";
  payloadHash: string;
  payload:
    Prisma.InputJsonValue;
  providerVerified: boolean;
  failureCode?:
    string | null;
  failureMessage?:
    string | null;
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
