import "server-only";

export type PaymentVerificationErrorCode =
  | "PAYMENT_VERIFICATION_CONFIGURATION_ERROR"
  | "PAYMENT_VERIFICATION_UNAVAILABLE"
  | "PAYMENT_VERIFICATION_DATA_INVALID";

export class PaymentVerificationError extends Error {
  readonly code:
    PaymentVerificationErrorCode;

  readonly provider:
    string | null;

  constructor(
    code:
      PaymentVerificationErrorCode,
    message: string,
    provider:
      string | null = null,
  ) {
    super(message);

    this.name =
      "PaymentVerificationError";

    this.code =
      code;

    this.provider =
      provider;
  }
}

export function isPaymentVerificationError(
  error: unknown,
): error is PaymentVerificationError {
  return (
    error instanceof
      PaymentVerificationError
  );
}
