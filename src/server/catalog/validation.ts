import { CatalogServiceError } from "@/server/catalog/errors";

export function requireText(
  value: string,
  label: string,
  maximumLength: number,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} is required.`,
    );
  }

  if (normalized.length > maximumLength) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} cannot exceed ${maximumLength} characters.`,
    );
  }

  return normalized;
}

export function normalizeSlug(
  value: string,
  label: string,
  maximumLength = 140,
): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must contain letters or numbers.`,
    );
  }

  if (normalized.length > maximumLength) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} cannot exceed ${maximumLength} characters.`,
    );
  }

  return normalized;
}

export function normalizeSku(value: string): string {
  const normalized = requireText(
    value,
    "SKU",
    80,
  ).toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) {
    throw new CatalogServiceError(
      "VALIDATION",
      "SKU may contain only letters, numbers, periods, underscores and hyphens.",
    );
  }

  return normalized;
}

export function requireInteger(
  value: number,
  label: string,
  minimum: number,
): number {
  if (!Number.isInteger(value) || value < minimum) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must be an integer greater than or equal to ${minimum}.`,
    );
  }

  return value;
}

export function requireMoney(
  value: string,
  label: string,
  allowZero = false,
): string {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must be a positive amount with no more than two decimal places.`,
    );
  }

  const numericValue = Number(normalized);

  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0 ||
    (!allowZero && numericValue === 0)
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must be ${allowZero ? "zero or greater" : "greater than zero"}.`,
    );
  }

  return numericValue.toFixed(2);
}

export function optionalText(
  value: string | null | undefined,
  label: string,
  maximumLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maximumLength) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} cannot exceed ${maximumLength} characters.`,
    );
  }

  return normalized;
}
