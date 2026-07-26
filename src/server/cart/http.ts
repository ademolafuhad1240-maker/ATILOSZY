import "server-only";

import type {
  NextRequest,
} from "next/server";

import {
  validateSession,
} from "../auth";
import {
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  readSessionCookie,
} from "../auth/http";

import {
  CartServiceError,
} from "./errors";

export function requireStorefrontCode(
  value:
    | string
    | null
    | undefined,
): string {
  const normalized =
    value?.trim().toUpperCase() ??
    "";

  if (
    normalized.length < 2 ||
    normalized.length > 12 ||
    !/^[A-Z0-9_-]+$/.test(
      normalized,
    )
  ) {
    throw new CartServiceError(
      "VALIDATION",
      "A valid storefront code is required.",
    );
  }

  return normalized;
}

export function requiredIntegerField(
  body: Record<string, unknown>,
  field: string,
): number {
  const value = body[field];

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new CartServiceError(
      "VALIDATION",
      `${field} must be a whole number.`,
    );
  }

  return value;
}

export async function readCartApiSession(
  request: NextRequest,
  storefrontCode: string,
) {
  const sessionToken =
    readSessionCookie(
      request,
      storefrontCode,
    );

  if (!sessionToken) {
    return null;
  }

  return validateSession({
    storefrontCode,
    sessionToken,
    tokenSecret:
      getAuthTokenSecret(),
  });
}

export function cartSessionRequiredResponse() {
  return authJsonResponse(
    {
      ok: false,
      error: {
        code: "SESSION_INVALID",
        message:
          "Sign in to this storefront to access its cart.",
      },
    },
    401,
  );
}

const cartErrorStatus = {
  VALIDATION: 400,
  CUSTOMER_UNAVAILABLE: 403,
  CART_NOT_FOUND: 404,
  CART_INACTIVE: 409,
  ITEM_NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 409,
  PRICE_UNAVAILABLE: 409,
  QUANTITY_LIMIT: 409,
  INSUFFICIENT_STOCK: 409,
  CONFLICT: 409,
} as const;

export function cartApiErrorResponse(
  error: unknown,
) {
  if (
    error instanceof
    CartServiceError
  ) {
    return authJsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details:
            error.details,
        },
      },
      cartErrorStatus[
        error.code
      ],
    );
  }

  return authApiErrorResponse(error);
}
