import {
  AuthDeliveryProviderError,
} from "./errors";
import {
  readJsonRecord,
  sendDeliveryRequest,
} from "./http";
import type {
  AuthDeliveryFetch,
  PhoneVerificationDelivery,
} from "./types";
import {
  buildStorefrontAuthUrl,
  normalizeAppOrigin,
} from "./urls";

export interface TwilioSmsSender {
  sendPhoneVerification(
    delivery: PhoneVerificationDelivery,
  ): Promise<void>;
}

export interface TwilioSmsSenderOptions {
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  appOrigin: string;
  from?: string;
  messagingServiceSid?: string;
  timeoutMs?: number;
  fetchImplementation?:
    AuthDeliveryFetch;
}

const ACCEPTED_STATUSES =
  new Set([
    "accepted",
    "delivered",
    "queued",
    "sending",
    "sent",
  ]);

function requireConfigurationValue(
  value: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new AuthDeliveryProviderError(
      "twilio",
      "CONFIGURATION",
    );
  }

  return normalized;
}

export function createTwilioSmsSender(
  options:
    TwilioSmsSenderOptions,
): TwilioSmsSender {
  const accountSid =
    requireConfigurationValue(
      options.accountSid,
    );
  const apiKey =
    requireConfigurationValue(
      options.apiKey,
    );
  const apiKeySecret =
    requireConfigurationValue(
      options.apiKeySecret,
    );
  const appOrigin =
    normalizeAppOrigin(
      options.appOrigin,
    );
  const from =
    options.from?.trim() ?? "";
  const messagingServiceSid =
    options.messagingServiceSid
      ?.trim() ?? "";

  if (
    !/^AC[0-9a-f]{32}$/i.test(
      accountSid,
    ) ||
    !/^SK[0-9a-f]{32}$/i.test(
      apiKey,
    ) ||
    (from === "" &&
      messagingServiceSid === "") ||
    (from !== "" &&
      messagingServiceSid !== "") ||
    (messagingServiceSid !== "" &&
      !/^MG[0-9a-f]{32}$/i.test(
        messagingServiceSid,
      ))
  ) {
    throw new AuthDeliveryProviderError(
      "twilio",
      "CONFIGURATION",
    );
  }

  const authorization =
    Buffer.from(
      `${apiKey}:${apiKeySecret}`,
      "utf8",
    ).toString("base64");

  return {
    async sendPhoneVerification(
      delivery,
    ): Promise<void> {
      const verificationUrl =
        buildStorefrontAuthUrl({
          appOrigin,
          storefrontRoute:
            delivery.storefrontRoute,
          page: "verify",
          parameter:
            "challengeId",
          value:
            delivery.challengeId,
        });

      const form =
        new URLSearchParams({
          To: delivery.recipientPhone,
          Body:
            `${delivery.storefrontName} verification code: ${delivery.code}. Open ${verificationUrl} and enter the code. Expires ${delivery.expiresAt.toISOString()}. Do not share it.`,
        });

      if (from) {
        form.set("From", from);
      } else {
        form.set(
          "MessagingServiceSid",
          messagingServiceSid,
        );
      }

      const response =
        await sendDeliveryRequest({
          provider: "twilio",
          url:
            `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
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
                `Basic ${authorization}`,
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          },
        });

      const body =
        await readJsonRecord(response);

      if (!response.ok) {
        throw new AuthDeliveryProviderError(
          "twilio",
          "HTTP_REJECTED",
        );
      }

      if (
        !body ||
        typeof body.sid !== "string" ||
        !/^(SM|MM)[0-9a-f]{32}$/i.test(
          body.sid,
        ) ||
        typeof body.status !==
          "string" ||
        !ACCEPTED_STATUSES.has(
          body.status.toLowerCase(),
        )
      ) {
        throw new AuthDeliveryProviderError(
          "twilio",
          "MALFORMED_RESPONSE",
        );
      }
    },
  };
}
