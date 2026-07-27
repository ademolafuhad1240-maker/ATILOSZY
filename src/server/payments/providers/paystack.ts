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
  amountToMinorUnits,
} from "./money";

const paystackInitializationUrl =
  "https://api.paystack.co/transaction/initialize";

const supportedMethods = [
  OrderPaymentMethod.CARD,
  OrderPaymentMethod
    .BANK_TRANSFER,
  OrderPaymentMethod.USSD,
  OrderPaymentMethod
    .PAY_BY_BANK,
] as const;

const channelByMethod:
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
      "bank_transfer",
    [OrderPaymentMethod.USSD]:
      "ussd",
    [OrderPaymentMethod
      .PAY_BY_BANK]:
      "bank",
  };

export interface PaystackPaymentProviderOptions {
  secretKey: string;
  fetchImplementation?:
    PaymentProviderFetch;
  timeoutMilliseconds?:
    number;
}

function paystackProviderError(
  reason: string,
): PaymentInitiationProviderError {
  return new PaymentInitiationProviderError(
    "Paystack could not initialize this payment.",
    {
      provider:
        "paystack",
      reason,
    },
  );
}

function requirePaystackEmail(
  value: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length ===
      0 ||
    normalized.length >
      320 ||
    !normalized.includes(
      "@",
    )
  ) {
    throw paystackProviderError(
      "INVALID_CUSTOMER",
    );
  }

  return normalized;
}

function requirePaystackReference(
  value: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length ===
      0 ||
    normalized.length >
      100 ||
    !/^[A-Za-z0-9.=-]+$/
      .test(
        normalized,
      )
  ) {
    throw paystackProviderError(
      "INVALID_REFERENCE",
    );
  }

  return normalized;
}

function paystackChannel(
  method:
    OrderPaymentMethod,
): string {
  const channel =
    channelByMethod[
      method
    ];

  if (!channel) {
    throw paystackProviderError(
      "UNSUPPORTED_METHOD",
    );
  }

  return channel;
}

function buildPaystackBody(
  request:
    PaymentInitiationRequest,
): Record<string, unknown> {
  const currencyCode =
    request.currencyCode
      .trim()
      .toUpperCase();

  if (
    currencyCode !== "NGN"
  ) {
    throw paystackProviderError(
      "UNSUPPORTED_CURRENCY",
    );
  }

  const reference =
    requirePaystackReference(
      request
        .merchantReference,
    );

  return {
    email:
      requirePaystackEmail(
        request
          .customer.email,
      ),
    amount:
      amountToMinorUnits(
        request.amount,
        currencyCode,
      ),
    currency:
      currencyCode,
    reference,
    callback_url:
      requireProviderReturnUrl(
        request.returnUrl,
      ),
    channels: [
      paystackChannel(
        request.method,
      ),
    ],
    metadata:
      JSON.stringify({
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
      }),
  };
}

function normalizePaystackResult(
  response: unknown,
  expectedReference: string,
) {
  if (
    !isJsonObject(
      response,
    ) ||
    response.status !== true ||
    !isJsonObject(
      response.data,
    )
  ) {
    throw paystackProviderError(
      "MALFORMED_RESPONSE",
    );
  }

  const authorizationUrl =
    requiredResponseString(
      response.data[
        "authorization_url"
      ],
      2048,
    );

  const providerReference =
    requiredResponseString(
      response.data.reference,
      191,
    );

  if (
    !authorizationUrl ||
    !providerReference
  ) {
    throw paystackProviderError(
      "MALFORMED_RESPONSE",
    );
  }

  if (
    providerReference !==
    expectedReference
  ) {
    throw paystackProviderError(
      "REFERENCE_MISMATCH",
    );
  }

  return {
    providerReference,
    nextAction: {
      type:
        "REDIRECT" as const,
      url:
        authorizationUrl,
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

export function createPaystackPaymentInitiationProvider(
  options:
    PaystackPaymentProviderOptions,
): PaymentInitiationProvider {
  const secretKey =
    requireProviderSecret(
      options.secretKey,
    );

  return {
    name: "paystack",
    enabled: true,
    supportedMethods,

    async initiate(
      request:
        PaymentInitiationRequest,
    ) {
      const body =
        buildPaystackBody(
          request,
        );

      const response =
        await postProviderJson({
          provider:
            "paystack",
          url:
            paystackInitializationUrl,
          secretKey,
          body,
          fetchImplementation:
            options
              .fetchImplementation,
          timeoutMilliseconds:
            options
              .timeoutMilliseconds,
        });

      return normalizePaystackResult(
        response,
        request
          .merchantReference,
      );
    },
  };
}
