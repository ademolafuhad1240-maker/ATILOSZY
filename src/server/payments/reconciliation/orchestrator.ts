import "server-only";

import {
  createHash,
} from "node:crypto";

import {
  OrderPaymentStatus,
  type Prisma,
} from "@/generated/prisma/client";

import type {
  ProductPaymentReconciliationAttempt,
  ProductPaymentReconciliationStart,
  ReconcileProductPaymentInput,
} from "../types";
import {
  isPaymentVerificationError,
  type PaymentVerificationResult,
} from "../verification";
import {
  PaymentReconciliationError,
} from "./errors";
import type {
  PaymentReconciliationDependencies,
  PaymentReconciliationDisposition,
  PaymentReconciliationResult,
} from "./types";

function payloadHash(
  payload:
    Prisma.InputJsonValue,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(payload),
      "utf8",
    )
    .digest("hex");
}

function finalEventId(
  result:
    PaymentVerificationResult,
): string {
  const fingerprint =
    createHash("sha256")
      .update(
        [
          result.provider,
          result.transactionId,
          result.providerReference,
          result.providerStatus,
          result.amount,
          result.currencyCode,
        ].join("\u0000"),
        "utf8",
      )
      .digest("hex");

  return `reconciliation-result:${fingerprint}`;
}

function terminalDisposition(
  payment:
    ProductPaymentReconciliationStart[
      "payment"
    ],
): PaymentReconciliationDisposition {
  if (
    payment.paymentStatus ===
      OrderPaymentStatus.PAID
  ) {
    return "PAID";
  }

  if (
    payment.paymentStatus ===
      OrderPaymentStatus.FAILED
  ) {
    return "FAILED";
  }

  return "UNCHANGED";
}

function verificationError(
  error: unknown,
): PaymentReconciliationError {
  if (
    isPaymentVerificationError(
      error,
    )
  ) {
    switch (error.code) {
      case "PAYMENT_VERIFICATION_CONFIGURATION_ERROR":
        return new PaymentReconciliationError(
          "PAYMENT_RECONCILIATION_UNAVAILABLE",
          "Payment status verification is not configured correctly.",
          503,
          60,
        );

      case "PAYMENT_VERIFICATION_UNAVAILABLE":
        return new PaymentReconciliationError(
          "PAYMENT_RECONCILIATION_PROVIDER_UNAVAILABLE",
          "The payment provider could not verify the payment status.",
          503,
          60,
        );

      case "PAYMENT_VERIFICATION_DATA_INVALID":
        return new PaymentReconciliationError(
          "PAYMENT_RECONCILIATION_DATA_INVALID",
          "The payment provider returned inconsistent verification data.",
          502,
          60,
        );
    }
  }

  return new PaymentReconciliationError(
    "PAYMENT_RECONCILIATION_PROVIDER_UNAVAILABLE",
    "The payment status could not be verified.",
    503,
    60,
  );
}

function assertVerificationMatchesPayment(
  attempt:
    ProductPaymentReconciliationAttempt,
  result:
    PaymentVerificationResult,
): void {
  if (
    result.provider !==
      attempt.provider ||
    result.providerReference !==
      attempt.providerReference ||
    result.amount !==
      attempt.amount ||
    result.currencyCode !==
      attempt.currencyCode
  ) {
    throw new PaymentReconciliationError(
      "PAYMENT_RECONCILIATION_DATA_INVALID",
      "The payment provider returned inconsistent verification data.",
      502,
      60,
    );
  }
}

async function completeFailedAttempt(
  dependencies:
    PaymentReconciliationDependencies,
  attemptEventId: string,
  error:
    PaymentReconciliationError,
): Promise<void> {
  const payload = {
    source:
      "SERVER_RECONCILIATION",
    status: "ERROR",
    errorCode:
      error.code,
  };

  await dependencies.store
    .complete({
      attemptEventId,
      status: "FAILED",
      payloadHash:
        payloadHash(payload),
      payload,
      providerVerified:
        false,
      failureCode:
        error.code,
      failureMessage:
        error.message,
    });
}

export async function reconcileProductPayment(
  input:
    ReconcileProductPaymentInput,
  dependencies:
    PaymentReconciliationDependencies,
): Promise<
  PaymentReconciliationResult
