import "server-only";

import {
  createFlutterwavePaymentVerificationProvider,
  type PaymentVerificationFetch,
  type PaymentVerificationProvider,
} from "../verification";
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
import type {
  PaymentWebhookProvider,
  PaymentWebhookRequest,
} from "./types";

export interface FlutterwaveWebhookProviderOptions {
  secretKey: string;
  webhookSecretHash: string;
  fetchImplementation?:
    PaymentVerificationFetch;
  timeoutMilliseconds?:
    number;
  verificationProvider?:
    PaymentVerificationProvider;
}

interface FlutterwaveSignedTransaction {
  id: string;
  reference: string;
  amount: string;
  currencyCode: string;
  status: string;
  paymentType: string | null;
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
    /\s/.test(normalized)
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_CONFIGURATION_ERROR",
      "The Flutterwave webhook is not configured correctly.",
      503,
    );
  }

  return normalized;
}

function signedTransaction(
  value: unknown,
): FlutterwaveSignedTransaction {
  if (!isWebhookObject(value)) {
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
      ).toLowerCase(),
    paymentType:
      optionalWebhookText(
        value.payment_type,
        80,
      )?.toLowerCase() ??
      null,
  };
}

function finalOutcome(
  status: string,
):
  | "SUCCEEDED"
  | "FAILED"
  | null {
  if (
    status === "successful" ||
    status === "succeeded"
  ) {
    return "SUCCEEDED";
  }

  if (status === "failed") {
    return "FAILED";
  }

  return null;
}

async function normalizeFlutterwaveWebhook(
  request:
    PaymentWebhookRequest,
  webhookSecretHash: string,
  verificationProvider:
    PaymentVerificationProvider,
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

  if (eventType !== "charge.completed") {
    return {
      kind: "IGNORED" as const,
      eventType,
    };
  }

  const signed =
    signedTransaction(
      payload.data,
    );

  const signedOutcome =
    finalOutcome(
      signed.status,
    );

  if (signedOutcome === null) {
    return {
      kind: "IGNORED" as const,
      eventType,
    };
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
      "The Flutterwave transaction could not be verified.",
      503,
    );
  }

  if (
    verified.provider !==
      "flutterwave" ||
    verified.transactionId !==
      signed.id ||
    verified.providerReference !==
      signed.reference ||
    verified.amount !==
      signed.amount ||
    verified.currencyCode !==
      signed.currencyCode ||
    verified.outcome !==
      signedOutcome
  ) {
    throw providerDataMismatch();
  }

  return {
    kind: "EVENT" as const,
    event: {
      providerEventId:
        `charge.completed:${verified.transactionId}:${verified.providerStatus}`,
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
        signedOutcome,
      ...(
        verified.method ===
          undefined
          ? {}
          : {
              method:
                verified.method,
            }
      ),
      ...(
        signedOutcome ===
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
      options.webhookSecretHash,
      16,
    );

  const verificationProvider =
    options.verificationProvider ??
    createFlutterwavePaymentVerificationProvider({
      secretKey,
      fetchImplementation:
        options.fetchImplementation,
      timeoutMilliseconds:
        options.timeoutMilliseconds,
    });

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
        webhookSecretHash,
        verificationProvider,
      );
    },
  };
}
