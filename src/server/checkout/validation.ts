import {
  OrderFulfilmentMethod,
} from "@/generated/prisma/client";

import {
  CheckoutServiceError,
} from "./errors";
import type {
  CheckoutAddressInput,
  NormalizedCheckoutAddress,
} from "./types";

export function requireIdentifier(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.trim().length > 191
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      `${label} is invalid.`,
    );
  }

  return value.trim();
}

export function normalizeStorefrontCode(
  value: unknown,
): string {
  const code = requireIdentifier(
    value,
    "Storefront code",
  ).toUpperCase();

  if (!/^[A-Z]{3}$/.test(code)) {
    throw new CheckoutServiceError(
      "VALIDATION",
      "Storefront code must contain three letters.",
    );
  }

  return code;
}

export function requireText(
  value: unknown,
  label: string,
  maximumLength: number,
): string {
  if (typeof value !== "string") {
    throw new CheckoutServiceError(
      "VALIDATION",
      `${label} is required.`,
    );
  }

  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length >
      maximumLength
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      `${label} must contain between 1 and ${maximumLength} characters.`,
    );
  }

  return normalized;
}

export function optionalText(
  value: unknown,
  label: string,
  maximumLength: number,
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return requireText(
    value,
    label,
    maximumLength,
  );
}

export function normalizeEmail(
  value: unknown,
  label: string,
): string | null {
  const email = optionalText(
    value,
    label,
    320,
  );

  if (email === null) {
    return null;
  }

  const normalized =
    email.toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalized,
    )
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      `${label} is invalid.`,
    );
  }

  return normalized;
}

export function normalizeCountryCode(
  value: unknown,
): string {
  const countryCode = requireText(
    value,
    "Country code",
    2,
  ).toUpperCase();

  if (
    !/^[A-Z]{2}$/.test(
      countryCode,
    )
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      "Country code must contain two letters.",
    );
  }

  return countryCode;
}

export function normalizeFulfilmentMethod(
  value: unknown,
): OrderFulfilmentMethod {
  if (
    typeof value !== "string" ||
    !Object.values(
      OrderFulfilmentMethod,
    ).includes(
      value as
        OrderFulfilmentMethod,
    )
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      "The fulfilment method is invalid.",
    );
  }

  return value as
    OrderFulfilmentMethod;
}

export function normalizeCheckoutAddress(
  value: CheckoutAddressInput,
): NormalizedCheckoutAddress {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      "The checkout address is invalid.",
    );
  }

  return {
    recipientName: requireText(
      value.recipientName,
      "Recipient name",
      160,
    ),
    phone: requireText(
      value.phone,
      "Address phone number",
      32,
    ),
    email: normalizeEmail(
      value.email,
      "Address email",
    ),
    countryCode:
      normalizeCountryCode(
        value.countryCode,
      ),
    state: optionalText(
      value.state,
      "State",
      120,
    ),
    city: requireText(
      value.city,
      "City",
      120,
    ),
    postalCode: optionalText(
      value.postalCode,
      "Postal code",
      40,
    ),
    addressLine1: requireText(
      value.addressLine1,
      "Address line 1",
      240,
    ),
    addressLine2: optionalText(
      value.addressLine2,
      "Address line 2",
      240,
    ),
    deliveryNotes: optionalText(
      value.deliveryNotes,
      "Delivery notes",
      500,
    ),
  };
}

export function normalizeOrderNumber(
  value: unknown,
): string {
  const orderNumber =
    requireIdentifier(
      value,
      "Order number",
    ).toUpperCase();

  if (
    !/^[A-Z]{3}-[A-Z0-9]{10,32}$/.test(
      orderNumber,
    )
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      "The order number is invalid.",
    );
  }

  return orderNumber;
}
