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
  GovernanceServiceError,
} from "./errors";
import type {
  JsonObject,
} from "./internal-types";
import {
  normalizeApplicationDecision,
  normalizeManagerStatusAction,
  normalizeStaffAction,
  normalizeStorefrontCode,
} from "./validation";

export function governanceJsonResponse(
  body: unknown,
  status = 200,
) {
  return authJsonResponse(
    body,
    status,
  );
}

export function governanceSessionRequiredResponse() {
  return governanceJsonResponse(
    {
      ok: false,
      error: {
        code: "SESSION_INVALID",
        message:
          "Sign in with the selected storefront account to continue.",
      },
    },
    401,
  );
}

export async function readGovernanceSession(
  request: NextRequest,
  storefrontCode: string,
) {
  return readCartApiSession(
    request,
    storefrontCode,
  );
}

export function requireStringField(
  body: JsonObject,
  field: string,
  maxLength: number,
  trim = true,
): string {
  const value = body[field];

  if (
    typeof value !== "string"
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      `${field} is required.`,
    );
  }

  const normalized = trim
    ? value.trim()
    : value;

  if (
    normalized.length === 0 ||
    normalized.length >
      maxLength
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      `${field} is invalid.`,
    );
  }

  return normalized;
}

export function optionalStringField(
  body: JsonObject,
  field: string,
  maxLength: number,
): string | null {
  const value = body[field];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return requireStringField(
    body,
    field,
    maxLength,
  );
}

export function assertOnlyFields(
  body: JsonObject,
  allowedFields: readonly string[],
): void {
  const allowed =
    new Set(allowedFields);

  if (
    Object.keys(body).some(
      (field) =>
        !allowed.has(field),
    )
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      "Identity, permissions, application status and audit fields are controlled by the server.",
    );
  }
}

export function requireStorefrontCode(
  value: unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      "Storefront code is required.",
    );
  }

  return normalizeStorefrontCode(
    value,
  );
}

export function requireDecision(
  value: unknown,
) {
  if (
    typeof value !== "string"
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      "Application decision is required.",
    );
  }

  return normalizeApplicationDecision(
    value,
  );
}

export function requireStaffAction(
  value: unknown,
) {
  if (
    typeof value !== "string"
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      "Staff action is required.",
    );
  }

  return normalizeStaffAction(
    value,
  );
}

export function requireManagerAction(
  value: unknown,
) {
  if (
    typeof value !== "string"
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      "Manager action is required.",
    );
  }

  return normalizeManagerStatusAction(
    value,
  );
}

const errorStatuses: Record<
  GovernanceServiceError["code"],
  number
> = {
  VALIDATION: 400,
  STOREFRONT_UNAVAILABLE: 404,
  ACCOUNT_UNAVAILABLE: 403,
  APPLICATION_ALREADY_PENDING: 409,
  MANAGER_ACCESS_EXISTS: 409,
  APPLICATION_NOT_FOUND: 404,
  APPLICATION_NOT_PENDING: 409,
  APPLICATION_SELF_REVIEW_FORBIDDEN: 403,
  PLATFORM_ACCESS_REQUIRED: 403,
  MANAGER_ACCESS_REQUIRED: 403,
  STAFF_TARGET_NOT_FOUND: 404,
  STAFF_TARGET_PROTECTED: 403,
  INVALID_STAFF_ACTION: 409,
  INVALID_MANAGER_ACTION: 409,
  GOVERNANCE_CONFLICT: 409,
};

export function governanceApiErrorResponse(
  error: unknown,
) {
  if (
    error instanceof
    GovernanceServiceError
  ) {
    return governanceJsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      errorStatuses[error.code],
    );
  }

  return authApiErrorResponse(
    error,
  );
}
