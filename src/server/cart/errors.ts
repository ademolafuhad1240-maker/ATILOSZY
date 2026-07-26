export type CartErrorCode =
  | "VALIDATION"
  | "CUSTOMER_UNAVAILABLE"
  | "CART_NOT_FOUND"
  | "CART_INACTIVE"
  | "ITEM_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "PRICE_UNAVAILABLE"
  | "QUANTITY_LIMIT"
  | "INSUFFICIENT_STOCK"
  | "CONFLICT";

export class CartServiceError extends Error {
  readonly code: CartErrorCode;

  readonly details:
    | Record<string, unknown>
    | undefined;

  constructor(
    code: CartErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);

    this.name = "CartServiceError";
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
