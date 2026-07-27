import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
} from "../src/generated/prisma/client";
import {
  getAppOrigin,
} from "../src/server/auth/http";
import {
  createDisabledPaymentInitiationProvider,
  createServerPaymentAttemptIdentity,
  PaymentInitiationUnavailableError,
} from "../src/server/payments";
import {
  handleProductPaymentInitiation,
  paymentApiErrorResponse,
  toPublicProductPaymentView,
} from "../src/server/payments/http";
import type {
  ProductPaymentTransitionView,
} from "../src/server/payments/types";
import {
  NextRequest,
} from "next/server";
import {
  readFile,
} from "node:fs/promises";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isRecord(
  value: unknown,
): value is
  Record<string, unknown> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value,
    )
  );
}

function objectField(
  value: unknown,
  field: string,
): Record<string, unknown> {
  assertCondition(
    isRecord(value),
    "Expected a JSON object.",
  );

  const discovered =
    value[field];

  assertCondition(
    isRecord(
      discovered,
    ),
    `Expected ${field} to be an object.`,
  );

  return discovered;
}

function stringField(
  value:
    Record<string, unknown>,
  field: string,
): string {
  const discovered =
    value[field];

  assertCondition(
    typeof discovered ===
      "string",
    `Expected ${field} to be a string.`,
  );

  return discovered;
}

function createRequest(
  input: {
    origin: string;
    fetchSite: string;
    body:
      Record<string, unknown>;
  },
): NextRequest {
  return new NextRequest(
    `${getAppOrigin()}/api/orders/ATI-AUDIT/payment/initiate`,
    {
      method: "POST",
      headers: {
        Accept:
          "application/json",
        "Content-Type":
          "application/json",
        Origin:
          input.origin,
        "Sec-Fetch-Site":
          input.fetchSite,
      },
      body:
        JSON.stringify(
          input.body,
        ),
    },
  );
}

async function responseBody(
  response: Response,
): Promise<unknown> {
  const text =
    await response.text();

  return text
    ? JSON.parse(
        text,
      )
    : null;
}

