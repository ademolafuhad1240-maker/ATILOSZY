import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath,
} from "node:url";

import {
  OrderPaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  PaymentProviderEventStatus,
} from "../src/generated/prisma/client";
import {
  createFlutterwavePaymentVerificationProvider,
  createPaystackPaymentVerificationProvider,
  PaymentVerificationError,
  resolvePaymentVerificationProvider,
  type PaymentVerificationProvider,
  type PaymentVerificationResult,
} from "../src/server/payments/verification";
import {
  reconcileProductPayment,
} from "../src/server/payments/reconciliation/orchestrator";
import {
  PaymentReconciliationError,
} from "../src/server/payments/reconciliation/errors";
import type {
  PaymentReconciliationStore,
} from "../src/server/payments/reconciliation/types";
import type {
  CompleteProductPaymentReconciliationAttemptInput,
  ProcessProductPaymentEventInput,
  ProductPaymentEventResult,
  ProductPaymentReconciliationStart,
  ProductPaymentTransitionView,
} from "../src/server/payments/types";

const currentDirectory =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const repositoryRoot =
  path.resolve(
    currentDirectory,
    "..",
  );

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    },
  );
}

function paystackResponse(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    status: true,
    data: {
      id: 8012345,
      reference:
        "svy-ati-reconciliation",
      amount: 125050,
      currency: "NGN",
      status: "success",
      channel: "card",
      customer: {
        email:
          "must-not-be-persisted@example.com",
      },
      authorization: {
        last4: "1111",
      },
      ...overrides,
    },
  };
}

function flutterwaveResponse(
  overrides:
    Record<string, unknown> = {},
) {
  return {
    status: "success",
    data: {
      id: 9012345,
      tx_ref:
        "svy-zch-reconciliation",
      amount: 875.5,
      currency: "QAR",
      status: "successful",
      payment_type: "card",
      customer: {
        email:
          "must-not-be-persisted@example.com",
      },
      card: {
        last_4digits:
          "1111",
      },
      ...overrides,
    },
  };
}

const processingPayment:
  ProductPaymentTransitionView = {
    paymentId:
      "payment-reconciliation-audit",
    orderId:
      "order-reconciliation-audit",
    orderNumber:
      "SVY-AUDIT-RECONCILIATION",
    storefrontId:
      "storefront-reconciliation-audit",
    currencyCode: "NGN",
    amount: "1250.50",
    method:
      OrderPaymentMethod.CARD,
    paymentStatus:
      OrderPaymentStatus.PROCESSING,
    provider: "paystack",
    providerReference:
      "svy-ati-reconciliation",
    idempotencyKey:
      "payment-reconciliation-idempotency-audit",
    orderStatus:
      OrderStatus
        .PAYMENT_PROCESSING,
    productPaymentStatus:
      OrderPaymentStatus.PROCESSING,
    initiatedAt:
      "2026-07-27T12:00:00.000Z",
    paidAt: null,
    failedAt: null,
  };

const paidPayment:
  ProductPaymentTransitionView = {
    ...processingPayment,
    paymentStatus:
      OrderPaymentStatus.PAID,
    orderStatus:
      OrderStatus.PAID,
    productPaymentStatus:
      OrderPaymentStatus.PAID,
    paidAt:
      "2026-07-27T12:01:00.000Z",
  };

interface MemoryStoreView {
  store:
    PaymentReconciliationStore;
  completions:
    CompleteProductPaymentReconciliationAttemptInput[];
  processedEvents:
    ProcessProductPaymentEventInput[];
}

function memoryStore(
  start:
    ProductPaymentReconciliationStart,
  eventPayment:
    ProductPaymentTransitionView =
      paidPayment,
): MemoryStoreView {
  const completions:
    CompleteProductPaymentReconciliationAttemptInput[] = [];

  const processedEvents:
    ProcessProductPaymentEventInput[] = [];

  return {
    completions,
    processedEvents,
    store: {
      async begin() {
        return start;
      },

      async complete(input) {
        completions.push(input);
      },

      async processEvent(input) {
        processedEvents.push(
          input,
        );

        const result:
          ProductPaymentEventResult = {
            eventId:
              "event-reconciliation-audit",
            eventStatus:
              PaymentProviderEventStatus
                .PROCESSED,
            disposition:
              input.outcome ===
                "SUCCEEDED"
                ? "PAID"
                : "FAILED",
            duplicate: false,
            failureCode: null,
            failureMessage: null,
            payment:
              input.outcome ===
                "SUCCEEDED"
                ? eventPayment
                : {
                    ...processingPayment,
                    paymentStatus:
                      OrderPaymentStatus
                        .FAILED,
                    orderStatus:
                      OrderStatus
                        .PENDING_PAYMENT,
                    productPaymentStatus:
                      OrderPaymentStatus
                        .FAILED,
                    failedAt:
                      "2026-07-27T12:01:00.000Z",
                  },
          };

        return result;
      },
    },
  };
}

