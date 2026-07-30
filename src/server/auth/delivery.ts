import "server-only";

import {
  AuthDeliveryProviderError,
  AuthDeliveryUnavailableError,
  isAuthDeliveryUnavailableError,
} from "./delivery/errors";
import {
  normalizeDeliveryTimeout,
} from "./delivery/http";
import {
  createResendTwilioAuthDeliveryProvider,
} from "./delivery/resend-twilio";
import type {
  AuthDeliveryProvider,
} from "./delivery/types";

export {
  AuthDeliveryProviderError,
  AuthDeliveryUnavailableError,
  createResendTwilioAuthDeliveryProvider,
  isAuthDeliveryUnavailableError,
};

export {
  createResendEmailSender,
} from "./delivery/resend";

export {
  createTwilioSmsSender,
} from "./delivery/twilio";

export type {
  ResendEmailSender,
  ResendEmailSenderOptions,
} from "./delivery/resend";

export type {
  ResendTwilioAuthDeliveryProviderOptions,
} from "./delivery/resend-twilio";

export type {
  TwilioSmsSender,
  TwilioSmsSenderOptions,
} from "./delivery/twilio";

export type {
  AuthDeliveryFetch,
  AuthDeliveryProvider,
  EmailVerificationDelivery,
  PasswordResetDelivery,
  PhoneVerificationDelivery,
} from "./delivery/types";

function requiredEnvironmentValue(
  name: string,
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new AuthDeliveryProviderError(
      "configuration",
      "CONFIGURATION",
    );
  }

  return value;
}

function configuredTimeout():
  number {
  const raw =
    process.env
      .AUTH_DELIVERY_TIMEOUT_MS
      ?.trim();

  if (!raw) {
    return normalizeDeliveryTimeout();
  }

  if (!/^\d+$/.test(raw)) {
    throw new AuthDeliveryProviderError(
      "configuration",
      "CONFIGURATION",
    );
  }

  return normalizeDeliveryTimeout(
    Number(raw),
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

  if (
    configuredProvider ===
    "resend-twilio"
  ) {
    const timeoutMs =
      configuredTimeout();
    const appOrigin =
      requiredEnvironmentValue(
        "APP_ORIGIN",
      );

    return createResendTwilioAuthDeliveryProvider(
      {
        resend: {
          apiKey:
            requiredEnvironmentValue(
              "RESEND_API_KEY",
            ),
          from:
            requiredEnvironmentValue(
              "AUTH_EMAIL_FROM",
            ),
          appOrigin,
          timeoutMs,
        },
        twilio: {
          accountSid:
            requiredEnvironmentValue(
              "TWILIO_ACCOUNT_SID",
            ),
          apiKey:
            requiredEnvironmentValue(
              "TWILIO_API_KEY",
            ),
          apiKeySecret:
            requiredEnvironmentValue(
              "TWILIO_API_KEY_SECRET",
            ),
          from:
            process.env
              .AUTH_SMS_SENDER,
          messagingServiceSid:
            process.env
              .TWILIO_MESSAGING_SERVICE_SID,
          appOrigin,
          timeoutMs,
        },
      },
    );
  }

  throw new AuthDeliveryProviderError(
    "configuration",
    "CONFIGURATION",
  );
}

export function assertAuthDeliveryEnabled(
  provider: AuthDeliveryProvider,
): void {
  if (!provider.enabled) {
    throw new AuthDeliveryUnavailableError();
  }
}
