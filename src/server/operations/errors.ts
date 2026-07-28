import "server-only";

export type StaffOrderErrorCode =
  | "VALIDATION"
  | "STAFF_ACCESS_REQUIRED"
  | "STAFF_ACTION_FORBIDDEN"
  | "STOREFRONT_UNAVAILABLE"
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_PAID"
  | "DELIVERY_PAYMENT_REQUIRED"
  | "INVALID_TRANSITION"
  | "INVENTORY_CONFLICT"
  | "ORDER_CONFLICT";

export class StaffOrderServiceError extends Error {
  readonly code:
    StaffOrderErrorCode;

  constructor(
    code:
      StaffOrderErrorCode,
    message: string,
  ) {
    super(message);

    this.name =
      "StaffOrderServiceError";
    this.code = code;
  }
}

export function isPrismaErrorCode(
  error: unknown,
  expectedCode: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === expectedCode
  );
}
