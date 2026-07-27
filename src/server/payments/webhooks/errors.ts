import "server-only";

export type PaymentWebhookErrorCode =
  | "WEBHOOK_CONFIGURATION_ERROR"
  | "WEBHOOK_CONTENT_TYPE_REQUIRED"
  | "WEBHOOK_BODY_INVALID"
  | "WEBHOOK_BODY_TOO_LARGE"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "WEBHOOK_PROVIDER_DATA_INVALID"
  | "WEBHOOK_PROVIDER_VERIFICATION_UNAVAILABLE";

export class PaymentWebhookError
  extends Error {
  readonly code:
    PaymentWebhookErrorCode;

  readonly status: number;

  constructor(
    code:
      PaymentWebhookErrorCode,
    message: string,
    status: number,
  ) {
    super(
      message,
    );

    this.name =
      "PaymentWebhookError";

    this.code =
      code;

    this.status =
      status;
  }
}

export function isPaymentWebhookError(
  error: unknown,
): error is
  PaymentWebhookError {
  return (
    error instanceof
      PaymentWebhookError
  );
}
