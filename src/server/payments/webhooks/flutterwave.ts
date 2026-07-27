import "server-only";

import {
  OrderPaymentMethod,
} from "@/generated/prisma/client";

import {
  sha256PayloadHash,
  verifyFlutterwaveWebhookSignature,
} from "./crypto";
import {
  PaymentWebhookError,
} from "./errors";
import {
  isWebhookObject,
  optionalWebhookText,
  parseWebhookObject,
  providerCurrencyCode,
  providerDataMismatch,
  providerIdentifier,
  providerMajorAmount,
  requiredWebhookText,
} from "./parsing";
import {
  getProviderVerificationJson,
  type PaymentWebhookFetch,
} from "./transport";
import type {
  PaymentWebhookProvider,
  PaymentWebhookRequest,
} from "./types";

export interface FlutterwaveWebhookProviderOptions {
  secretKey: string;
  webhookSecretHash: string;
  fetchImplementation?:
    PaymentWebhookFetch;
  timeoutMilliseconds?:
    number;
}

interface FlutterwaveTransaction {
  id: string;
  reference: string;
  amount: string;
  currencyCode: string;
  status: string;
  paymentType:
    string |
    null;
}

function requireConfiguredSecret(
  value: string,
  minimumLength: number,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length <
      minimumLength ||
    /\s/.test(
      normalized,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_CONFIGURATION_ERROR",
      "The Flutterwave webhook is not configured correctly.",
      503,
    );
  }

  return normalized;
}

function flutterwaveTransaction(
  value: unknown,
): FlutterwaveTransaction {
  if (
    !isWebhookObject(
      value,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_DATA_INVALID",
      "The Flutterwave transaction data is invalid.",
      400,
    );
  }

  return {
    id:
      providerIdentifier(
        value.id,
      ),
    reference:
      requiredWebhookText(
        value.tx_ref ??
          value.reference,
        191,
      ),
    amount:
      providerMajorAmount(
        value.amount,
      ),
    currencyCode:
      providerCurrencyCode(
        value.currency,
      ),
    status:
      requiredWebhookText(
        value.status,
        40,
      )
        .toLowerCase(),
    paymentType:
      optionalWebhookText(
        value.payment_type,
        80,
      )
        ?.toLowerCase() ??
      null,
  };
}

function flutterwavePaymentMethod(
  paymentType:
    string |
    null,
):
  | OrderPaymentMethod
  | undefined {
  switch (
    paymentType
  ) {
    case "card":
      return OrderPaymentMethod
        .CARD;

    case "bank_transfer":
    case "banktransfer":
      return OrderPaymentMethod
        .BANK_TRANSFER;

    case "ussd":
      return OrderPaymentMethod
        .USSD;

    case "account":
      return OrderPaymentMethod
        .PAY_BY_BANK;

    case "barter":
    case "mobilemoney":
    case "mobile_money":
      return OrderPaymentMethod
        .PROVIDER_WALLET;

    default:
      return undefined;
  }
}

function verifiedFlutterwaveTransaction(
  response: unknown,
): FlutterwaveTransaction {
  if (
    !isWebhookObject(
      response,
    ) ||
    response.status !==
      "success"
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_VERIFICATION_UNAVAILABLE",
      "The Flutterwave transaction could not be verified.",
      503,
    );
  }

  try {
    return flutterwaveTransaction(
      response.data,
    );
  } catch {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_VERIFICATION_UNAVAILABLE",
      "The Flutterwave transaction could not be verified.",
      503,
    );
  }
}

function finalOutcome(
  status: string,
):
  | "SUCCEEDED"
  | "FAILED"
  | null {
  if (
    status ===
      "successful" ||
    status ===
      "succeeded"
  ) {
    return "SUCCEEDED";
  }

  if (
    status === "failed"
  ) {
    return "FAILED";
  }

  return null;
}

