import "server-only";

import {
  PaymentInitiationProviderError,
} from "../initiation";

export type PaymentProviderFetch =
  typeof fetch;

export interface ProviderJsonRequest {
  provider: string;
  url: string;
  secretKey: string;
  body:
    Record<string, unknown>;
  fetchImplementation?:
    PaymentProviderFetch;
  timeoutMilliseconds?:
    number;
}

const defaultTimeoutMilliseconds =
  10_000;

const maximumResponseLength =
  1_000_000;

const safeFailureReasons =
  new Set([
    "HTTP_REJECTED",
    "MALFORMED_RESPONSE",
  ]);

function safeProviderError(
  provider: string,
  reason: string,
  status?: number,
): PaymentInitiationProviderError {
  return new PaymentInitiationProviderError(
    "The payment provider could not initialize this payment.",
    {
      provider,
      reason,
      ...(
        status === undefined
          ? {}
          : {
              httpStatus:
                status,
            }
      ),
    },
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
    throw new PaymentInitiationProviderError(
      "The payment provider timeout is invalid.",
      {
        reason:
          "INVALID_TIMEOUT",
      },
    );
  }

  return value;
}

async function readResponseText(
  response: Response,
  provider: string,
): Promise<string> {
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
    throw safeProviderError(
      provider,
      "MALFORMED_RESPONSE",
    );
  }

  const text =
    await response.text();

  if (
    text.length >
    maximumResponseLength
  ) {
    throw safeProviderError(
      provider,
      "MALFORMED_RESPONSE",
    );
  }

  return text;
}

export async function postProviderJson(
  input:
    ProviderJsonRequest,
): Promise<unknown> {
  const fetchImplementation =
    input.fetchImplementation ??
    fetch;

  const timeoutMilliseconds =
    validTimeout(
      input.timeoutMilliseconds ??
        defaultTimeoutMilliseconds,
    );

  const abortController =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        abortController.abort();
      },
      timeoutMilliseconds,
    );

  let response: Response;

  try {
    response =
      await fetchImplementation(
        input.url,
        {
          method: "POST",
          headers: {
            Accept:
              "application/json",
            Authorization:
              `Bearer ${input.secretKey}`,
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify(
              input.body,
            ),
          cache: "no-store",
          signal:
            abortController
              .signal,
        },
      );

    const responseText =
      await readResponseText(
        response,
        input.provider,
      );

    if (!response.ok) {
      throw safeProviderError(
        input.provider,
        "HTTP_REJECTED",
        response.status,
      );
    }

    if (
      responseText.length ===
      0
    ) {
      throw safeProviderError(
        input.provider,
        "MALFORMED_RESPONSE",
      );
    }

    try {
      return JSON.parse(
        responseText,
      ) as unknown;
    } catch {
      throw safeProviderError(
        input.provider,
        "MALFORMED_RESPONSE",
      );
    }
  } catch (error) {
    if (
      error instanceof
        PaymentInitiationProviderError
    ) {
      const reason =
        error.details?.[
          "reason"
        ];

      const status =
        error.details?.[
          "httpStatus"
        ];

      throw safeProviderError(
        input.provider,
        typeof reason ===
            "string" &&
          safeFailureReasons.has(
            reason,
          )
          ? reason
          : "PROVIDER_FAILURE",
        typeof status ===
            "number" &&
          Number.isInteger(
            status,
          )
          ? status
          : undefined,
      );
    }

    if (
      abortController
        .signal.aborted
    ) {
      throw safeProviderError(
        input.provider,
        "TIMEOUT",
      );
    }

    throw safeProviderError(
      input.provider,
      "NETWORK_FAILURE",
    );
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

export function requireProviderSecret(
  value:
    string |
    undefined,
): string {
  const normalized =
    value?.trim() ?? "";

  if (
    normalized.length < 12 ||
    /\s/.test(
      normalized,
    )
  ) {
    throw new PaymentInitiationProviderError(
      "The payment provider is not configured correctly.",
      {
        reason:
          "MISSING_CREDENTIALS",
      },
    );
  }

  return normalized;
}

export function requireProviderReturnUrl(
  value: string,
): string {
  let parsed: URL;

  try {
    parsed =
      new URL(
        value,
      );
  } catch {
    throw new PaymentInitiationProviderError(
      "The payment return URL is invalid.",
      {
        reason:
          "INVALID_RETURN_URL",
      },
    );
  }

  const localHosts =
    new Set([
      "localhost",
      "127.0.0.1",
      "[::1]",
    ]);

  if (
    parsed.username ||
    parsed.password ||
    (
      parsed.protocol !==
        "https:" &&
      !(
        parsed.protocol ===
          "http:" &&
        localHosts.has(
          parsed.hostname,
        )
      )
    )
  ) {
    throw new PaymentInitiationProviderError(
      "The payment return URL is invalid.",
      {
        reason:
          "INVALID_RETURN_URL",
      },
    );
  }

  return parsed.toString();
}

export function isJsonObject(
  value: unknown,
): value is
  Record<string, unknown> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value,
    )
  );
}

export function requiredResponseString(
  value: unknown,
  maximumLength: number,
): string | null {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  if (
    normalized.length ===
      0 ||
    normalized.length >
      maximumLength
  ) {
    return null;
  }

  return normalized;
}
