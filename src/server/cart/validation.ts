import {
  CartServiceError,
} from "./errors";

export function normalizeStorefrontCode(
  value: string,
): string {
  const normalized =
    value.trim().toUpperCase();

  if (
    normalized.length < 2 ||
    normalized.length > 12 ||
    !/^[A-Z0-9_-]+$/.test(
      normalized,
    )
  ) {
    throw new CartServiceError(
      "VALIDATION",
      "The storefront code is invalid.",
    );
  }

  return normalized;
}

export function requireIdentifier(
  value: string,
  label: string,
): string {
  const normalized = value.trim();

  if (
    normalized.length < 1 ||
    normalized.length > 191
  ) {
    throw new CartServiceError(
      "VALIDATION",
      `${label} is invalid.`,
    );
  }

  return normalized;
}

export function requireCartQuantity(
  value: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 999
  ) {
    throw new CartServiceError(
      "VALIDATION",
      "Cart quantity must be a whole number between 1 and 999.",
    );
  }

  return value;
}
