export interface AuthDeliveryBase {
  deliveryId: string;
  storefrontCode: string;
  storefrontName: string;
  storefrontRoute: string;
  expiresAt: Date;
}

export interface EmailVerificationDelivery
  extends AuthDeliveryBase {
  recipientEmail: string;
  token: string;
}

export interface PhoneVerificationDelivery
  extends AuthDeliveryBase {
  recipientPhone: string;
  challengeId: string;
  code: string;
}

export interface PasswordResetDelivery
  extends AuthDeliveryBase {
  recipientEmail: string;
  token: string;
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

export type AuthDeliveryFetch =
  typeof fetch;
