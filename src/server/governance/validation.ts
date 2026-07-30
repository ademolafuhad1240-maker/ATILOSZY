import "server-only";

import {
  StorefrontStaffRole,
} from "@/generated/prisma/client";

import {
  GovernanceServiceError,
} from "./errors";
import type {
  ManagerApplicationDecision,
  ManagerStatusAction,
  StorefrontStaffAction,
} from "./types";

export function normalizeStorefrontCode(
  value: string,
): string {
  const normalized =
    value.trim().toUpperCase();

  if (
    !/^[A-Z]{3}$/u.test(
      normalized,
    )
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      "Storefront code must contain three letters.",
    );
  }

  return normalized;
}

export function normalizeIdentifier(
  value: string,
  label: string,
): string {
  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > 191
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      `${label} is invalid.`,
    );
  }

  return normalized;
}

export function normalizeStatement(
  value: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length < 40 ||
    normalized.length > 2000
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      "Your application statement must contain between 40 and 2,000 characters.",
    );
  }

  return normalized;
}

export function normalizeNote(
  value:
    | string
    | null
    | undefined,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value.trim().length === 0
  ) {
    return null;
  }

  const normalized =
    value.trim();

  if (
    normalized.length > 500
  ) {
    throw new GovernanceServiceError(
      "VALIDATION",
      "The note must not exceed 500 characters.",
    );
  }

  return normalized;
}

export function normalizeApplicationDecision(
  value: string,
): ManagerApplicationDecision {
  const normalized =
    value.trim().toUpperCase();

  if (
    normalized === "APPROVE" ||
    normalized === "REJECT"
  ) {
    return normalized;
  }

  throw new GovernanceServiceError(
    "VALIDATION",
    "Application decision is invalid.",
  );
}

export function normalizeStaffAction(
  value: string,
): StorefrontStaffAction {
  const normalized =
    value.trim().toUpperCase();

  if (
    normalized === "GRANT" ||
    normalized === "CHANGE_ROLE" ||
    normalized === "SUSPEND" ||
    normalized === "REACTIVATE" ||
    normalized === "REVOKE"
  ) {
    return normalized;
  }

  throw new GovernanceServiceError(
    "VALIDATION",
    "Staff action is invalid.",
  );
}

export function normalizeManagerStatusAction(
  value: string,
): ManagerStatusAction {
  const normalized =
    value.trim().toUpperCase();

  if (
    normalized === "SUSPEND" ||
    normalized === "REACTIVATE" ||
    normalized === "REVOKE"
  ) {
    return normalized;
  }

  throw new GovernanceServiceError(
    "VALIDATION",
    "Manager action is invalid.",
  );
}

export function normalizeDelegatedStaffRole(
  value:
    | string
    | null
    | undefined,
): StorefrontStaffRole {
  const normalized =
    value?.trim().toUpperCase();

  if (
    normalized ===
      StorefrontStaffRole
        .FULFILMENT ||
    normalized ===
      StorefrontStaffRole
        .VIEWER
  ) {
    return normalized;
  }

  throw new GovernanceServiceError(
    "VALIDATION",
    "Managers may grant only fulfilment or view-only access.",
  );
}