async function main(): Promise<void> {
  console.log(
    "=== AUTHENTICATED PRODUCT PAYMENT INITIATION API AUDIT ===",
  );

  const firstIdentity =
    createServerPaymentAttemptIdentity(
      {
        storefrontCode:
          "ATI",
        userId:
          "user-audit",
        orderId:
          "order-audit",
        requestToken:
          "payment_request_token_0001",
      },
    );

  const repeatedIdentity =
    createServerPaymentAttemptIdentity(
      {
        storefrontCode:
          "ATI",
        userId:
          "user-audit",
        orderId:
          "order-audit",
        requestToken:
          "payment_request_token_0001",
      },
    );

  const differentIdentity =
    createServerPaymentAttemptIdentity(
      {
        storefrontCode:
          "ATI",
        userId:
          "user-audit",
        orderId:
          "order-audit",
        requestToken:
          "payment_request_token_0002",
      },
    );

  assertCondition(
    firstIdentity
      .merchantReference ===
      repeatedIdentity
        .merchantReference &&
      firstIdentity
        .idempotencyKey ===
        repeatedIdentity
          .idempotencyKey &&
      firstIdentity
        .requestTokenHash ===
        repeatedIdentity
          .requestTokenHash,
    "The same payment request token did not produce stable server references.",
  );

  assertCondition(
    firstIdentity
      .idempotencyKey !==
      differentIdentity
        .idempotencyKey &&
      firstIdentity
        .merchantReference !==
        differentIdentity
          .merchantReference,
    "Different payment request tokens produced the same server references.",
  );

  assertCondition(
    firstIdentity
      .merchantReference
      .startsWith(
        "svy-ati-",
      ) &&
      firstIdentity
        .idempotencyKey
        .startsWith(
          "pay:ati:",
        ),
    "Server payment references do not use the expected namespace.",
  );

  console.log(
    "PASS: Server-controlled payment references are deterministic per request token.",
  );

  const disabledProvider =
    createDisabledPaymentInitiationProvider();

  assertCondition(
    !disabledProvider.enabled &&
      disabledProvider.name ===
        "disabled" &&
      disabledProvider
        .supportedMethods
        .length === 0,
    "The default payment provider is not safely disabled.",
  );

  let unavailableRejected =
    false;

  try {
    await disabledProvider
      .initiate({
        storefrontCode:
          "ATI",
        userId:
          "user-audit",
        orderId:
          "order-audit",
        orderNumber:
          "ATI-AUDIT",
        customer: {
          email:
            "audit@example.test",
          name:
            "Audit Customer",
          phone:
            "+2348000000000",
        },
        currencyCode:
          "NGN",
        amount:
          "15000.00",
        method:
          OrderPaymentMethod
            .CARD,
        merchantReference:
          firstIdentity
            .merchantReference,
        idempotencyKey:
          firstIdentity
            .idempotencyKey,
        returnUrl:
          `${getAppOrigin()}/ng/atiloszy/account/orders/ATI-AUDIT`,
      });
  } catch (error) {
    unavailableRejected =
      error instanceof
        PaymentInitiationUnavailableError;
  }

  assertCondition(
    unavailableRejected,
    "The disabled payment provider unexpectedly initiated a payment.",
  );

  const unavailableResponse =
    paymentApiErrorResponse(
      new PaymentInitiationUnavailableError(),
    );

  const unavailableBody =
    await responseBody(
      unavailableResponse,
    );

  assertCondition(
    unavailableResponse.status ===
      503,
    "Unavailable payment initiation did not return 503.",
  );

  assertCondition(
    stringField(
      objectField(
        unavailableBody,
        "error",
      ),
      "code",
    ) ===
      "PAYMENT_INITIATION_UNAVAILABLE",
    "Unavailable payment initiation returned the wrong error code.",
  );

  console.log(
    "PASS: Payment initiation remains disabled until a verified provider is connected.",
  );

  const context = {
    params:
      Promise.resolve({
        orderNumber:
          "ATI-AUDIT",
      }),
  };

  const crossSiteResponse =
    await handleProductPaymentInitiation(
      createRequest({
        origin:
          "https://untrusted.example.invalid",
        fetchSite:
          "cross-site",
        body: {
          storefrontCode:
            "ATI",
          method:
            "CARD",
          requestToken:
            "payment_request_token_0003",
        },
      }),
      context,
      disabledProvider,
    );

  const crossSiteBody =
    await responseBody(
      crossSiteResponse,
    );

  assertCondition(
    crossSiteResponse.status ===
      403 &&
      stringField(
        objectField(
          crossSiteBody,
          "error",
        ),
        "code",
      ) ===
        "FORBIDDEN_ORIGIN",
    "Cross-site payment initiation was not rejected.",
  );

  console.log(
    "PASS: Payment initiation rejects untrusted origins.",
  );

  const forbiddenFieldResponse =
    await handleProductPaymentInitiation(
      createRequest({
        origin:
          getAppOrigin(),
        fetchSite:
          "same-origin",
        body: {
          storefrontCode:
            "ATI",
          method:
            "CARD",
          requestToken:
            "payment_request_token_0004",
          provider:
            "customer-selected",
          providerReference:
            "customer-reference",
          idempotencyKey:
            "customer-key",
          amount:
            "1.00",
          currencyCode:
            "USD",
        },
      }),
      context,
      disabledProvider,
    );

  const forbiddenBody =
    await responseBody(
      forbiddenFieldResponse,
    );

  assertCondition(
    forbiddenFieldResponse
      .status ===
      400 &&
      stringField(
        objectField(
          forbiddenBody,
          "error",
        ),
        "code",
      ) ===
        "VALIDATION",
    "Customer-controlled payment fields were accepted.",
  );

  console.log(
    "PASS: Customers cannot submit provider identity, payment references, amount or currency.",
  );

  const unauthenticatedResponse =
    await handleProductPaymentInitiation(
      createRequest({
        origin:
          getAppOrigin(),
        fetchSite:
          "same-origin",
        body: {
          storefrontCode:
            "ATI",
          method:
            "CARD",
          requestToken:
            "payment_request_token_0005",
        },
      }),
      context,
      disabledProvider,
    );

  const unauthenticatedBody =
    await responseBody(
      unauthenticatedResponse,
    );

  assertCondition(
    unauthenticatedResponse
      .status ===
      401 &&
      stringField(
        objectField(
          unauthenticatedBody,
          "error",
        ),
        "code",
      ) ===
        "SESSION_INVALID",
    "Unauthenticated payment initiation did not return 401.",
  );

  console.log(
    "PASS: Product payment initiation requires an authenticated storefront session.",
  );

  const privatePayment:
    ProductPaymentTransitionView = {
      paymentId:
        "payment-audit",
      orderId:
        "order-audit",
      orderNumber:
        "ATI-AUDIT",
      storefrontId:
        "storefront-audit",
      currencyCode:
        "NGN",
      amount:
        "15000.00",
      method:
        OrderPaymentMethod
          .CARD,
      paymentStatus:
        OrderPaymentStatus
          .PROCESSING,
      provider:
        "private-provider",
      providerReference:
        "private-provider-reference",
      idempotencyKey:
        "private-idempotency-key",
      orderStatus:
        OrderStatus
          .PAYMENT_PROCESSING,
      productPaymentStatus:
        OrderPaymentStatus
          .PROCESSING,
      initiatedAt:
        new Date()
          .toISOString(),
      paidAt:
        null,
      failedAt:
        null,
    };

  const publicPayment =
    toPublicProductPaymentView(
      privatePayment,
    ) as unknown as Record<
      string,
      unknown
    >;

  for (
    const forbidden of [
      "storefrontId",
      "provider",
      "providerReference",
      "idempotencyKey",
    ]
  ) {
    assertCondition(
      !Object.prototype
        .hasOwnProperty
        .call(
          publicPayment,
          forbidden,
        ),
      `Public payment response leaked ${forbidden}.`,
    );
  }

  assertCondition(
    publicPayment
      .paymentStatus ===
      OrderPaymentStatus
        .PROCESSING &&
      publicPayment
        .orderStatus ===
        OrderStatus
          .PAYMENT_PROCESSING,
    "Public payment response does not expose safe transition state.",
  );

  console.log(
    "PASS: Public payment responses expose state without leaking provider references or idempotency keys.",
  );

  const routeSource =
    await readFile(
      "src/app/api/orders/[orderNumber]/payment/initiate/route.ts",
      "utf8",
    );

  const handlerSource =
    await readFile(
      "src/server/payments/http.ts",
      "utf8",
    );

  const initiationSource =
    await readFile(
      "src/server/payments/initiation.ts",
      "utf8",
    );

  const registrySource =
    await readFile(
      "src/server/payments/registry.ts",
      "utf8",
    );

  for (
    const required of [
      "handleProductPaymentInitiation",
      'export const runtime =',
      '"nodejs"',
      'export const dynamic =',
      '"force-dynamic"',
    ]
  ) {
    assertCondition(
      routeSource.includes(
        required,
      ),
      `Payment initiation route is missing: ${required}`,
    );
  }

  for (
    const required of [
      "assertTrustedOrigin",
      "readJsonObject",
      "assertNoCustomerControlledPaymentFields",
      "readCheckoutApiSession",
      "getCheckoutOrder",
      "createServerPaymentAttemptIdentity",
      "provider.initiate",
      "initiateProductPayment",
      "toPublicProductPaymentView",
    ]
  ) {
    assertCondition(
      handlerSource.includes(
        required,
      ),
      `Payment initiation handler is missing: ${required}`,
    );
  }

  for (
    const forbidden of [
      "body.provider,",
      "body.providerReference",
      "body.idempotencyKey",
      "body.amount",
      "body.currencyCode",
    ]
  ) {
    assertCondition(
      !handlerSource.includes(
        forbidden,
      ),
      `Payment handler trusts a customer-controlled field: ${forbidden}`,
    );
  }

  assertCondition(
    registrySource.includes(
      'PAYMENT_INITIATION_PROVIDER',
    ) &&
      registrySource.includes(
        '"disabled"',
      ) &&
      registrySource.includes(
        '"paystack"',
      ) &&
      registrySource.includes(
        '"flutterwave"',
      ) &&
      !initiationSource.includes(
        "Stripe",
      ) &&
      !initiationSource.includes(
        "PayPal",
      ),
    "Payment provider selection is not provider-neutral and disabled by default.",
  );

  console.log(
    "PASS: Payment initiation route follows authenticated checkout API conventions.",
  );

  console.log(
    "PASS: Authenticated product payment initiation API audit completed.",
  );
}

main().catch(
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
