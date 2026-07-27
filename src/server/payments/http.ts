import "server-only";

import type {
  NextRequest,
} from "next/server";
import type {
  NextResponse,
} from "next/server";

import {
  OrderPaymentMethod,
  type Prisma,
} from "@/generated/prisma/client";
import {
  getAppOrigin,
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  readJsonObject,
} from "@/server/auth/http";
import {
  findStorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";
import {
  getCheckoutOrder,
} from "@/server/checkout";
import {
  cartSessionRequiredResponse,
  readCheckoutApiSession,
  requireCheckoutStorefrontCode,
} from "@/server/checkout/http";

import {
  PaymentServiceError,
} from "./errors";
import {
  assertPaymentInitiationEnabled,
  createServerPaymentAttemptIdentity,
  isPaymentInitiationProviderError,
  isPaymentInitiationUnavailableError,
  PaymentInitiationProviderError,
  type PaymentInitiationNextAction,
  type PaymentInitiationProvider,
  type PaymentInitiationProviderResult,
} from "./initiation";
import {
  getPaymentInitiationProvider,
} from "./registry";
import {
  initiateProductPayment,
} from "./service";
import type {
  ProductPaymentTransitionView,
} from "./types";

type JsonObject =
  Record<string, unknown>;

export interface PaymentInitiationRouteContext {
  params: Promise<{
    orderNumber: string;
  }>;
}

export interface PublicProductPaymentView {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  currencyCode: string;
  amount: string;
  method:
    OrderPaymentMethod |
    null;
  paymentStatus:
    ProductPaymentTransitionView[
      "paymentStatus"
    ];
  orderStatus:
    ProductPaymentTransitionView[
      "orderStatus"
    ];
  productPaymentStatus:
    ProductPaymentTransitionView[
      "productPaymentStatus"
    ];
  initiatedAt: string;
  paidAt:
    string |
    null;
  failedAt:
    string |
    null;
}

export function toPublicProductPaymentView(
  payment:
    ProductPaymentTransitionView,
): PublicProductPaymentView {
  return {
    paymentId:
      payment.paymentId,
    orderId:
      payment.orderId,
    orderNumber:
      payment.orderNumber,
    currencyCode:
      payment.currencyCode,
    amount:
      payment.amount,
    method:
      payment.method,
    paymentStatus:
      payment.paymentStatus,
    orderStatus:
      payment.orderStatus,
    productPaymentStatus:
      payment
        .productPaymentStatus,
    initiatedAt:
      payment.initiatedAt,
    paidAt:
      payment.paidAt,
    failedAt:
      payment.failedAt,
  };
}

export function paymentJsonResponse(
  payload: unknown,
  status = 200,
): NextResponse {
  return authJsonResponse(
    payload,
    status,
  );
}

function requiredPaymentString(
  body: JsonObject,
  field: string,
  label: string,
  maximumLength: number,
): string {
  const value =
    body[field];

  if (
    typeof value !==
      "string"
  ) {
    throw new PaymentServiceError(
      "VALIDATION",
      `${label} is required.`,
    );
  }

  const normalized =
    value.trim();

  if (
    normalized.length === 0 ||
    normalized.length >
      maximumLength
  ) {
    throw new PaymentServiceError(
      "VALIDATION",
      `${label} is invalid.`,
    );
  }

  return normalized;
}

export function requiredPaymentRequestToken(
  body: JsonObject,
): string {
  const token =
    requiredPaymentString(
      body,
      "requestToken",
      "Payment request token",
      128,
    );

  if (
    token.length < 16 ||
    !/^[A-Za-z0-9_-]+$/.test(
      token,
    )
  ) {
    throw new PaymentServiceError(
      "VALIDATION",
      "Payment request token must contain 16 to 128 URL-safe characters.",
    );
  }

  return token;
}

export function requiredProductPaymentMethod(
  body: JsonObject,
): OrderPaymentMethod {
  const value =
    requiredPaymentString(
      body,
      "method",
      "Payment method",
      60,
    )
      .toUpperCase();

  switch (value) {
    case "CARD":
      return OrderPaymentMethod
        .CARD;

    case "BANK_TRANSFER":
      return OrderPaymentMethod
        .BANK_TRANSFER;

    case "USSD":
      return OrderPaymentMethod
        .USSD;

    case "PAY_BY_BANK":
      return OrderPaymentMethod
        .PAY_BY_BANK;

    case "PROVIDER_WALLET":
      return OrderPaymentMethod
        .PROVIDER_WALLET;

    default:
      throw new PaymentServiceError(
        "VALIDATION",
        "The selected product-payment method is unavailable.",
      );
  }
}

const customerControlledPaymentFields = [
  "provider",
  "providerReference",
  "merchantReference",
  "idempotencyKey",
  "providerMetadata",
  "amount",
  "currencyCode",
  "orderId",
  "userId",
  "paymentStatus",
  "outcome",
  "signatureVerified",
] as const;

export function assertNoCustomerControlledPaymentFields(
  body: JsonObject,
): void {
  const submitted =
    customerControlledPaymentFields
      .filter(
        (field) =>
          Object.prototype
            .hasOwnProperty
            .call(
              body,
              field,
            ),
      );

  if (
    submitted.length > 0
  ) {
    throw new PaymentServiceError(
      "VALIDATION",
      "Provider identity, payment references, amount, currency and payment state are controlled by the server.",
      {
        rejectedFields:
          submitted,
      },
    );
  }
}

function paymentErrorStatus(
  code:
    PaymentServiceError[
      "code"
    ],
): number {
  switch (code) {
    case "VALIDATION":
      return 400;

    case "STOREFRONT_NOT_FOUND":
    case "ORDER_NOT_FOUND":
    case "PRODUCT_PAYMENT_NOT_FOUND":
      return 404;

    case "ORDER_NOT_PAYABLE":
    case "PAYMENT_ALREADY_PROCESSING":
    case "PAYMENT_IDEMPOTENCY_CONFLICT":
    case "PAYMENT_REFERENCE_CONFLICT":
    case "EVENT_PAYLOAD_CONFLICT":
    case "PAYMENT_CONFLICT":
      return 409;
  }
}

export function paymentApiErrorResponse(
  error: unknown,
): NextResponse {
  if (
    isPaymentInitiationUnavailableError(
      error,
    )
  ) {
    return paymentJsonResponse(
      {
        ok: false,
        error: {
          code:
            error.code,
          message:
            error.message,
        },
      },
      503,
    );
  }

  if (
    isPaymentInitiationProviderError(
      error,
    )
  ) {
    return paymentJsonResponse(
      {
        ok: false,
        error: {
          code:
            error.code,
          message:
            "The payment provider could not start this payment.",
          details:
            error.details,
        },
      },
      502,
    );
  }

  if (
    error instanceof
      PaymentServiceError
  ) {
    return paymentJsonResponse(
      {
        ok: false,
        error: {
          code:
            error.code,
          message:
            error.message,
          details:
            error.details,
        },
      },
      paymentErrorStatus(
        error.code,
      ),
    );
  }

  return authApiErrorResponse(
    error,
  );
}

function normalizeProviderReference(
  value: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > 191
  ) {
    throw new PaymentInitiationProviderError(
      "The payment provider returned an invalid payment reference.",
    );
  }

  return normalized;
}

