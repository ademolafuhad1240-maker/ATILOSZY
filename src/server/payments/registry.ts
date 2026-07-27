import "server-only";

import {
  createDisabledPaymentInitiationProvider,
  PaymentInitiationConfigurationError,
  type PaymentInitiationProvider,
} from "./initiation";
import {
  createFlutterwavePaymentInitiationProvider,
} from "./providers/flutterwave";
import type {
  PaymentProviderFetch,
} from "./providers/http";
import {
  createPaystackPaymentInitiationProvider,
} from "./providers/paystack";

export type PaymentInitiationProviderName =
  | "disabled"
  | "paystack"
  | "flutterwave";

export interface PaymentProviderEnvironment {
  [name: string]:
    string |
    undefined;
  PAYMENT_INITIATION_PROVIDER?:
    string;
  PAYSTACK_PUBLIC_KEY?:
    string;
  PAYSTACK_SECRET_KEY?:
    string;
  FLUTTERWAVE_PUBLIC_KEY?:
    string;
  FLUTTERWAVE_SECRET_KEY?:
    string;
  FLUTTERWAVE_ENCRYPTION_KEY?:
    string;
}

export interface ResolvePaymentProviderOptions {
  environment?:
    PaymentProviderEnvironment;
  fetchImplementation?:
    PaymentProviderFetch;
  timeoutMilliseconds?:
    number;
}

function configuredSecret(
  value:
    string |
    undefined,
): string {
  const normalized =
    value?.trim() ?? "";

  if (
    normalized.length < 12 ||
    /\s/.test(
      normalized,
    )
  ) {
    throw new PaymentInitiationConfigurationError();
  }

  return normalized;
}

export function configuredPaymentInitiationProviderName(
  environment:
    PaymentProviderEnvironment =
      process.env,
): PaymentInitiationProviderName {
  const configuredProvider = (
    environment
      .PAYMENT_INITIATION_PROVIDER ??
    "disabled"
  )
    .trim()
    .toLowerCase();

  if (
    configuredProvider === "" ||
    configuredProvider ===
      "disabled"
  ) {
    return "disabled";
  }

  if (
    configuredProvider ===
      "paystack" ||
    configuredProvider ===
      "flutterwave"
  ) {
    return configuredProvider;
  }

  throw new PaymentInitiationConfigurationError();
}

export function resolvePaymentInitiationProvider(
  options:
    ResolvePaymentProviderOptions = {},
): PaymentInitiationProvider {
  const environment =
    options.environment ??
    process.env;

  const providerName =
    configuredPaymentInitiationProviderName(
      environment,
    );

  switch (
    providerName
  ) {
    case "disabled":
      return createDisabledPaymentInitiationProvider();

    case "paystack":
      return createPaystackPaymentInitiationProvider(
        {
          secretKey:
            configuredSecret(
              environment
                .PAYSTACK_SECRET_KEY,
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
      return createFlutterwavePaymentInitiationProvider(
        {
          secretKey:
            configuredSecret(
              environment
                .FLUTTERWAVE_SECRET_KEY,
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

export function getPaymentInitiationProvider(): PaymentInitiationProvider {
  return resolvePaymentInitiationProvider();
}
