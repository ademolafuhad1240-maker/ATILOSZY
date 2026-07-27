import "server-only";

import {
  PaymentVerificationError,
} from "./errors";
import {
  createFlutterwavePaymentVerificationProvider,
} from "./flutterwave";
import {
  createPaystackPaymentVerificationProvider,
} from "./paystack";
import type {
  PaymentVerificationFetch,
} from "./transport";
import type {
  PaymentVerificationProvider,
} from "./types";

export interface PaymentVerificationEnvironment {
  [name: string]:
    string | undefined;
  PAYSTACK_SECRET_KEY?: string;
  FLUTTERWAVE_SECRET_KEY?: string;
}

export interface ResolvePaymentVerificationOptions {
  environment?:
    PaymentVerificationEnvironment;
  fetchImplementation?:
    PaymentVerificationFetch;
  timeoutMilliseconds?:
    number;
}

function configuredSecret(
  value: string | undefined,
): string {
  const normalized =
    value?.trim() ?? "";

  if (
    normalized.length < 12 ||
    /\s/.test(normalized)
  ) {
    throw new PaymentVerificationError(
      "PAYMENT_VERIFICATION_CONFIGURATION_ERROR",
      "Payment verification is not configured correctly.",
    );
  }

  return normalized;
}

export function resolvePaymentVerificationProvider(
  providerName: string,
  options:
    ResolvePaymentVerificationOptions = {},
): PaymentVerificationProvider {
  const environment =
    options.environment ??
    process.env;

  switch (
    providerName
      .trim()
      .toLowerCase()
  ) {
    case "paystack":
      return createPaystackPaymentVerificationProvider({
        secretKey:
          configuredSecret(
            environment
              .PAYSTACK_SECRET_KEY,
          ),
        fetchImplementation:
          options.fetchImplementation,
        timeoutMilliseconds:
          options
            .timeoutMilliseconds,
      });

    case "flutterwave":
      return createFlutterwavePaymentVerificationProvider({
        secretKey:
          configuredSecret(
            environment
              .FLUTTERWAVE_SECRET_KEY,
          ),
        fetchImplementation:
          options.fetchImplementation,
        timeoutMilliseconds:
          options
            .timeoutMilliseconds,
      });

    default:
      throw new PaymentVerificationError(
        "PAYMENT_VERIFICATION_CONFIGURATION_ERROR",
        "The stored payment provider is not supported for verification.",
      );
  }
}