function normalizeRedirectUrl(
  value: string,
): string {
  let parsed: URL;

  try {
    parsed =
      new URL(value);
  } catch {
    throw new PaymentInitiationProviderError(
      "The payment provider returned an invalid redirect URL.",
    );
  }

  const localHosts =
    new Set([
      "localhost",
      "127.0.0.1",
      "[::1]",
    ]);

  if (
    parsed.protocol !==
      "https:" &&
    !(
      parsed.protocol ===
        "http:" &&
      localHosts.has(
        parsed.hostname,
      )
    )
  ) {
    throw new PaymentInitiationProviderError(
      "The payment provider redirect must use HTTPS.",
    );
  }

  return parsed.toString();
}

function normalizeProviderNextAction(
  action:
    PaymentInitiationNextAction,
): PaymentInitiationNextAction {
  if (
    action.type ===
      "REDIRECT"
  ) {
    let expiresAt:
      string |
      null = null;

    if (
      action.expiresAt !==
        null
    ) {
      const parsedExpiry =
        new Date(
          action.expiresAt,
        );

      if (
        Number.isNaN(
          parsedExpiry.getTime(),
        )
      ) {
        throw new PaymentInitiationProviderError(
          "The payment provider returned an invalid expiry time.",
        );
      }

      expiresAt =
        parsedExpiry
          .toISOString();
    }

    return {
      type:
        "REDIRECT",
      url:
        normalizeRedirectUrl(
          action.url,
        ),
      expiresAt,
    };
  }

  const message =
    action.message.trim();

  if (
    message.length === 0 ||
    message.length > 1000
  ) {
    throw new PaymentInitiationProviderError(
      "The payment provider returned invalid pending instructions.",
    );
  }

  return {
    type:
      "PENDING",
    message,
  };
}

