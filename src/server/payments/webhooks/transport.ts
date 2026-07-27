import "server-only";

import {
  PaymentWebhookError,
} from "./errors";

export type PaymentWebhookFetch =
  typeof fetch;

export interface ProviderVerificationRequest {
  provider: string;
  url: string;
  secretKey: string;
  fetchImplementation?:
    PaymentWebhookFetch;
  timeoutMilliseconds?:
    number;
}

const defaultTimeoutMilliseconds =
  10_000;

const maximumResponseLength =
  1_000_000;

function verificationUnavailable(): PaymentWebhookError {
  return new PaymentWebhookError(
    "WEBHOOK_PROVIDER_VERIFICATION_UNAVAILABLE",
    "The provider transaction could not be verified.",
    503,
  );
}

function validTimeout(
  value: number,
): number {
  if (
    !Number.isInteger(
      value,
    ) ||
    value < 1 ||
    value > 60_000
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_CONFIGURATION_ERROR",
      "Payment webhook verification is not configured correctly.",
      503,
    );
  }

  return value;
}

export async function getProviderVerificationJson(
  input:
    ProviderVerificationRequest,
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
            abortController
              .signal,
        },
      );

    const contentLength =
      response.headers.get(
        "content-length",
      );

    if (
      contentLength !== null &&
      Number(
        contentLength,
      ) >
        maximumResponseLength
    ) {
      throw verificationUnavailable();
    }

    const responseText =
      await response.text();

    if (
      !response.ok ||
      responseText.length ===
        0 ||
      responseText.length >
        maximumResponseLength
    ) {
      throw verificationUnavailable();
    }

    try {
      return JSON.parse(
        responseText,
      ) as unknown;
    } catch {
      throw verificationUnavailable();
    }
  } catch (error) {
    if (
      error instanceof
        PaymentWebhookError
    ) {
      throw verificationUnavailable();
    }

    throw verificationUnavailable();
  } finally {
    clearTimeout(
      timeout,
    );
  }
}
