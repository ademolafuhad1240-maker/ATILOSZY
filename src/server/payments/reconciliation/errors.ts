import "server-only";

export type PaymentReconciliationErrorCode =
  | "PAYMENT_RECONCILIATION_UNAVAILABLE"
  | "PAYMENT_RECONCILIATION_PROVIDER_UNAVAILABLE"
  | "PAYMENT_RECONCILIATION_DATA_INVALID";

export class PaymentReconciliationError extends Error {
  readonly code:
    PaymentReconciliationErrorCode;

  readonly status: number;

  readonly retryAfterSeconds:
    number | null;

  constructor(
    code:
      PaymentReconciliationErrorCode,
    message: string,
    status: number,
    retryAfterSeconds:
      number | null = null,
  ) {
    super(message);

    this.name =
      "PaymentReconciliationError";

    this.code =
      code;

    this.status =
      status;

    this.retryAfterSeconds =
      retryAfterSeconds;
  }
}

export function isPaymentReconciliationError(
  error: unknown,
): error is PaymentReconciliationError {
  return (
    error instanceof
      PaymentReconciliationError
  );
}
