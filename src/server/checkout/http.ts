import "server-only";

import type {
  NextRequest,
} from "next/server";
import {
  NextResponse,
} from "next/server";

import {
  authApiErrorResponse,
} from "@/server/auth/http";
import {
  cartSessionRequiredResponse,
  readCartApiSession,
} from "@/server/cart/http";

import {
  CheckoutServiceError,
} from "./errors";
import type {
  CheckoutAddressInput,
} from "./types";

type JsonObject =
  Record<string, unknown>;

export function checkoutJsonResponse(
  body: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}

export function requiredCheckoutString(
  object: JsonObject,
  field: string,
  label: string,
  maximumLength = 191,
): string {
  const value =
    object[field];

  if (
    typeof value !== "string"
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      `${label} is required.`,
    );
  }

  const normalized =
    value.trim();

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

export function optionalCheckoutString(
  object: JsonObject,
  field: string,
  label: string,
  maximumLength: number,
): string | null {
  const value =
    object[field];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return requiredCheckoutString(
    object,
    field,
    label,
    maximumLength,
  );
}

export function requireCheckoutStorefrontCode(
  value: unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      "Storefront code is required.",
    );
  }

  const code =
    value.trim().toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(code)
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      "Storefront code must contain three letters.",
    );
  }

  return code;
}

function optionalAddressString(
  object: JsonObject,
  field: string,
): string | null {
  const value =
    object[field];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "string"
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      `${field} is invalid.`,
    );
  }

  return value;
}

function requireAddressString(
  object: JsonObject,
  field: string,
): string {
  const value =
    object[field];

  if (
    typeof value !== "string"
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      `${field} is required.`,
    );
  }

  return value;
}

export function optionalCheckoutAddress(
  object: JsonObject,
  field: string,
): CheckoutAddressInput | null {
  const value =
    object[field];

  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      `${field} must be an address object.`,
    );
  }

  const address =
    value as JsonObject;

  return {
    recipientName:
      requireAddressString(
        address,
        "recipientName",
      ),
    phone:
      requireAddressString(
        address,
        "phone",
      ),
    email:
      optionalAddressString(
        address,
        "email",
      ),
    countryCode:
      requireAddressString(
        address,
        "countryCode",
      ),
    state:
      optionalAddressString(
        address,
        "state",
      ),
    city:
      requireAddressString(
        address,
        "city",
      ),
    postalCode:
      optionalAddressString(
        address,
        "postalCode",
      ),
    addressLine1:
      requireAddressString(
        address,
        "addressLine1",
      ),
    addressLine2:
      optionalAddressString(
        address,
        "addressLine2",
      ),
    deliveryNotes:
      optionalAddressString(
        address,
        "deliveryNotes",
      ),
  };
}

export async function readCheckoutApiSession(
  request: NextRequest,
  storefrontCode: string,
) {
  return readCartApiSession(
    request,
    storefrontCode,
  );
}

export {
  cartSessionRequiredResponse,
};

function checkoutErrorStatus(
  code:
    CheckoutServiceError["code"],
): number {
  switch (code) {
    case "VALIDATION":
    case "ADDRESS_REQUIRED":
      return 400;

    case "CART_NOT_FOUND":
    case "ORDER_NOT_FOUND":
    case "STOREFRONT_UNAVAILABLE":
      return 404;

    case "CUSTOMER_UNAVAILABLE":
      return 403;

    case "CART_NOT_ACTIVE":
    case "CART_EXPIRED":
    case "EMPTY_CART":
    case "CART_CHANGED":
    case "ORDER_NOT_CANCELLABLE":
    case "ORDER_CONFLICT":
      return 409;

    case "FULFILMENT_UNAVAILABLE":
    case "ADDRESS_UNAVAILABLE":
    case "PRODUCT_UNAVAILABLE":
    case "QUANTITY_LIMIT":
    case "INSUFFICIENT_STOCK":
      return 422;
  }
}

export function checkoutApiErrorResponse(
  error: unknown,
): NextResponse {
  if (
    error instanceof
    CheckoutServiceError
  ) {
    return checkoutJsonResponse(
      {
        error: {
          code: error.code,
          message:
            error.message,
          details:
            error.details,
        },
      },
      checkoutErrorStatus(
        error.code,
      ),
    );
  }

  return authApiErrorResponse(
    error,
  );
}
