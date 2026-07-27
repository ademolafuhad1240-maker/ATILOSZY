import "server-only";

import {
  PaymentWebhookError,
} from "./errors";

export function isWebhookObject(
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

export function parseWebhookObject(
  rawText: string,
): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed =
      JSON.parse(
        rawText,
      ) as unknown;
  } catch {
    throw new PaymentWebhookError(
      "WEBHOOK_BODY_INVALID",
      "The webhook request body is invalid.",
      400,
    );
  }

  if (
    !isWebhookObject(
      parsed,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_BODY_INVALID",
      "The webhook request body is invalid.",
      400,
    );
  }

  return parsed;
}

export function optionalWebhookText(
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

export function requiredWebhookText(
  value: unknown,
  maximumLength: number,
): string {
  const normalized =
    optionalWebhookText(
      value,
      maximumLength,
    );

  if (!normalized) {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_DATA_INVALID",
      "The provider webhook data is invalid.",
      400,
    );
  }

  return normalized;
}

export function providerIdentifier(
  value: unknown,
): string {
  if (
    typeof value ===
      "number" &&
    Number.isSafeInteger(
      value,
    ) &&
    value > 0
  ) {
    return value.toString();
  }

  return requiredWebhookText(
    value,
    120,
  );
}

export function providerIntegerAmount(
  value: unknown,
): string {
  if (
    typeof value ===
      "number" &&
    Number.isSafeInteger(
      value,
    ) &&
    value > 0
  ) {
    return value.toString();
  }

  const normalized =
    optionalWebhookText(
      value,
      40,
    );

  if (
    !normalized ||
    !/^[1-9]\d*$/.test(
      normalized,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_DATA_INVALID",
      "The provider webhook amount is invalid.",
      400,
    );
  }

  return normalized;
}

export function providerMajorAmount(
  value: unknown,
): string {
  if (
    typeof value !==
      "string" &&
    typeof value !==
      "number"
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_DATA_INVALID",
      "The provider webhook amount is invalid.",
      400,
    );
  }

  const normalized =
    String(
      value,
    ).trim();

  if (
    !/^(0|[1-9]\d*)(?:\.\d{1,2})?$/
      .test(
        normalized,
      ) ||
    /^0(?:\.0{1,2})?$/.test(
      normalized,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_DATA_INVALID",
      "The provider webhook amount is invalid.",
      400,
    );
  }

  const [
    whole,
    fraction = "",
  ] =
    normalized.split(
      ".",
    );

  return (
    `${whole}.` +
    fraction.padEnd(
      2,
      "0",
    )
  );
}

export function providerCurrencyCode(
  value: unknown,
): string {
  const normalized =
    requiredWebhookText(
      value,
      3,
    ).toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      normalized,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_PROVIDER_DATA_INVALID",
      "The provider webhook currency is invalid.",
      400,
    );
  }

  return normalized;
}

export function providerDataMismatch(): PaymentWebhookError {
  return new PaymentWebhookError(
    "WEBHOOK_PROVIDER_DATA_INVALID",
    "The signed webhook data did not match the verified provider transaction.",
    400,
  );
}
