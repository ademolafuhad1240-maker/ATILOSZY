import {
  AuthDeliveryUnavailableError,
} from "./errors";
import {
  createResendEmailSender,
  type ResendEmailSenderOptions,
} from "./resend";
import type {
  AuthDeliveryProvider,
} from "./types";

export type ResendOnlyAuthDeliveryProviderOptions =
  ResendEmailSenderOptions;

export function createResendOnlyAuthDeliveryProvider(
  options:
    ResendOnlyAuthDeliveryProviderOptions,
): AuthDeliveryProvider {
  const email =
    createResendEmailSender(options);

  return {
    name: "resend",
    enabled: true,
    phoneVerificationEnabled: false,
    sendEmailVerification:
      email.sendEmailVerification,
    async sendPhoneVerification() {
      throw new AuthDeliveryUnavailableError();
    },
    sendPasswordReset:
      email.sendPasswordReset,
  };
}
