import "server-only";

import {
  createHash,
} from "node:crypto";

import type {
  OrderPaymentMethod,
  Prisma,
} from "../../generated/prisma/client";

export interface PaymentInitiationRequest {
  storefrontCode: string;
  userId: string;
  orderId: string;
  orderNumber: string;
  currencyCode: string;
  amount: string;
  method: OrderPaymentMethod;
  merchantReference: string;
  idempotencyKey: string;
}

export type PaymentInitiationNextAction =
  | {
      type: "REDIRECT";
      url: string;
      expiresAt:
        string |
        null;
    }
  | {
      type: "PENDING";
      message: string;
    };

export interface PaymentInitiationProviderResult {
  providerReference: string;
  nextAction:
    PaymentInitiationNextAction;
  providerMetadata?:
    Prisma.InputJsonValue;
}

export interface PaymentInitiationProvider {
  readonly name: string;
  readonly enabled: boolean;
  readonly supportedMethods:
    readonly OrderPaymentMethod[];

  initiate(
    request:
      PaymentInitiationRequest,
  ): Promise<
    PaymentInitiationProviderResult
  >;
}

export interface ServerPaymentAttemptIdentity {
  merchantReference: string;
  idempotencyKey: string;
  requestTokenHash: string;
}

export class PaymentInitiationUnavailableError
  extends Error {
  readonly code =
    "PAYMENT_INITIATION_UNAVAILABLE";

  constructor(
    message =
      "Product payment initiation is not available yet.",
  ) {
    super(message);

    this.name =
      "PaymentInitiationUnavailableError";
  }
}

export class PaymentInitiationProviderError
  extends Error {
  readonly code =
    "PAYMENT_PROVIDER_ERROR";

  readonly details:
    Record<string, unknown> |
    undefined;

  constructor(
    message:
      string,
    details?:
      Record<string, unknown>,
  ) {
    super(message);

    this.name =
      "PaymentInitiationProviderError";

    this.details =
      details;
  }
}

export function isPaymentInitiationUnavailableError(
  error: unknown,
): error is
  PaymentInitiationUnavailableError {
  return (
    error instanceof
      PaymentInitiationUnavailableError
  );
}

export function isPaymentInitiationProviderError(
  error: unknown,
): error is
  PaymentInitiationProviderError {
  return (
    error instanceof
      PaymentInitiationProviderError
  );
}

export function createDisabledPaymentInitiationProvider(): PaymentInitiationProvider {
  async function unavailable(): Promise<never> {
    throw new PaymentInitiationUnavailableError();
  }

  return {
    name: "disabled",
    enabled: false,
    supportedMethods: [],
    initiate:
      unavailable,
  };
}

export function getPaymentInitiationProvider(): PaymentInitiationProvider {
  const configuredProvider = (
    process.env
      .PAYMENT_INITIATION_PROVIDER ??
    "disabled"
  )
    .trim()
    .toLowerCase();

  if (
    configuredProvider === "" ||
    configuredProvider ===
      "disabled"
  ) {
    return createDisabledPaymentInitiationProvider();
  }

  throw new Error(
    `Unsupported PAYMENT_INITIATION_PROVIDER: ${configuredProvider}`,
  );
}

export function assertPaymentInitiationEnabled(
  provider:
    PaymentInitiationProvider,
): void {
  if (!provider.enabled) {
    throw new PaymentInitiationUnavailableError();
  }
}

export function createServerPaymentAttemptIdentity(
  input: {
    storefrontCode: string;
    userId: string;
    orderId: string;
    requestToken: string;
  },
): ServerPaymentAttemptIdentity {
  const digest =
    createHash(
      "sha256",
    )
      .update(
        [
          "sorvyra-product-payment",
          input.storefrontCode,
          input.userId,
          input.orderId,
          input.requestToken,
        ].join(
          "\u0000",
        ),
        "utf8",
      )
      .digest(
        "hex",
      );

  const normalizedStorefront =
    input.storefrontCode
      .toLowerCase();

  return {
    merchantReference:
      `svy-${normalizedStorefront}-${digest.slice(0, 40)}`,
    idempotencyKey:
      `pay:${normalizedStorefront}:${digest}`,
    requestTokenHash:
      digest,
  };
}
