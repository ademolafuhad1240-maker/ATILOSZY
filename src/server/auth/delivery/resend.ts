import {
  AuthDeliveryProviderError,
} from "./errors";
import {
  readJsonRecord,
  sendDeliveryRequest,
} from "./http";
import type {
  AuthDeliveryFetch,
  EmailVerificationDelivery,
  PasswordResetDelivery,
} from "./types";
import {
  buildStorefrontAuthUrl,
  normalizeAppOrigin,
} from "./urls";

const RESEND_EMAILS_URL =
  "https://api.resend.com/emails";
const USER_AGENT =
  "sorvyra-store/0.1";

export interface ResendEmailSender {
  sendEmailVerification(
    delivery: EmailVerificationDelivery,
  ): Promise<void>;
  sendPasswordReset(
    delivery: PasswordResetDelivery,
  ): Promise<void>;
}

export interface ResendEmailSenderOptions {
  apiKey: string;
  from: string;
  appOrigin: string;
  timeoutMs?: number;
  fetchImplementation?:
    AuthDeliveryFetch;
}

function requireConfigurationValue(
  value: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new AuthDeliveryProviderError(
      "resend",
      "CONFIGURATION",
    );
  }

  return normalized;
}

function escapeHtml(
  value: string,
): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatExpiry(
  expiresAt: Date,
): string {
  return expiresAt.toISOString();
}

export function createResendEmailSender(
  options:
    ResendEmailSenderOptions,
): ResendEmailSender {
  const apiKey =
    requireConfigurationValue(
      options.apiKey,
    );
  const from =
    requireConfigurationValue(
      options.from,
    );
  const appOrigin =
    normalizeAppOrigin(
      options.appOrigin,
    );

  if (
    from.length > 320 ||
    !from.includes("@")
  ) {
    throw new AuthDeliveryProviderError(
      "resend",
      "CONFIGURATION",
    );
  }

  async function sendEmail(
    input: {
      deliveryId: string;
      recipientEmail: string;
      storefrontCode: string;
      subject: string;
      text: string;
      html: string;
      messageType:
        | "email-verification"
        | "password-reset";
    },
  ): Promise<void> {
    const idempotencyKey =
      `auth/${input.messageType}/${input.deliveryId}`;

    if (
      idempotencyKey.length > 256
    ) {
      throw new AuthDeliveryProviderError(
        "resend",
        "CONFIGURATION",
      );
    }

    const response =
      await sendDeliveryRequest({
        provider: "resend",
        url: RESEND_EMAILS_URL,
        timeoutMs:
          options.timeoutMs,
        fetchImplementation:
          options.fetchImplementation,
        init: {
          method: "POST",
          headers: {
            Accept:
              "application/json",
            Authorization:
              `Bearer ${apiKey}`,
            "Content-Type":
              "application/json",
            "Idempotency-Key":
              idempotencyKey,
            "User-Agent": USER_AGENT,
          },
          body: JSON.stringify({
            from,
            to: [
              input.recipientEmail,
            ],
            subject: input.subject,
            text: input.text,
            html: input.html,
            tags: [
              {
                name: "storefront",
                value:
                  input.storefrontCode,
              },
              {
                name: "message_type",
                value:
                  input.messageType,
              },
            ],
          }),
        },
      });

    const body =
      await readJsonRecord(response);

    if (!response.ok) {
      throw new AuthDeliveryProviderError(
        "resend",
        "HTTP_REJECTED",
      );
    }

    if (
      !body ||
      typeof body.id !== "string" ||
      body.id.trim() === ""
    ) {
      throw new AuthDeliveryProviderError(
        "resend",
        "MALFORMED_RESPONSE",
      );
    }
  }

  return {
    async sendEmailVerification(
      delivery,
    ): Promise<void> {
      const verificationUrl =
        buildStorefrontAuthUrl({
          appOrigin,
          storefrontRoute:
            delivery.storefrontRoute,
          page: "verify",
          parameter: "token",
          value: delivery.token,
        });

      const escapedName =
        escapeHtml(
          delivery.storefrontName,
        );
      const escapedUrl =
        escapeHtml(verificationUrl);

      await sendEmail({
        deliveryId:
          delivery.deliveryId,
        recipientEmail:
          delivery.recipientEmail,
        storefrontCode:
          delivery.storefrontCode,
        messageType:
          "email-verification",
        subject:
          `Verify your ${delivery.storefrontName} account`,
        text:
          `Verify your ${delivery.storefrontName} account by opening this link: ${verificationUrl}\n\nThis link expires at ${formatExpiry(delivery.expiresAt)}. If you did not request this account, ignore this message.`,
        html:
          `<p>Verify your <strong>${escapedName}</strong> account.</p><p><a href="${escapedUrl}">Verify email address</a></p><p>This link expires at ${escapeHtml(formatExpiry(delivery.expiresAt))}.</p><p>If you did not request this account, ignore this message.</p>`,
      });
    },

    async sendPasswordReset(
      delivery,
    ): Promise<void> {
      const resetUrl =
        buildStorefrontAuthUrl({
          appOrigin,
          storefrontRoute:
            delivery.storefrontRoute,
          page: "reset-password",
          parameter: "token",
          value: delivery.token,
        });

      const escapedName =
        escapeHtml(
          delivery.storefrontName,
        );
      const escapedUrl =
        escapeHtml(resetUrl);

      await sendEmail({
        deliveryId:
          delivery.deliveryId,
        recipientEmail:
          delivery.recipientEmail,
        storefrontCode:
          delivery.storefrontCode,
        messageType:
          "password-reset",
        subject:
          `Reset your ${delivery.storefrontName} password`,
        text:
          `Reset your ${delivery.storefrontName} password by opening this link: ${resetUrl}\n\nThis link expires at ${formatExpiry(delivery.expiresAt)}. If you did not request a password reset, ignore this message.`,
        html:
          `<p>Reset your <strong>${escapedName}</strong> password.</p><p><a href="${escapedUrl}">Reset password</a></p><p>This link expires at ${escapeHtml(formatExpiry(delivery.expiresAt))}.</p><p>If you did not request a password reset, ignore this message.</p>`,
      });
    },
  };
}
