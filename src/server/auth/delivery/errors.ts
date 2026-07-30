export type AuthDeliveryFailureReason =
  | "CONFIGURATION"
  | "HTTP_REJECTED"
  | "MALFORMED_RESPONSE"
  | "NETWORK"
  | "TIMEOUT";

export class AuthDeliveryUnavailableError
  extends Error {
  readonly code =
    "AUTH_DELIVERY_UNAVAILABLE";

  constructor(
    message =
      "Authentication message delivery is unavailable.",
  ) {
    super(message);

    this.name =
      "AuthDeliveryUnavailableError";
  }
}

export class AuthDeliveryProviderError
  extends AuthDeliveryUnavailableError {
  readonly provider: string;
  readonly reason:
    AuthDeliveryFailureReason;

  constructor(
    provider: string,
    reason:
      AuthDeliveryFailureReason,
  ) {
    super();

    this.name =
      "AuthDeliveryProviderError";
    this.provider = provider;
    this.reason = reason;
  }
}

export function isAuthDeliveryUnavailableError(
  error: unknown,
): error is AuthDeliveryUnavailableError {
  return (
    error instanceof
    AuthDeliveryUnavailableError
  );
}
