import "server-only";

import type {
  NextRequest,
} from "next/server";

import {
  authApiErrorResponse,
  authJsonResponse,
} from "@/server/auth/http";
import {
  readCartApiSession,
} from "@/server/cart/http";

import {
  StaffOrderServiceError,
} from "./errors";
import {
  normalizeFulfilmentAction,
  normalizeNote,
  normalizeOrderLimit,
  normalizeStaffOrderQueue,
  normalizeStorefrontCode,
} from "./validation";

type JsonObject =
  Record<string, unknown>;

export function staffJsonResponse(
  body: unknown,
  status = 200,
) {
  return authJsonResponse(
    body,
    status,
  );
}

export function staffSessionRequiredResponse() {
  return staffJsonResponse(
    {
      ok: false,
      error: {
        code:
          "SESSION_INVALID",
        message:
          "Sign in to this storefront to access staff operations.",
      },
    },
    401,
  );
}

export async function readStaffApiSession(
  request: NextRequest,
  storefrontCode: string,
) {
  return readCartApiSession(
    request,
    storefrontCode,
  );
}

export function requireStaffStorefrontCode(
  value: unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    throw new StaffOrderServiceError(
      "VALIDATION",
      "Storefront code is required.",
    );
  }

  return normalizeStorefrontCode(
    value,
  );
}

export function requireStaffAction(
  value: unknown,
) {
  if (
    typeof value !== "string"
  ) {
    throw new StaffOrderServiceError(
      "VALIDATION",
      "Fulfilment action is required.",
    );
  }

  return normalizeFulfilmentAction(
    value,
  );
}

export function optionalStaffNote(
  value: unknown,
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (
    typeof value !== "string"
  ) {
    throw new StaffOrderServiceError(
      "VALIDATION",
      "Fulfilment note is invalid.",
    );
  }

  return normalizeNote(value);
}

export function requireTransitionFields(
  body: JsonObject,
): void {
  const allowed =
    new Set([
      "storefrontCode",
      "action",
      "note",
    ]);

  if (
    Object.keys(body).some(
      (field) =>
        !allowed.has(field),
    )
  ) {
    throw new StaffOrderServiceError(
      "VALIDATION",
      "Order states, staff identity, inventory values and audit fields are controlled by the server.",
    );
  }
}

export function staffQueueFromRequest(
  request: NextRequest,
) {
  return normalizeStaffOrderQueue(
    request.nextUrl
      .searchParams.get(
        "queue",
      ),
  );
}

export function staffLimitFromRequest(
  request: NextRequest,
) {
  const value =
    request.nextUrl
      .searchParams.get(
        "limit",
      );

  if (value === null) {
    return normalizeOrderLimit(
      undefined,
    );
  }

  if (
    !/^\d{1,3}$/u.test(
      value,
    )
  ) {
    throw new StaffOrderServiceError(
      "VALIDATION",
      "Order limit is invalid.",
    );
  }

  return normalizeOrderLimit(
    Number(value),
  );
}

const errorStatuses: Record<
  StaffOrderServiceError["code"],
  number
> = {
  VALIDATION: 400,
  STAFF_ACCESS_REQUIRED: 403,
  STAFF_ACTION_FORBIDDEN: 403,
  STOREFRONT_UNAVAILABLE: 404,
  ORDER_NOT_FOUND: 404,
  ORDER_NOT_PAID: 409,
  DELIVERY_PAYMENT_REQUIRED: 409,
  INVALID_TRANSITION: 409,
  INVENTORY_CONFLICT: 409,
  ORDER_CONFLICT: 409,
};

export function staffApiErrorResponse(
  error: unknown,
) {
  if (
    error instanceof
    StaffOrderServiceError
  ) {
    return staffJsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message:
            error.message,
        },
      },
      errorStatuses[
        error.code
      ],
    );
  }

  return authApiErrorResponse(
    error,
  );
}
