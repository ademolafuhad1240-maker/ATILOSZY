import "server-only";

import {
  OrderPaymentMethod,
} from "@/generated/prisma/client";

import {
  minorUnitsToMajorAmount,
} from "../providers/money";
import {
  sha256PayloadHash,
  verifyPaystackWebhookSignature,
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
  providerIntegerAmount,
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

export interface PaystackWebhookProviderOptions {
  secretKey: string;
  fetchImplementation?:
    PaymentWebhookFetch;
  timeoutMilliseconds?:
    number;
}

interface PaystackTransaction {
  id: string;
  reference: string;
  amountMinor: string;
  currencyCode: string;
  status: string;
  channel:
    string |
    null;
}

function requireSecret(
  value: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length < 12 ||
    /\s/.test(
      normalized,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_CONFIGURATION_ERROR",
      "The Paystack webhook is not configured correctly.",
      503,
    );
  }

  return normalized;
}

function paystackTransaction(
  value: unknown,
): PaystackTransaction {
  if (
    !isWebhookObject(
      value,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_DATA_INVALID",
      "The Paystack transaction data is invalid.",
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
        value.reference,
        191,
      ),
    amountMinor:
      providerIntegerAmount(
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
    channel:
      optionalWebhookText(
        value.channel,
        60,
      )
        ?.toLowerCase() ??
      null,
  };
}

function paystackPaymentMethod(
  channel:
    string |
    null,
):
  | OrderPaymentMethod
  | undefined {
  switch (
    channel
  ) {
    case "card":
      return OrderPaymentMethod
        .CARD;

    case "bank_transfer":
      return OrderPaymentMethod
        .BANK_TRANSFER;

    case "ussd":
      return OrderPaymentMethod
        .USSD;

    case "bank":
      return OrderPaymentMethod
        .PAY_BY_BANK;

    case "mobile_money":
    case "payattitude":
      return OrderPaymentMethod
        .PROVIDER_WALLET;

    default:
      return undefined;
  }
}

function verifiedPaystackTransaction(
  response: unknown,
): PaystackTransaction {
  if (
    !isWebhookObject(
      response,
    ) ||
    response.status !== true
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_VERIFICATION_UNAVAILABLE",
      "The Paystack transaction could not be verified.",
      503,
    );
  }

  try {
    return paystackTransaction(
      response.data,
    );
  } catch {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_VERIFICATION_UNAVAILABLE",
      "The Paystack transaction could not be verified.",
      503,
    );
  }
}

function paystackMajorAmount(
  transaction:
    PaystackTransaction,
): string {
  try {
    return minorUnitsToMajorAmount(
      transaction
        .amountMinor,
      transaction
        .currencyCode,
    );
  } catch {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_DATA_INVALID",
      "The Paystack transaction amount is invalid.",
      400,
    );
  }
}

function assertTransactionsMatch(
  webhook:
    PaystackTransaction,
  verified:
    PaystackTransaction,
): void {
  if (
    webhook.id !==
      verified.id ||
    webhook.reference !==
      verified.reference ||
    webhook.amountMinor !==
      verified.amountMinor ||
    webhook.currencyCode !==
      verified.currencyCode
  ) {
    throw providerDataMismatch();
  }
}

async function normalizePaystackWebhook(
  request:
    PaymentWebhookRequest,
  secretKey: string,
  options:
    PaystackWebhookProviderOptions,
) {
  if (
    !verifyPaystackWebhookSignature(
      request.rawBody,
      request.signature,
      secretKey,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_SIGNATURE_INVALID",
      "The Paystack webhook signature is invalid.",
      401,
    );
  }

  const payload =
    parseWebhookObject(
      request.rawText,
    );

  const eventType =
    requiredWebhookText(
      payload.event,
      120,
    );

  if (
    eventType !==
      "charge.success"
  ) {
    return {
      kind:
        "IGNORED" as const,
      eventType,
    };
  }

  const webhookTransaction =
    paystackTransaction(
      payload.data,
    );

  if (
    webhookTransaction
      .status !== "success"
  ) {
    throw providerDataMismatch();
  }

  const verificationResponse =
    await getProviderVerificationJson(
      {
        provider:
          "paystack",
        url:
          "https://api.paystack.co/transaction/verify/" +
          encodeURIComponent(
            webhookTransaction
              .reference,
          ),
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
    verifiedPaystackTransaction(
      verificationResponse,
    );

  assertTransactionsMatch(
    webhookTransaction,
    verifiedTransaction,
  );

  if (
    verifiedTransaction
      .status !== "success"
  ) {
    throw providerDataMismatch();
  }

  const method =
    paystackPaymentMethod(
      verifiedTransaction
        .channel,
    );

  return {
    kind:
      "EVENT" as const,
    event: {
      providerEventId:
        `charge.success:${verifiedTransaction.id}`,
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
        channel:
          verifiedTransaction
            .channel,
      },
      providerReference:
        verifiedTransaction
          .reference,
      amount:
        paystackMajorAmount(
          verifiedTransaction,
        ),
      currencyCode:
        verifiedTransaction
          .currencyCode,
      outcome:
        "SUCCEEDED" as const,
      ...(
        method === undefined
          ? {}
          : {
              method,
            }
      ),
    },
  };
}

export function createPaystackWebhookProvider(
  options:
    PaystackWebhookProviderOptions,
): PaymentWebhookProvider {
  const secretKey =
    requireSecret(
      options.secretKey,
    );

  return {
    name: "paystack",
    signatureHeader:
      "x-paystack-signature",

    normalize(
      request:
        PaymentWebhookRequest,
    ) {
      return normalizePaystackWebhook(
        request,
        secretKey,
        options,
      );
    },
  };
}
