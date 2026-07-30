import type {
  AuthDeliveryProvider,
} from "./types";
import {
  createResendEmailSender,
  type ResendEmailSenderOptions,
} from "./resend";
import {
  createTwilioSmsSender,
  type TwilioSmsSenderOptions,
} from "./twilio";

export interface ResendTwilioAuthDeliveryProviderOptions {
  resend:
    ResendEmailSenderOptions;
  twilio:
    TwilioSmsSenderOptions;
}

export function createResendTwilioAuthDeliveryProvider(
  options:
    ResendTwilioAuthDeliveryProviderOptions,
): AuthDeliveryProvider {
  const email =
    createResendEmailSender(
      options.resend,
    );
  const sms =
    createTwilioSmsSender(
      options.twilio,
    );

  return {
    name: "resend-twilio",
    enabled: true,
    phoneVerificationEnabled: true,
    sendEmailVerification:
      email.sendEmailVerification,
    sendPhoneVerification:
      sms.sendPhoneVerification,
    sendPasswordReset:
      email.sendPasswordReset,
  };
}
