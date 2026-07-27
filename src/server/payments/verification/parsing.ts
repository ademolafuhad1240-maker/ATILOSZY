import "server-only";

import {
  PaymentVerificationError,
} from "./errors";

export function isVerificationObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function optionalVerificationText(
  value: unknown,
  maximumLength: number,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value.trim();

  if (
    normalized.length === 0 ||
    normalized.length >
      maximumLength
  ) {
    return null;
  }

  return normalized;
}

export function requiredVerificationText(
  value: unknown,
  maximumLength: number,
  provider: string,
): string {
  const normalized =
    optionalVerificationText(
      value,
      maximumLength,
    );

  if (!normalized) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_DATA_INVALID",
      "The payment provider returned invalid transaction data.",
      provider,
    );
  }

  return normalized;
}

export function verificationIdentifier(
  value: unknown,
  provider: string,
): string {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return value.toString();
  }

  return requiredVerificationText(
    value,
    120,
    provider,
  );
}

export function verificationIntegerAmount(
  value: unknown,
  provider: string,
): string {
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  ) {
    return value.toString();
  }

  const normalized =
    optionalVerificationText(
      value,
      40,
    );

  if (
    !normalized ||
    !/^[1-9]\d*$/.test(
      normalized,
    )
  ) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_DATA_INVALID",
      "The payment provider returned an invalid transaction amount.",
      provider,
    );
  }

  return normalized;
}

export function verificationMajorAmount(
  value: unknown,
  provider: string,
): string {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_DATA_INVALID",
      "The payment provider returned an invalid transaction amount.",
      provider,
    );
  }

  const normalized =
    String(value).trim();

  if (
    !/^(0|[1-9]\d*)(?:\.\d{1,2})?$/
      .test(normalized) ||
    /^0(?:\.0{1,2})?$/.test(
      normalized,
    )
  ) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_DATA_INVALID",
      "The payment provider returned an invalid transaction amount.",
      provider,
    );
  }

  const [whole, fraction = ""] =
    normalized.split(".");

  return `${whole}.${fraction.padEnd(
    2,
    "0",
  )}`;
}

export function verificationCurrencyCode(
  value: unknown,
  provider: string,
): string {
  const normalized =
    requiredVerificationText(
      value,
      3,
      provider,
    ).toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      normalized,
    )
  ) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_DATA_INVALID",
      "The payment provider returned an invalid transaction currency.",
      provider,
    );
  }

  return normalized;
}
