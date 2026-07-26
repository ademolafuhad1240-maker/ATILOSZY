export type CheckoutErrorCode =
  | "VALIDATION"
  | "CUSTOMER_UNAVAILABLE"
  | "STOREFRONT_UNAVAILABLE"
  | "FULFILMENT_UNAVAILABLE"
  | "ADDRESS_REQUIRED"
  | "ADDRESS_UNAVAILABLE"
  | "CART_NOT_FOUND"
  | "CART_NOT_ACTIVE"
  | "CART_EXPIRED"
  | "EMPTY_CART"
  | "CART_CHANGED"
  | "PRODUCT_UNAVAILABLE"
  | "QUANTITY_LIMIT"
  | "INSUFFICIENT_STOCK"
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_CANCELLABLE"
  | "ORDER_CONFLICT";

export class CheckoutServiceError extends Error {
  readonly code: CheckoutErrorCode;

  readonly details:
    | Record<string, unknown>
    | undefined;

  constructor(
    code: CheckoutErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);

    this.name =
      "CheckoutServiceError";

    this.code = code;
    this.details = details;
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
