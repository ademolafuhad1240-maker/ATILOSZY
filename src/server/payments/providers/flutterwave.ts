import "server-only";

import {
  OrderPaymentMethod,
} from "@/generated/prisma/client";

import {
  PaymentInitiationProviderError,
  type PaymentInitiationProvider,
  type PaymentInitiationRequest,
} from "../initiation";
import {
  isJsonObject,
  postProviderJson,
  requireProviderReturnUrl,
  requireProviderSecret,
  requiredResponseString,
  type PaymentProviderFetch,
} from "./http";
import {
  normalizeProviderMajorAmount,
} from "./money";

const flutterwaveInitializationUrl =
  "https://api.flutterwave.com/v3/payments";

const supportedMethods = [
  OrderPaymentMethod.CARD,
  OrderPaymentMethod
    .BANK_TRANSFER,
  OrderPaymentMethod.USSD,
  OrderPaymentMethod
    .PAY_BY_BANK,
] as const;

const ngnPaymentOptionByMethod:
  Readonly<
    Partial<
      Record<
        OrderPaymentMethod,
        string
      >
    >
  > = {
    [OrderPaymentMethod.CARD]:
      "card",
    [OrderPaymentMethod
      .BANK_TRANSFER]:
      "banktransfer",
    [OrderPaymentMethod.USSD]:
      "ussd",
    [OrderPaymentMethod
      .PAY_BY_BANK]:
      "account",
  };

export interface FlutterwavePaymentProviderOptions {
  secretKey: string;
  fetchImplementation?:
    PaymentProviderFetch;
  timeoutMilliseconds?:
    number;
}

function flutterwaveProviderError(
  reason: string,
): PaymentInitiationProviderError {
  return new PaymentInitiationProviderError(
    "Flutterwave could not initialize this payment.",
    {
      provider:
        "flutterwave",
      reason,
    },
  );
}

function requireFlutterwaveText(
  value: string,
  maximumLength: number,
  reason: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length ===
      0 ||
    normalized.length >
      maximumLength
  ) {
    throw flutterwaveProviderError(
      reason,
    );
  }

  return normalized;
}

function flutterwavePaymentOption(
  currencyCode: string,
  method:
    OrderPaymentMethod,
): string {
  if (
    currencyCode === "QAR"
  ) {
    if (
      method ===
      OrderPaymentMethod
        .CARD
    ) {
      return "card";
    }

    throw flutterwaveProviderError(
      "UNSUPPORTED_METHOD_FOR_CURRENCY",
    );
  }

  if (
    currencyCode !== "NGN"
  ) {
    throw flutterwaveProviderError(
      "UNSUPPORTED_CURRENCY",
    );
  }

  const option =
    ngnPaymentOptionByMethod[
      method
    ];

  if (!option) {
    throw flutterwaveProviderError(
      "UNSUPPORTED_METHOD",
    );
  }

  return option;
}

function buildFlutterwaveBody(
  request:
    PaymentInitiationRequest,
): Record<string, unknown> {
  const currencyCode =
    request.currencyCode
      .trim()
      .toUpperCase();

  if (
    currencyCode !== "NGN" &&
    currencyCode !== "QAR"
  ) {
    throw flutterwaveProviderError(
      "UNSUPPORTED_CURRENCY",
    );
  }

  const customerEmail =
    requireFlutterwaveText(
      request.customer.email,
      320,
      "INVALID_CUSTOMER",
    );

  if (
    !customerEmail.includes(
      "@",
    )
  ) {
    throw flutterwaveProviderError(
      "INVALID_CUSTOMER",
    );
  }

  const customerName =
    requireFlutterwaveText(
      request.customer.name,
      200,
      "INVALID_CUSTOMER",
    );

  const transactionReference =
    requireFlutterwaveText(
      request
        .merchantReference,
      191,
      "INVALID_REFERENCE",
    );

  const customerPhone =
    request.customer.phone
      ?.trim() ?? "";

  return {
    tx_ref:
      transactionReference,
    amount:
      normalizeProviderMajorAmount(
        request.amount,
        currencyCode,
      ),
    currency:
      currencyCode,
    redirect_url:
      requireProviderReturnUrl(
        request.returnUrl,
      ),
    customer: {
      email:
        customerEmail,
      name:
        customerName,
      ...(
        customerPhone.length ===
          0
          ? {}
          : {
              phonenumber:
                customerPhone,
            }
      ),
    },
    payment_options:
      flutterwavePaymentOption(
        currencyCode,
        request.method,
      ),
    customizations: {
      title:
        "SORVYRA STORE",
      description:
        `Payment for order ${request.orderNumber}`,
    },
    meta: {
      storefront_code:
        request.storefrontCode,
      order_id:
        request.orderId,
      order_number:
        request.orderNumber,
      user_id:
        request.userId,
      payment_method:
        request.method,
    },
  };
}

function normalizeFlutterwaveResult(
  response: unknown,
  providerReference: string,
) {
  if (
    !isJsonObject(
      response,
    ) ||
    response.status !==
      "success" ||
    !isJsonObject(
      response.data,
    )
  ) {
    throw flutterwaveProviderError(
      "MALFORMED_RESPONSE",
    );
  }

  const hostedCheckoutUrl =
    requiredResponseString(
      response.data.link,
      2048,
    );

  if (!hostedCheckoutUrl) {
    throw flutterwaveProviderError(
      "MALFORMED_RESPONSE",
    );
  }

  return {
    providerReference,
    nextAction: {
      type:
        "REDIRECT" as const,
      url:
        hostedCheckoutUrl,
      expiresAt:
        null,
    },
    providerMetadata: {
      checkoutKind:
        "HOSTED",
      referenceSource:
        "SERVER_GENERATED",
    },
  };
}

export function createFlutterwavePaymentInitiationProvider(
  options:
    FlutterwavePaymentProviderOptions,
): PaymentInitiationProvider {
  const secretKey =
    requireProviderSecret(
      options.secretKey,
    );

  return {
    name: "flutterwave",
    enabled: true,
    supportedMethods,

    async initiate(
      request:
        PaymentInitiationRequest,
    ) {
      const body =
        buildFlutterwaveBody(
          request,
        );

      const response =
        await postProviderJson({
          provider:
            "flutterwave",
          url:
            flutterwaveInitializationUrl,
          secretKey,
          body,
          fetchImplementation:
            options
              .fetchImplementation,
          timeoutMilliseconds:
            options
              .timeoutMilliseconds,
        });

      return normalizeFlutterwaveResult(
        response,
        request
          .merchantReference,
      );
    },
  };
}
