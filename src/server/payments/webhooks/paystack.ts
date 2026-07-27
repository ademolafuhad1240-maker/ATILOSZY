import "server-only";

import {
  minorUnitsToMajorAmount,
} from "../providers/money";
import {
  createPaystackPaymentVerificationProvider,
  type PaymentVerificationFetch,
  type PaymentVerificationProvider,
} from "../verification";
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
import type {
  PaymentWebhookProvider,
  PaymentWebhookRequest,
} from "./types";

export interface PaystackWebhookProviderOptions {
  secretKey: string;
  fetchImplementation?:
    PaymentVerificationFetch;
  timeoutMilliseconds?:
    number;
  verificationProvider?:
    PaymentVerificationProvider;
}

interface PaystackSignedTransaction {
  id: string;
  reference: string;
  amountMinor: string;
  currencyCode: string;
  status: string;
  channel: string | null;
}

function requireSecret(
  value: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length < 12 ||
    /\s/.test(normalized)
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_CONFIGURATION_ERROR",
      "The Paystack webhook is not configured correctly.",
      503,
    );
  }

  return normalized;
}

function signedTransaction(
  value: unknown,
): PaystackSignedTransaction {
  if (!isWebhookObject(value)) {
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
      ).toLowerCase(),
    channel:
      optionalWebhookText(
        value.channel,
        60,
      )?.toLowerCase() ??
      null,
  };
}

function signedMajorAmount(
  transaction:
    PaystackSignedTransaction,
): string {
  try {
    return minorUnitsToMajorAmount(
      transaction.amountMinor,
      transaction.currencyCode,
    );
  } catch {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_DATA_INVALID",
      "The Paystack transaction amount is invalid.",
      400,
    );
  }
}

async function normalizePaystackWebhook(
  request:
    PaymentWebhookRequest,
  secretKey: string,
  verificationProvider:
    PaymentVerificationProvider,
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

  if (eventType !== "charge.success") {
    return {
      kind: "IGNORED" as const,
      eventType,
    };
  }

  const signed =
    signedTransaction(
      payload.data,
    );

  if (signed.status !== "success") {
    throw providerDataMismatch();
  }

  let verified;

  try {
    verified =
      await verificationProvider
        .verify({
          providerReference:
            signed.reference,
          transactionId:
            signed.id,
        });
  } catch {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_VERIFICATION_UNAVAILABLE",
      "The Paystack transaction could not be verified.",
      503,
    );
  }

  if (
    verified.provider !==
      "paystack" ||
    verified.transactionId !==
      signed.id ||
    verified.providerReference !==
      signed.reference ||
    verified.amount !==
      signedMajorAmount(
        signed,
      ) ||
    verified.currencyCode !==
      signed.currencyCode ||
    verified.outcome !==
      "SUCCEEDED"
  ) {
    throw providerDataMismatch();
  }

  return {
    kind: "EVENT" as const,
    event: {
      providerEventId:
        `charge.success:${verified.transactionId}`,
      eventType,
      payloadHash:
        sha256PayloadHash(
          request.rawBody,
        ),
      payload:
        verified.payload,
      providerReference:
        verified
          .providerReference,
      amount:
        verified.amount,
      currencyCode:
        verified.currencyCode,
      outcome:
        "SUCCEEDED" as const,
      ...(
        verified.method ===
          undefined
          ? {}
          : {
              method:
                verified.method,
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

  const verificationProvider =
    options.verificationProvider ??
    createPaystackPaymentVerificationProvider({
      secretKey,
      fetchImplementation:
        options.fetchImplementation,
      timeoutMilliseconds:
        options.timeoutMilliseconds,
    });

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
        verificationProvider,
      );
    },
  };
}
