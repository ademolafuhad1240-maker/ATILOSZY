import "server-only";

import {
  PaymentVerificationError,
} from "./errors";

export type PaymentVerificationFetch =
  typeof fetch;

export interface PaymentVerificationHttpRequest {
  provider: string;
  url: string;
  secretKey: string;
  fetchImplementation?:
    PaymentVerificationFetch;
  timeoutMilliseconds?:
    number;
}

const defaultTimeoutMilliseconds =
  10_000;

const maximumResponseLength =
  1_000_000;

function unavailable(
  provider: string,
): PaymentVerificationError {
  return new PaymentVerificationError(
    "PAYMENT_VERIFICATION_UNAVAILABLE",
    "The payment provider could not verify this transaction.",
    provider,
  );
}

function validTimeout(
  value: number,
  provider: string,
): number {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 60_000
  ) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_CONFIGURATION_ERROR",
      "Payment verification is not configured correctly.",
      provider,
    );
  }

  return value;
}

export async function getPaymentVerificationJson(
  input:
    PaymentVerificationHttpRequest,
): Promise<unknown> {
  const fetchImplementation =
    input.fetchImplementation ??
    fetch;

  const abortController =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        abortController.abort();
      },
      validTimeout(
        input.timeoutMilliseconds ??
          defaultTimeoutMilliseconds,
        input.provider,
      ),
    );

  try {
    const response =
      await fetchImplementation(
        input.url,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
            Authorization:
              `Bearer ${input.secretKey}`,
          },
          cache: "no-store",
          signal:
            abortController.signal,
        },
      );

    const contentLength =
      response.headers.get(
        "content-length",
      );

    if (
      contentLength !== null &&
      Number(contentLength) >
        maximumResponseLength
    ) {
      throw unavailable(
        input.provider,
      );
    }

    const responseText =
      await response.text();

    if (
      !response.ok ||
      responseText.length === 0 ||
      responseText.length >
        maximumResponseLength
    ) {
      throw unavailable(
        input.provider,
      );
    }

    try {
      return JSON.parse(
        responseText,
      ) as unknown;
    } catch {
      throw unavailable(
        input.provider,
      );
    }
  } catch (error) {
    if (
      error instanceof
        PaymentVerificationError &&
      error.code ===
        "PAYMENT_VERIFICATION_CONFIGURATION_ERROR"
    ) {
      throw error;
    }

    throw unavailable(
      input.provider,
    );
  } finally {
    clearTimeout(timeout);
  }
}