function normalizeProviderResult(
  result:
    PaymentInitiationProviderResult,
): PaymentInitiationProviderResult {
  return {
    providerReference:
      normalizeProviderReference(
        result
          .providerReference,
      ),
    nextAction:
      normalizeProviderNextAction(
        result.nextAction,
      ),
    ...(
      result.providerMetadata ===
        undefined
        ? {}
        : {
            providerMetadata:
              result
                .providerMetadata,
          }
    ),
  };
}

function providerSupportsMethod(
  provider:
    PaymentInitiationProvider,
  method:
    OrderPaymentMethod,
): boolean {
  return provider
    .supportedMethods
    .includes(
      method,
    );
}

function buildProviderMetadata(
  input: {
    merchantReference: string;
    requestTokenHash: string;
    result:
      PaymentInitiationProviderResult;
  },
): Prisma.InputJsonValue {
  return {
    merchantReference:
      input.merchantReference,
    requestTokenHash:
      input.requestTokenHash,
    ...(
      input.result
        .providerMetadata ===
        undefined
        ? {}
        : {
            initiation:
              input.result
                .providerMetadata,
          }
    ),
  };
}

function paymentReturnUrl(
  storefrontCode: string,
  orderNumber: string,
): string {
  const storefront =
    findStorefrontCheckoutConfig(
      storefrontCode,
    );

  if (!storefront) {
    throw new PaymentServiceError(
      "STOREFRONT_NOT_FOUND",
      "The storefront was not found.",
    );
  }

  return new URL(
    `${storefront.ordersHref}/${encodeURIComponent(
      orderNumber,
    )}`,
    getAppOrigin(),
  ).toString();
}

export async function handleProductPaymentInitiation(
  request: NextRequest,
  context:
    PaymentInitiationRouteContext,
  provider:
    PaymentInitiationProvider =
      getPaymentInitiationProvider(),
): Promise<NextResponse> {
  try {
    assertTrustedOrigin(
      request,
    );

    const body =
      await readJsonObject(
        request,
      );

    assertNoCustomerControlledPaymentFields(
      body,
    );

    const storefrontCode =
      requireCheckoutStorefrontCode(
        body.storefrontCode,
      );

    const method =
      requiredProductPaymentMethod(
        body,
      );

    const requestToken =
      requiredPaymentRequestToken(
        body,
      );

    const session =
      await readCheckoutApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const {
      orderNumber,
    } = await context.params;

    const order =
      await getCheckoutOrder({
        storefrontCode,
        userId:
          session.userId,
        orderNumber,
      });

    assertPaymentInitiationEnabled(
      provider,
    );

    if (
      !providerSupportsMethod(
        provider,
        method,
      )
    ) {
      throw new PaymentServiceError(
        "VALIDATION",
        "The selected product-payment method is unavailable.",
      );
    }

    const identity =
      createServerPaymentAttemptIdentity(
        {
          storefrontCode,
          userId:
            session.userId,
          orderId:
            order.id,
          requestToken,
        },
      );

    const rawProviderResult =
      await provider.initiate({
        storefrontCode,
        userId:
          session.userId,
        orderId:
          order.id,
        orderNumber:
          order.orderNumber,
        customer: {
          email:
            order.customerEmail,
          name:
            order.customerName,
          phone:
            order.customerPhone,
        },
        currencyCode:
          order.currencyCode,
        amount:
          order.productTotal,
        method,
        merchantReference:
          identity
            .merchantReference,
        idempotencyKey:
          identity
            .idempotencyKey,
        returnUrl:
          paymentReturnUrl(
            storefrontCode,
            order.orderNumber,
          ),
      });

    const providerResult =
      normalizeProviderResult(
        rawProviderResult,
      );

    const payment =
      await initiateProductPayment({
        storefrontCode,
        userId:
          session.userId,
        orderNumber:
          order.orderNumber,
        provider:
          provider.name,
        providerReference:
          providerResult
            .providerReference,
        idempotencyKey:
          identity
            .idempotencyKey,
        method,
        providerMetadata:
          buildProviderMetadata({
            merchantReference:
              identity
                .merchantReference,
            requestTokenHash:
              identity
                .requestTokenHash,
            result:
              providerResult,
          }),
      });

    return paymentJsonResponse(
      {
        ok: true,
        payment:
          toPublicProductPaymentView(
            payment,
          ),
        nextAction:
          providerResult
            .nextAction,
      },
      200,
    );
  } catch (error) {
    return paymentApiErrorResponse(
      error,
    );
  }
}