function assertTransactionsMatch(
  webhook:
    FlutterwaveTransaction,
  verified:
    FlutterwaveTransaction,
): void {
  if (
    webhook.id !==
      verified.id ||
    webhook.reference !==
      verified.reference ||
    webhook.amount !==
      verified.amount ||
    webhook.currencyCode !==
      verified.currencyCode ||
    finalOutcome(
      webhook.status,
    ) !==
      finalOutcome(
        verified.status,
      )
  ) {
    throw providerDataMismatch();
  }
}

async function normalizeFlutterwaveWebhook(
  request:
    PaymentWebhookRequest,
  secretKey: string,
  webhookSecretHash: string,
  options:
    FlutterwaveWebhookProviderOptions,
) {
  if (
    !verifyFlutterwaveWebhookSignature(
      request.rawBody,
      request.signature,
      webhookSecretHash,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_SIGNATURE_INVALID",
      "The Flutterwave webhook signature is invalid.",
      401,
    );
  }

  const payload =
    parseWebhookObject(
      request.rawText,
    );

  const eventType =
    requiredWebhookText(
      payload.event ??
        payload.type,
      120,
    );

  if (
    eventType !==
      "charge.completed"
  ) {
    return {
      kind:
        "IGNORED" as const,
      eventType,
    };
  }

  const webhookTransaction =
    flutterwaveTransaction(
      payload.data,
    );

  const webhookOutcome =
    finalOutcome(
      webhookTransaction
        .status,
    );

  if (
    webhookOutcome ===
      null
  ) {
    return {
      kind:
        "IGNORED" as const,
      eventType,
    };
  }

  const verificationResponse =
    await getProviderVerificationJson(
      {
        provider:
          "flutterwave",
        url:
          "https://api.flutterwave.com/v3/transactions/" +
          encodeURIComponent(
            webhookTransaction
              .id,
          ) +
          "/verify",
        secretKey,
        fetchImplementation:
          options
            .fetchImplementation,
        timeoutMilliseconds:
          options
            .timeoutMilliseconds,
      },
    );

  const verifiedTransaction =
    verifiedFlutterwaveTransaction(
      verificationResponse,
    );

  assertTransactionsMatch(
    webhookTransaction,
    verifiedTransaction,
  );

  const outcome =
    finalOutcome(
      verifiedTransaction
        .status,
    );

  if (
    outcome === null
  ) {
    return {
      kind:
        "IGNORED" as const,
      eventType,
    };
  }

  const method =
    flutterwavePaymentMethod(
      verifiedTransaction
        .paymentType,
    );

  return {
    kind:
      "EVENT" as const,
    event: {
      providerEventId:
        `charge.completed:${verifiedTransaction.id}:${verifiedTransaction.status}`,
      eventType,
      payloadHash:
        sha256PayloadHash(
          request.rawBody,
        ),
      payload: {
        transactionId:
          verifiedTransaction
            .id,
        reference:
          verifiedTransaction
            .reference,
        status:
          verifiedTransaction
            .status,
        paymentType:
          verifiedTransaction
            .paymentType,
      },
      providerReference:
        verifiedTransaction
          .reference,
      amount:
        verifiedTransaction
          .amount,
      currencyCode:
        verifiedTransaction
          .currencyCode,
      outcome,
      ...(
        method === undefined
          ? {}
          : {
              method,
            }
      ),
      ...(
        outcome ===
          "FAILED"
          ? {
              failureCode:
                "FLUTTERWAVE_REPORTED_FAILURE",
              failureMessage:
                "Flutterwave reported that the payment failed.",
            }
          : {}
      ),
    },
  };
}

export function createFlutterwaveWebhookProvider(
  options:
    FlutterwaveWebhookProviderOptions,
): PaymentWebhookProvider {
  const secretKey =
    requireConfiguredSecret(
      options.secretKey,
      12,
    );

  const webhookSecretHash =
    requireConfiguredSecret(
      options
        .webhookSecretHash,
      16,
    );

  return {
    name: "flutterwave",
    signatureHeader:
      "flutterwave-signature",

    normalize(
      request:
        PaymentWebhookRequest,
    ) {
      return normalizeFlutterwaveWebhook(
        request,
        secretKey,
        webhookSecretHash,
        options,
      );
    },
  };
}
