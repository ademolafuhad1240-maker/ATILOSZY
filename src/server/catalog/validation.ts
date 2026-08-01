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
  if (!Number.isSafeInteger(value) || value < minimum) {
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

  const [whole, fraction = ""] = normalized.split(".");
  const canonicalWhole = BigInt(whole).toString();
  const minorUnits =
    BigInt(canonicalWhole) * 100n +
    BigInt(fraction.padEnd(2, "0"));

  if (canonicalWhole.length > 16) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} exceeds the supported amount range.`,
    );
  }

  if (!allowZero && minorUnits === 0n) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must be ${allowZero ? "zero or greater" : "greater than zero"}.`,
    );
  }

  return `${canonicalWhole}.${fraction.padEnd(2, "0")}`;
}

export function moneyToMinorUnits(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");

  return (
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0").slice(0, 2))
  );
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

export function normalizeStorefrontCode(
  value: string,
): string {
  const normalized = requireText(
    value,
    "Storefront code",
    12,
  ).toUpperCase();

  if (!/^[A-Z0-9_-]+$/u.test(normalized)) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Storefront code is invalid.",
    );
  }

  return normalized;
}

export function normalizeImageUrl(
  value: string,
): string {
  const normalized = requireText(
    value,
    "Product image URL",
    2048,
  );

  if (normalized.startsWith("/")) {
    if (
      normalized.startsWith("//") ||
      normalized.includes("\\") ||
      !/^\/[A-Za-z0-9][A-Za-z0-9/_.-]*$/u.test(
        normalized,
      ) ||
      normalized
        .split("/")
        .some(
          (segment) =>
            segment === ".." ||
            segment === ".",
        )
    ) {
      throw new CatalogServiceError(
        "VALIDATION",
        "Product image paths must be safe SORVYRA asset paths.",
      );
    }

    return normalized;
  }

  let parsed: URL;

  try {
    parsed = new URL(normalized);
  } catch {
    throw new CatalogServiceError(
      "VALIDATION",
      "Product image URL must be a valid secure URL.",
    );
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "External product images must use HTTPS and cannot contain credentials.",
    );
  }

  return parsed.toString();
}
