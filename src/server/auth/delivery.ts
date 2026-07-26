import "server-only";

export interface EmailVerificationDelivery {
  storefrontCode: string;
  storefrontName: string;
  recipientEmail: string;
  token: string;
  expiresAt: Date;
}

export interface PhoneVerificationDelivery {
  storefrontCode: string;
  storefrontName: string;
  recipientPhone: string;
  challengeId: string;
  code: string;
  expiresAt: Date;
}

export interface PasswordResetDelivery {
  storefrontCode: string;
  storefrontName: string;
  recipientEmail: string;
  token: string;
  expiresAt: Date;
}

export interface AuthDeliveryProvider {
  readonly name: string;
  readonly enabled: boolean;

  sendEmailVerification(
    delivery: EmailVerificationDelivery,
  ): Promise<void>;

  sendPhoneVerification(
    delivery: PhoneVerificationDelivery,
  ): Promise<void>;

  sendPasswordReset(
    delivery: PasswordResetDelivery,
  ): Promise<void>;
}

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

export function isAuthDeliveryUnavailableError(
  error: unknown,
): error is AuthDeliveryUnavailableError {
  return (
    error instanceof
    AuthDeliveryUnavailableError
  );
}

export function createDisabledAuthDeliveryProvider(): AuthDeliveryProvider {
  async function unavailable(): Promise<never> {
    throw new AuthDeliveryUnavailableError();
  }

  return {
    name: "disabled",
    enabled: false,
    sendEmailVerification: unavailable,
    sendPhoneVerification: unavailable,
    sendPasswordReset: unavailable,
  };
}

export function getAuthDeliveryProvider(): AuthDeliveryProvider {
  const configuredProvider = (
    process.env.AUTH_DELIVERY_PROVIDER ??
    "disabled"
  )
    .trim()
    .toLowerCase();

  if (
    configuredProvider === "" ||
    configuredProvider === "disabled"
  ) {
    return createDisabledAuthDeliveryProvider();
  }

  throw new Error(
    `Unsupported AUTH_DELIVERY_PROVIDER: ${configuredProvider}`,
  );
}

export function assertAuthDeliveryEnabled(
  provider: AuthDeliveryProvider,
): void {
  if (!provider.enabled) {
    throw new AuthDeliveryUnavailableError();
  }
}