> {
  const start =
    await dependencies.store
      .begin(input);

  if (start.kind === "TERMINAL") {
    return {
      disposition:
        terminalDisposition(
          start.payment,
        ),
      checkedAt: null,
      retryAfterSeconds: 0,
      payment:
        start.payment,
    };
  }

  if (
    start.kind ===
      "RATE_LIMITED"
  ) {
    return {
      disposition:
        "RATE_LIMITED",
      checkedAt:
        start.checkedAt,
      retryAfterSeconds:
        start.retryAfterSeconds,
      payment:
        start.payment,
    };
  }

  let provider;

  try {
    provider =
      dependencies
        .resolveProvider(
          start.provider,
        );
  } catch (error) {
    const normalized =
      verificationError(error);

    await completeFailedAttempt(
      dependencies,
      start.attemptEventId,
      normalized,
    );

    throw normalized;
  }

  let verified:
    PaymentVerificationResult;

  try {
    verified =
      await provider.verify({
        providerReference:
          start
            .providerReference,
      });

    assertVerificationMatchesPayment(
      start,
      verified,
    );
  } catch (error) {
    const normalized =
      error instanceof
        PaymentReconciliationError
        ? error
        : verificationError(
            error,
          );

    await completeFailedAttempt(
      dependencies,
      start.attemptEventId,
      normalized,
    );

    throw normalized;
  }

  const verifiedPayload =
    verified.payload;

  const verifiedPayloadHash =
    payloadHash(
      verifiedPayload,
    );

  if (
    verified.outcome ===
      "PENDING"
  ) {
    await dependencies.store
      .complete({
        attemptEventId:
          start.attemptEventId,
        status: "IGNORED",
        payloadHash:
          verifiedPayloadHash,
        payload:
          verifiedPayload,
        providerVerified:
          true,
        failureCode:
          "PAYMENT_STILL_PENDING",
        failureMessage:
          "The payment provider reports that the payment is still pending.",
      });

    return {
      disposition:
        "PENDING",
      checkedAt:
        start.checkedAt,
      retryAfterSeconds:
        start
          .retryAfterSeconds,
      payment:
        start.payment,
    };
  }

  let eventResult;

  try {
    eventResult =
      await dependencies.store
        .processEvent({
          provider:
            verified.provider,
          providerEventId:
            finalEventId(
              verified,
            ),
          eventType:
            verified.outcome ===
              "SUCCEEDED"
              ? "payment.reconciliation.succeeded"
              : "payment.reconciliation.failed",
          payloadHash:
            verifiedPayloadHash,
          payload:
            verifiedPayload,
          signatureVerified:
            true,
          providerReference:
            verified
              .providerReference,
          amount:
            verified.amount,
          currencyCode:
            verified
              .currencyCode,
          outcome:
            verified.outcome,
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
            verified.outcome ===
              "FAILED"
              ? {
                  failureCode:
                    "PROVIDER_RECONCILIATION_FAILURE",
                  failureMessage:
                    "The payment provider reported that the payment failed.",
                }
              : {}
          ),
        });
  } catch {
    const normalized =
      new PaymentReconciliationError(
        "PAYMENT_RECONCILIATION_PROVIDER_UNAVAILABLE",
        "The verified payment status could not be applied safely.",
        503,
        60,
      );

    await completeFailedAttempt(
      dependencies,
      start.attemptEventId,
      normalized,
    );

    throw normalized;
  }

  if (!eventResult.payment) {
    const normalized =
      new PaymentReconciliationError(
      "PAYMENT_RECONCILIATION_DATA_INVALID",
      "The verified payment did not match a stored payment.",
      502,
      60,
    );

    await completeFailedAttempt(
      dependencies,
      start.attemptEventId,
      normalized,
    );

    throw normalized;
  }

  await dependencies.store
    .complete({
      attemptEventId:
        start.attemptEventId,
      status: "PROCESSED",
      payloadHash:
        verifiedPayloadHash,
      payload:
        verifiedPayload,
      providerVerified:
        true,
    });

  return {
    disposition:
      eventResult.disposition ===
        "PAID"
        ? "PAID"
        : eventResult.disposition ===
            "FAILED"
          ? "FAILED"
          : "UNCHANGED",
    checkedAt:
      start.checkedAt,
    retryAfterSeconds: 0,
    payment:
      eventResult.payment,
  };
}