function attempt(
  overrides:
    Partial<
      Extract<
        ProductPaymentReconciliationStart,
        {
          kind: "ATTEMPT";
        }
      >
    > = {},
): Extract<
  ProductPaymentReconciliationStart,
  {
    kind: "ATTEMPT";
  }
> {
  return {
    kind: "ATTEMPT",
    attemptEventId:
      "attempt-reconciliation-audit",
    provider: "paystack",
    providerReference:
      "svy-ati-reconciliation",
    amount: "1250.50",
    currencyCode: "NGN",
    method:
      OrderPaymentMethod.CARD,
    checkedAt:
      "2026-07-27T12:00:30.000Z",
    retryAfterSeconds: 60,
    payment:
      processingPayment,
    ...overrides,
  };
}

function verificationProvider(
  result:
    PaymentVerificationResult,
): PaymentVerificationProvider {
  return {
    name:
      result.provider,
    async verify() {
      return result;
    },
  };
}

async function expectFailure(
  operation:
    () => Promise<unknown>,
  assertion:
    (error: unknown) => void,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assertion(error);
    return;
  }

  assert.fail(
    "Expected the operation to fail.",
  );
}

async function main(): Promise<void> {
  console.log(
    "=== PAYMENT RECONCILIATION AUDIT ===",
  );

  assert.throws(
    () =>
      resolvePaymentVerificationProvider(
        "paystack",
        {
          environment: {},
        },
      ),
    PaymentVerificationError,
  );

  assert.throws(
    () =>
      resolvePaymentVerificationProvider(
        "customer-selected-provider",
        {
          environment: {
            PAYSTACK_SECRET_KEY:
              "test-only-paystack-secret",
          },
        },
      ),
    PaymentVerificationError,
  );

  console.log(
    "PASS: Stored-provider resolution rejects unknown providers and missing credentials.",
  );

  const paystackRequests:
    Array<{
      url: string;
      authorization: string | null;
    }> = [];

  const paystackSecret =
    "paystack-test-only-reconciliation-secret";

  const paystack =
    createPaystackPaymentVerificationProvider({
      secretKey:
        paystackSecret,
      fetchImplementation:
        async (
          input,
          init,
        ) => {
          paystackRequests.push({
            url:
              String(input),
            authorization:
              new Headers(
                init?.headers,
              ).get(
                "authorization",
              ),
          });

          return jsonResponse(
            paystackResponse(),
          );
        },
    });

  const paystackVerified =
    await paystack.verify({
      providerReference:
        "svy-ati-reconciliation",
    });

  assert.equal(
    paystackRequests[0]?.url,
    "https://api.paystack.co/transaction/verify/svy-ati-reconciliation",
  );

  assert.equal(
    paystackRequests[0]
      ?.authorization,
    `Bearer ${paystackSecret}`,
  );

  assert.deepEqual(
    {
      amount:
        paystackVerified.amount,
      currency:
        paystackVerified
          .currencyCode,
      outcome:
        paystackVerified.outcome,
      method:
        paystackVerified.method,
    },
    {
      amount: "1250.50",
      currency: "NGN",
      outcome: "SUCCEEDED",
      method:
        OrderPaymentMethod.CARD,
    },
  );

  assert.equal(
    JSON.stringify(
      paystackVerified.payload,
    ).includes(
      "must-not-be-persisted",
    ),
    false,
  );

  const pendingPaystack =
    createPaystackPaymentVerificationProvider({
      secretKey:
        paystackSecret,
      fetchImplementation:
        async () =>
          jsonResponse(
            paystackResponse({
              status: "pending",
            }),
          ),
    });

  assert.equal(
    (
      await pendingPaystack
        .verify({
          providerReference:
            "svy-ati-reconciliation",
        })
    ).outcome,
    "PENDING",
  );

  const failedPaystack =
    createPaystackPaymentVerificationProvider({
      secretKey:
        paystackSecret,
      fetchImplementation:
        async () =>
          jsonResponse(
            paystackResponse({
              status: "failed",
            }),
          ),
    });

  assert.equal(
    (
      await failedPaystack
        .verify({
          providerReference:
            "svy-ati-reconciliation",
        })
    ).outcome,
    "FAILED",
  );

  console.log(
    "PASS: Paystack reconciliation uses server references, exact minor units, safe payloads and normalized states.",
  );

  let flutterwaveUrl =
    "";

  const flutterwaveSecret =
    "flutterwave-test-only-reconciliation-secret";

  const flutterwave =
    createFlutterwavePaymentVerificationProvider({
      secretKey:
        flutterwaveSecret,
      fetchImplementation:
        async (input) => {
          flutterwaveUrl =
            String(input);

          return jsonResponse(
            flutterwaveResponse(),
          );
        },
    });

  const flutterwaveVerified =
    await flutterwave.verify({
      providerReference:
        "svy-zch-reconciliation",
    });

  assert.equal(
    flutterwaveUrl,
    "https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=svy-zch-reconciliation",
  );

  assert.deepEqual(
    {
      amount:
        flutterwaveVerified
          .amount,
      currency:
        flutterwaveVerified
          .currencyCode,
      outcome:
        flutterwaveVerified
          .outcome,
      method:
        flutterwaveVerified
          .method,
    },
    {
      amount: "875.50",
      currency: "QAR",
      outcome: "SUCCEEDED",
      method:
        OrderPaymentMethod.CARD,
    },
  );

  assert.equal(
    JSON.stringify(
      flutterwaveVerified.payload,
    ).includes(
      "must-not-be-persisted",
    ),
    false,
  );

  console.log(
    "PASS: Flutterwave reconciliation verifies by stored reference and safely normalizes QAR transactions.",
  );

  const networkSecret =
    "test-only-secret-must-not-escape";

  const unavailablePaystack =
    createPaystackPaymentVerificationProvider({
      secretKey:
        networkSecret,
      fetchImplementation:
        async () => {
          throw new Error(
            networkSecret,
          );
        },
    });

  await expectFailure(
    () =>
      unavailablePaystack.verify({
        providerReference:
          "svy-ati-reconciliation",
      }),
    (error) => {
      assert(
        error instanceof
          PaymentVerificationError,
      );

      assert.equal(
        String(error).includes(
          networkSecret,
        ),
        false,
      );
    },
  );

  await expectFailure(
    () =>
      flutterwave.verify({
        providerReference:
          "wrong-reference",
      }),
    (error) => {
      assert(
        error instanceof
          PaymentVerificationError,
      );
    },
  );

  console.log(
    "PASS: Provider rejection, network failure and reference mismatch fail closed without credential leakage.",
  );

  let terminalResolverCalls =
    0;

  const terminalStore =
    memoryStore({
      kind: "TERMINAL",
      payment:
        paidPayment,
    });

  const terminal =
    await reconcileProductPayment(
      {
        storefrontCode: "ATI",
        userId:
          "user-audit",
        orderNumber:
          "SVY-AUDIT",
      },
      {
        store:
          terminalStore.store,
        resolveProvider() {
          terminalResolverCalls +=
            1;

          return paystack;
        },
      },
    );

  assert.equal(
    terminal.disposition,
    "PAID",
  );

  assert.equal(
    terminalResolverCalls,
    0,
  );

  const rateLimitedStore =
    memoryStore({
      kind: "RATE_LIMITED",
      checkedAt:
        "2026-07-27T12:00:20.000Z",
      retryAfterSeconds: 41,
      payment:
        processingPayment,
    });

  const rateLimited =
    await reconcileProductPayment(
      {
        storefrontCode: "ATI",
        userId:
          "user-audit",
        orderNumber:
          "SVY-AUDIT",
      },
      {
        store:
          rateLimitedStore.store,
        resolveProvider() {
          assert.fail(
            "Rate-limited reconciliation contacted a provider.",
          );
        },
      },
    );

  assert.equal(
    rateLimited.disposition,
    "RATE_LIMITED",
  );

  assert.equal(
    rateLimited
      .retryAfterSeconds,
    41,
  );

  console.log(
    "PASS: Terminal and cooldown decisions avoid unnecessary provider traffic.",
  );

  const pendingStore =
    memoryStore(
      attempt(),
    );

  const pending =
    await reconcileProductPayment(
      {
        storefrontCode: "ATI",
        userId:
          "user-audit",
        orderNumber:
          "SVY-AUDIT",
      },
      {
        store:
          pendingStore.store,
        resolveProvider() {
          return verificationProvider({
            ...paystackVerified,
            providerStatus:
              "pending",
            outcome:
              "PENDING",
            payload: {
              source:
                "SERVER_VERIFICATION",
              status:
                "pending",
            },
          });
        },
      },
    );

  assert.equal(
    pending.disposition,
    "PENDING",
  );

  assert.equal(
    pendingStore
      .processedEvents.length,
    0,
  );

  assert.deepEqual(
    {
      status:
        pendingStore
          .completions[0]
          ?.status,
      providerVerified:
        pendingStore
          .completions[0]
          ?.providerVerified,
      failureCode:
        pendingStore
          .completions[0]
          ?.failureCode,
    },
    {
      status: "IGNORED",
      providerVerified: true,
      failureCode:
        "PAYMENT_STILL_PENDING",
    },
  );

  console.log(
    "PASS: Pending verification is recorded without changing payment state.",
  );

  const successStore =
    memoryStore(
      attempt(),
    );

  const success =
    await reconcileProductPayment(
      {
        storefrontCode: "ATI",
        userId:
          "user-audit",
        orderNumber:
          "SVY-AUDIT",
      },
      {
        store:
          successStore.store,
        resolveProvider() {
          return verificationProvider(
            paystackVerified,
          );
        },
      },
    );

  assert.equal(
    success.disposition,
    "PAID",
  );

  assert.equal(
    successStore
      .processedEvents[0]
      ?.signatureVerified,
    true,
  );

  assert.equal(
    successStore
      .processedEvents[0]
      ?.providerReference,
    "svy-ati-reconciliation",
  );

  assert.equal(
    successStore
      .processedEvents[0]
      ?.amount,
    "1250.50",
  );

  const repeatedStore =
    memoryStore(
      attempt({
        attemptEventId:
          "attempt-reconciliation-repeat",
      }),
    );

  await reconcileProductPayment(
    {
      storefrontCode: "ATI",
      userId:
        "user-audit",
      orderNumber:
        "SVY-AUDIT",
    },
    {
      store:
        repeatedStore.store,
      resolveProvider() {
        return verificationProvider(
          paystackVerified,
        );
      },
    },
  );

  assert.equal(
    repeatedStore
      .processedEvents[0]
      ?.providerEventId,
    successStore
      .processedEvents[0]
      ?.providerEventId,
  );

  console.log(
    "PASS: Successful reconciliation uses the existing transition service with stable final-event identity.",
  );

  const failedStore =
    memoryStore(
      attempt(),
    );

  const failed =
    await reconcileProductPayment(
      {
        storefrontCode: "ATI",
        userId:
          "user-audit",
        orderNumber:
          "SVY-AUDIT",
      },
      {
        store:
          failedStore.store,
        resolveProvider() {
          return verificationProvider({
            ...paystackVerified,
            providerStatus:
              "failed",
            outcome:
              "FAILED",
            payload: {
              source:
                "SERVER_VERIFICATION",
              status:
                "failed",
            },
          });
        },
      },
    );

  assert.equal(
    failed.disposition,
    "FAILED",
  );

  assert.equal(
    failedStore
      .processedEvents[0]
      ?.outcome,
    "FAILED",
  );

  console.log(
    "PASS: Verified provider failure is normalized without creating a second transition path.",
  );

  const mismatchStore =
    memoryStore(
      attempt(),
    );

  await expectFailure(
    () =>
      reconcileProductPayment(
        {
          storefrontCode:
            "ATI",
          userId:
            "user-audit",
          orderNumber:
            "SVY-AUDIT",
        },
        {
          store:
            mismatchStore.store,
          resolveProvider() {
            return verificationProvider({
              ...paystackVerified,
              amount:
                "1.00",
            });
          },
        },
      ),
    (error) => {
      assert(
        error instanceof
          PaymentReconciliationError,
      );

      assert.equal(
        error.code,
        "PAYMENT_RECONCILIATION_DATA_INVALID",
      );
    },
  );

  assert.equal(
    mismatchStore
      .processedEvents.length,
    0,
  );

  assert.equal(
    mismatchStore
      .completions[0]
      ?.status,
    "FAILED",
  );

  console.log(
    "PASS: Amount or currency mismatch is visible but cannot finalize the payment.",
  );

  const routeSource =
    await readFile(
      path.join(
        repositoryRoot,
        "src/app/api/orders/[orderNumber]/payment/reconcile/route.ts",
      ),
      "utf8",
    );

  const httpSource =
    await readFile(
      path.join(
        repositoryRoot,
        "src/server/payments/reconciliation/http.ts",
      ),
      "utf8",
    );

  const serviceSource =
    await readFile(
      path.join(
        repositoryRoot,
        "src/server/payments/service.ts",
      ),
      "utf8",
    );

  assert.match(
    routeSource,
    /handleProductPaymentReconciliation/,
  );

  assert.doesNotMatch(
    routeSource,
    /api\.paystack|api\.flutterwave|PAYSTACK_SECRET|FLUTTERWAVE_SECRET/,
  );

  assert.match(
    httpSource,
    /assertTrustedOrigin/,
  );

  assert.match(
    httpSource,
    /readCheckoutApiSession/,
  );

  assert.match(
    httpSource,
    /toPublicProductPaymentView/,
  );

  assert.match(
    httpSource,
    /Retry-After/,
  );

  assert.match(
    serviceSource,
    /payment\.reconciliation\.attempt/,
  );

  assert.match(
    serviceSource,
    /reconciliationCooldownMilliseconds/,
  );

  assert.match(
    serviceSource,
    /FOR UPDATE/,
  );

  console.log(
    "PASS: Reconciliation route remains authenticated, thin, rate-aware and provider-neutral.",
  );

  console.log(
    "PASS: Payment reconciliation audit completed without a database or live provider calls.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
