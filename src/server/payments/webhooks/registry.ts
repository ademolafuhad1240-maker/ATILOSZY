import "server-only";

import {
  PaymentWebhookError,
} from "./errors";
import {
  createFlutterwaveWebhookProvider,
} from "./flutterwave";
import {
  createPaystackWebhookProvider,
} from "./paystack";
import type {
  PaymentWebhookFetch,
} from "./transport";
import type {
  PaymentWebhookProvider,
} from "./types";

export type PaymentWebhookProviderName =
  | "paystack"
  | "flutterwave";

export interface PaymentWebhookEnvironment {
  [name: string]:
    string |
    undefined;
  PAYSTACK_SECRET_KEY?:
    string;
  FLUTTERWAVE_SECRET_KEY?:
    string;
  FLUTTERWAVE_WEBHOOK_SECRET_HASH?:
    string;
}

export interface ResolvePaymentWebhookOptions {
  environment?:
    PaymentWebhookEnvironment;
  fetchImplementation?:
    PaymentWebhookFetch;
  timeoutMilliseconds?:
    number;
}

function configuredSecret(
  value:
    string |
    undefined,
  minimumLength: number,
): string {
  const normalized =
    value?.trim() ?? "";

  if (
    normalized.length <
      minimumLength ||
    /\s/.test(
      normalized,
    )
  ) {
    throw new PaymentWebhookError(
      "WEBHOOK_CONFIGURATION_ERROR",
      "The payment webhook is not configured correctly.",
      503,
    );
  }

  return normalized;
}

export function resolvePaymentWebhookProvider(
  providerName:
    PaymentWebhookProviderName,
  options:
    ResolvePaymentWebhookOptions = {},
): PaymentWebhookProvider {
  const environment =
    options.environment ??
    process.env;

  switch (
    providerName
  ) {
    case "paystack":
      return createPaystackWebhookProvider(
        {
          secretKey:
            configuredSecret(
              environment
                .PAYSTACK_SECRET_KEY,
              12,
            ),
          fetchImplementation:
            options
              .fetchImplementation,
          timeoutMilliseconds:
            options
              .timeoutMilliseconds,
        },
      );

    case "flutterwave":
      return createFlutterwaveWebhookProvider(
        {
          secretKey:
            configuredSecret(
              environment
                .FLUTTERWAVE_SECRET_KEY,
              12,
            ),
          webhookSecretHash:
            configuredSecret(
              environment
                .FLUTTERWAVE_WEBHOOK_SECRET_HASH,
              16,
            ),
          fetchImplementation:
            options
              .fetchImplementation,
          timeoutMilliseconds:
            options
              .timeoutMilliseconds,
        },
      );
  }
}
