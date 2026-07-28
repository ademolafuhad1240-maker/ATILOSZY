import "server-only";

import {
  OrderFulfilmentAction,
} from "@/generated/prisma/client";

import {
  StaffOrderServiceError,
} from "./errors";
import type {
  StaffOrderQueue,
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
    throw new StaffOrderServiceError(
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
  const normalized =
    value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > 191
  ) {
    throw new StaffOrderServiceError(
      "VALIDATION",
      `${label} is invalid.`,
    );
  }

  return normalized;
}

export function normalizeOrderNumber(
  value: string,
): string {
  const normalized =
    value.trim().toUpperCase();

  if (
    !/^[A-Z]{3}-[A-Z0-9]{10,32}$/u.test(
      normalized,
    )
  ) {
    throw new StaffOrderServiceError(
      "VALIDATION",
      "Order number is invalid.",
    );
  }

  return normalized;
}

export function normalizeStaffOrderQueue(
  value:
    | string
    | null
    | undefined,
): StaffOrderQueue {
  const normalized =
    value?.trim().toUpperCase() ??
    "ACTIONABLE";

  if (
    normalized === "ACTIONABLE" ||
    normalized === "COMPLETED" ||
    normalized === "ALL"
  ) {
    return normalized;
  }

  throw new StaffOrderServiceError(
    "VALIDATION",
    "Order queue is invalid.",
  );
}

export function normalizeOrderLimit(
  value:
    | number
    | undefined,
): number {
  const resolved =
    value ?? 25;

  if (
    !Number.isSafeInteger(
      resolved,
    ) ||
    resolved < 1 ||
    resolved > 100
  ) {
    throw new StaffOrderServiceError(
      "VALIDATION",
      "Order limit must be between 1 and 100.",
    );
  }

  return resolved;
}

export function normalizeFulfilmentAction(
  value: string,
): OrderFulfilmentAction {
  const normalized =
    value.trim().toUpperCase();

  if (
    Object.values(
      OrderFulfilmentAction,
    ).includes(
      normalized as
        OrderFulfilmentAction,
    )
  ) {
    return normalized as
      OrderFulfilmentAction;
  }

  throw new StaffOrderServiceError(
    "VALIDATION",
    "Fulfilment action is invalid.",
  );
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
    throw new StaffOrderServiceError(
      "VALIDATION",
      "Fulfilment note must not exceed 500 characters.",
    );
  }

  return normalized;
}
