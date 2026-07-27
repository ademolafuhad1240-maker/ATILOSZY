export type PaymentServiceErrorCode =
  | "VALIDATION"
  | "STOREFRONT_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_PAYABLE"
  | "PRODUCT_PAYMENT_NOT_FOUND"
  | "PAYMENT_NOT_RECONCILABLE"
  | "PAYMENT_ALREADY_PROCESSING"
  | "PAYMENT_IDEMPOTENCY_CONFLICT"
  | "PAYMENT_REFERENCE_CONFLICT"
  | "EVENT_PAYLOAD_CONFLICT"
  | "PAYMENT_CONFLICT";

export class PaymentServiceError extends Error {
  readonly code:
    PaymentServiceErrorCode;

  readonly details:
    Record<string, unknown> |
    undefined;

  constructor(
    code:
      PaymentServiceErrorCode,
    message: string,
    details?:
      Record<string, unknown>,
  ) {
    super(message);

    this.name =
      "PaymentServiceError";

    this.code = code;
    this.details = details;
  }
}

export function isPaymentServiceErrorCode(
  error: unknown,
  expectedCode:
    PaymentServiceErrorCode,
): boolean {
  return (
    error instanceof
      PaymentServiceError &&
    error.code ===
      expectedCode
  );
}
