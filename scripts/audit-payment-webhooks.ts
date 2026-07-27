import {
  createHmac,
} from "node:crypto";
import {
  readFile,
} from "node:fs/promises";

import type {
  ProcessProductPaymentEventInput,
} from "../src/server/payments/types";
import {
  createFlutterwaveWebhookProvider,
} from "../src/server/payments/webhooks/flutterwave";
import {
  handlePaymentWebhook,
} from "../src/server/payments/webhooks/http";
import {
  createPaystackWebhookProvider,
} from "../src/server/payments/webhooks/paystack";
import {
  resolvePaymentWebhookProvider,
} from "../src/server/payments/webhooks/registry";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

function jsonResponse(
  value: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(
      value,
    ),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    },
  );
}

function webhookRequest(
  input: {
    url: string;
    rawBody: string;
    signatureHeader: string;
    signature: string;
    contentType?: string;
    contentLength?:
      string;
  },
): Request {
  return new Request(
    input.url,
    {
      method: "POST",
      headers: {
        "Content-Type":
          input.contentType ??
          "application/json",
        [input.signatureHeader]:
          input.signature,
        ...(
          input.contentLength ===
            undefined
            ? {}
            : {
                "Content-Length":
                  input
                    .contentLength,
              }
        ),
      },
      body:
        input.rawBody,
    },
  );
}

function paystackSignature(
  rawBody: string,
  secretKey: string,
): string {
  return createHmac(
    "sha512",
    secretKey,
  )
    .update(
      rawBody,
      "utf8",
    )
    .digest(
      "hex",
    );
}

function flutterwaveSignature(
  rawBody: string,
  secretHash: string,
): string {
  return createHmac(
    "sha256",
    secretHash,
  )
    .update(
      rawBody,
      "utf8",
    )
    .digest(
      "base64",
    );
}

async function responseText(
  response: Response,
): Promise<string> {
  return response.text();
}

async function main(): Promise<void> {
  console.log(
    "=== VERIFIED PAYMENT WEBHOOK AUDIT ===",
  );

  const paystackSecret =
    "paystack-test-only-webhook-secret";

  const flutterwaveSecret =
    "flutterwave-test-only-api-secret";

  const flutterwaveWebhookSecret =
    "flutterwave-webhook-secret-hash-audit";

  const selectedPaystack =
    resolvePaymentWebhookProvider(
      "paystack",
      {
        environment: {
          PAYSTACK_SECRET_KEY:
            paystackSecret,
        },
      },
    );

  const selectedFlutterwave =
    resolvePaymentWebhookProvider(
      "flutterwave",
      {
        environment: {
          FLUTTERWAVE_SECRET_KEY:
            flutterwaveSecret,
          FLUTTERWAVE_WEBHOOK_SECRET_HASH:
            flutterwaveWebhookSecret,
        },
      },
    );

  assertCondition(
    selectedPaystack.name ===
      "paystack" &&
      selectedFlutterwave
        .name ===
        "flutterwave",
    "The payment webhook registry selected the wrong provider.",
  );

  for (
    const providerName of [
      "paystack",
      "flutterwave",
    ] as const
  ) {
    let configurationRejected =
      false;

    try {
      resolvePaymentWebhookProvider(
        providerName,
        {
          environment: {},
        },
      );
    } catch {
      configurationRejected =
        true;
    }

    assertCondition(
      configurationRejected,
      `The ${providerName} webhook did not fail closed without credentials.`,
    );
  }

  console.log(
    "PASS: Webhook registry selection fails closed when credentials are incomplete.",
  );

  const paystackPayload = {
    event:
      "charge.success",
    data: {
      id: 930001,
      status:
        "success",
      reference:
        "svy-ati-webhook-audit",
      amount: 1_500_025,
      currency:
        "NGN",
      channel:
        "card",
      customer: {
        email:
          "private@example.test",
      },
      authorization: {
        last4:
          "4081",
      },
    },
  };

  const paystackRawBody =
    JSON.stringify(
      paystackPayload,
    );

  let paystackVerificationCount =
    0;

  const paystackFetch:
    typeof fetch =
      async (
        request,
        init,
      ) => {
        paystackVerificationCount +=
          1;

        assertCondition(
          request.toString() ===
            "https://api.paystack.co/transaction/verify/svy-ati-webhook-audit",
          "Paystack verification used an unexpected endpoint.",
        );

        assertCondition(
          new Headers(
            init?.headers,
          ).get(
            "authorization",
          ) ===
            `Bearer ${paystackSecret}`,
          "Paystack verification omitted secret-key authentication.",
        );

        return jsonResponse({
          status: true,
          data: {
            id: 930001,
            status:
              "success",
            reference:
              "svy-ati-webhook-audit",
            amount:
              1_500_025,
            currency:
              "NGN",
            channel:
              "card",
          },
        });
      };

  const paystackProvider =
    createPaystackWebhookProvider(
      {
        secretKey:
          paystackSecret,
        fetchImplementation:
          paystackFetch,
      },
    );

  const capturedPaystack:
    ProcessProductPaymentEventInput[] =
      [];

  const paystackResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/paystack",
        rawBody:
          paystackRawBody,
        signatureHeader:
          "x-paystack-signature",
        signature:
          paystackSignature(
            paystackRawBody,
            paystackSecret,
          ),
      }),
      () =>
        paystackProvider,
      async (event) => {
        capturedPaystack.push(
          event,
        );
      },
    );

  assertCondition(
    paystackResponse.status ===
      200 &&
      capturedPaystack
        .length === 1 &&
      paystackVerificationCount ===
        1,
    "A valid Paystack webhook was not acknowledged and processed once.",
  );

  const normalizedPaystack =
    capturedPaystack[0];

  assertCondition(
    normalizedPaystack
      ?.provider ===
      "paystack" &&
      normalizedPaystack
        .providerEventId ===
        "charge.success:930001" &&
      normalizedPaystack
        .providerReference ===
        "svy-ati-webhook-audit" &&
      normalizedPaystack
        .amount ===
        "15000.25" &&
      normalizedPaystack
        .currencyCode ===
        "NGN" &&
      normalizedPaystack
        .outcome ===
        "SUCCEEDED" &&
      normalizedPaystack
        .signatureVerified,
    "Paystack webhook normalization produced incorrect transition data.",
  );

  const storedPaystackPayload =
    JSON.stringify(
      normalizedPaystack
        .payload,
    );

  assertCondition(
    !storedPaystackPayload.includes(
      "private@example.test",
    ) &&
      !storedPaystackPayload.includes(
        "4081",
      ),
    "Paystack webhook normalization retained sensitive customer or card data.",
  );

  console.log(
    "PASS: Paystack signatures, verification, minor units and safe normalization are enforced.",
  );

  let invalidPaystackProcessed =
    false;

  const invalidPaystackResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/paystack",
        rawBody:
          paystackRawBody,
        signatureHeader:
          "x-paystack-signature",
        signature:
          "0".repeat(
            128,
          ),
      }),
      () =>
        paystackProvider,
      async () => {
        invalidPaystackProcessed =
          true;
      },
    );

  assertCondition(
    invalidPaystackResponse
      .status === 401 &&
      !invalidPaystackProcessed &&
      paystackVerificationCount ===
        1,
    "An invalid Paystack signature reached verification or event processing.",
  );

  const unsupportedPaystackBody =
    JSON.stringify({
      event:
        "customeridentification.success",
      data: {
        id: 930002,
      },
    });

  const unsupportedPaystackResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/paystack",
        rawBody:
          unsupportedPaystackBody,
        signatureHeader:
          "x-paystack-signature",
        signature:
          paystackSignature(
            unsupportedPaystackBody,
            paystackSecret,
          ),
      }),
      () =>
        paystackProvider,
      async () => {
        throw new Error(
          "Unsupported Paystack event was processed.",
        );
      },
    );

  assertCondition(
    unsupportedPaystackResponse
      .status === 200 &&
      paystackVerificationCount ===
        1,
    "An unrelated Paystack event was not safely acknowledged and ignored.",
  );

  console.log(
    "PASS: Invalid Paystack signatures are rejected and unrelated events are ignored.",
  );

  const flutterwavePayload = {
    event:
      "charge.completed",
    data: {
      id: 940001,
      tx_ref:
        "svy-zch-webhook-audit",
      amount:
        825.5,
      currency:
        "QAR",
      status:
        "successful",
      payment_type:
        "card",
      customer: {
        email:
          "private-qatar@example.test",
      },
      card: {
        last_4digits:
          "4242",
      },
    },
  };

  const flutterwaveRawBody =
    JSON.stringify(
      flutterwavePayload,
    );

  let flutterwaveVerificationCount =
    0;

  const flutterwaveFetch:
    typeof fetch =
      async (
        request,
        init,
      ) => {
        flutterwaveVerificationCount +=
          1;

        assertCondition(
          request.toString() ===
            "https://api.flutterwave.com/v3/transactions/940001/verify",
          "Flutterwave verification used an unexpected endpoint.",
        );

        assertCondition(
          new Headers(
            init?.headers,
          ).get(
            "authorization",
          ) ===
            `Bearer ${flutterwaveSecret}`,
          "Flutterwave verification omitted secret-key authentication.",
        );

        return jsonResponse({
          status:
            "success",
          data: {
            id: 940001,
            tx_ref:
              "svy-zch-webhook-audit",
            amount:
              825.5,
            currency:
              "QAR",
            status:
              "successful",
            payment_type:
              "card",
          },
        });
      };

  const flutterwaveProvider =
    createFlutterwaveWebhookProvider(
      {
        secretKey:
          flutterwaveSecret,
        webhookSecretHash:
          flutterwaveWebhookSecret,
        fetchImplementation:
          flutterwaveFetch,
      },
    );

  const capturedFlutterwave:
    ProcessProductPaymentEventInput[] =
      [];

  const flutterwaveResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/flutterwave",
        rawBody:
          flutterwaveRawBody,
        signatureHeader:
          "flutterwave-signature",
        signature:
          flutterwaveSignature(
            flutterwaveRawBody,
            flutterwaveWebhookSecret,
          ),
      }),
      () =>
        flutterwaveProvider,
      async (event) => {
        capturedFlutterwave.push(
          event,
        );
      },
    );

  assertCondition(
    flutterwaveResponse
      .status === 200 &&
      capturedFlutterwave
        .length === 1 &&
      flutterwaveVerificationCount ===
        1,
    "A valid Flutterwave webhook was not acknowledged and processed once.",
  );

  const normalizedFlutterwave =
    capturedFlutterwave[0];

  assertCondition(
    normalizedFlutterwave
      ?.provider ===
      "flutterwave" &&
      normalizedFlutterwave
        .providerReference ===
        "svy-zch-webhook-audit" &&
      normalizedFlutterwave
        .amount ===
        "825.50" &&
      normalizedFlutterwave
        .currencyCode ===
        "QAR" &&
      normalizedFlutterwave
        .outcome ===
        "SUCCEEDED" &&
      normalizedFlutterwave
        .signatureVerified,
    "Flutterwave webhook normalization produced incorrect transition data.",
  );

  const storedFlutterwavePayload =
    JSON.stringify(
      normalizedFlutterwave
        .payload,
    );

  assertCondition(
    !storedFlutterwavePayload.includes(
      "private-qatar@example.test",
    ) &&
      !storedFlutterwavePayload.includes(
        "4242",
      ),
    "Flutterwave webhook normalization retained sensitive customer or card data.",
  );

  console.log(
    "PASS: Flutterwave HMAC signatures, transaction verification and safe QAR normalization are enforced.",
  );

  const failedFlutterwavePayload = {
    event:
      "charge.completed",
    data: {
      id: 940002,
      tx_ref:
        "svy-ati-failed-webhook-audit",
      amount:
        500,
      currency:
        "NGN",
      status:
        "failed",
      payment_type:
        "ussd",
    },
  };

  const failedFlutterwaveRawBody =
    JSON.stringify(
      failedFlutterwavePayload,
    );

  const failedFlutterwaveProvider =
    createFlutterwaveWebhookProvider(
      {
        secretKey:
          flutterwaveSecret,
        webhookSecretHash:
          flutterwaveWebhookSecret,
        fetchImplementation:
          async () =>
            jsonResponse({
              status:
                "success",
              data: {
                id: 940002,
                tx_ref:
                  "svy-ati-failed-webhook-audit",
                amount: 500,
                currency:
                  "NGN",
                status:
                  "failed",
                payment_type:
                  "ussd",
              },
            }),
      },
    );

  const failedFlutterwaveEvents:
    ProcessProductPaymentEventInput[] =
      [];

  const failedFlutterwaveResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/flutterwave",
        rawBody:
          failedFlutterwaveRawBody,
        signatureHeader:
          "flutterwave-signature",
        signature:
          flutterwaveSignature(
            failedFlutterwaveRawBody,
            flutterwaveWebhookSecret,
          ),
      }),
      () =>
        failedFlutterwaveProvider,
      async (event) => {
        failedFlutterwaveEvents
          .push(
            event,
          );
      },
    );

  const failedFlutterwaveEvent =
    failedFlutterwaveEvents[0];

  assertCondition(
    failedFlutterwaveResponse
      .status === 200 &&
      failedFlutterwaveEvent
        ?.outcome ===
        "FAILED" &&
      failedFlutterwaveEvent
        .failureCode ===
        "FLUTTERWAVE_REPORTED_FAILURE",
    "A verified failed Flutterwave payment was not normalized safely.",
  );

  console.log(
    "PASS: Verified Flutterwave failure events normalize without falsely marking payment success.",
  );

  const mismatchedPaystackProvider =
    createPaystackWebhookProvider(
      {
        secretKey:
          paystackSecret,
        fetchImplementation:
          async () =>
            jsonResponse({
              status: true,
              data: {
                id: 930001,
                status:
                  "success",
                reference:
                  "svy-ati-webhook-audit",
                amount:
                  1_500_026,
                currency:
                  "NGN",
                channel:
                  "card",
              },
            }),
      },
    );

  const mismatchedResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/paystack",
        rawBody:
          paystackRawBody,
        signatureHeader:
          "x-paystack-signature",
        signature:
          paystackSignature(
            paystackRawBody,
            paystackSecret,
          ),
      }),
      () =>
        mismatchedPaystackProvider,
      async () => {
        throw new Error(
          "Mismatched provider data was processed.",
        );
      },
    );

  assertCondition(
    mismatchedResponse.status ===
      400,
    "Signed webhook data that disagreed with provider verification was accepted.",
  );

  const providerSecretThatMustNotEscape =
    "paystack-test-only-secret-must-not-escape";

  const rejectedProvider =
    createPaystackWebhookProvider(
      {
        secretKey:
          providerSecretThatMustNotEscape,
        fetchImplementation:
          async () =>
            jsonResponse(
              {
                message:
                  providerSecretThatMustNotEscape,
              },
              401,
            ),
      },
    );

  const rejectedRawBody =
    JSON.stringify(
      paystackPayload,
    );

  const rejectedResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/paystack",
        rawBody:
          rejectedRawBody,
        signatureHeader:
          "x-paystack-signature",
        signature:
          paystackSignature(
            rejectedRawBody,
            providerSecretThatMustNotEscape,
          ),
      }),
      () =>
        rejectedProvider,
      async () => {
        throw new Error(
          "Rejected verification was processed.",
        );
      },
    );

  assertCondition(
    rejectedResponse.status ===
      503 &&
      !(
        await responseText(
          rejectedResponse,
        )
      ).includes(
        providerSecretThatMustNotEscape,
      ),
    "Provider verification failure exposed credentials or returned the wrong status.",
  );

  const networkFailureProvider =
    createFlutterwaveWebhookProvider(
      {
        secretKey:
          flutterwaveSecret,
        webhookSecretHash:
          flutterwaveWebhookSecret,
        fetchImplementation:
          async () => {
            throw new Error(
              flutterwaveSecret,
            );
          },
      },
    );

  const networkFailureResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/flutterwave",
        rawBody:
          flutterwaveRawBody,
        signatureHeader:
          "flutterwave-signature",
        signature:
          flutterwaveSignature(
            flutterwaveRawBody,
            flutterwaveWebhookSecret,
          ),
      }),
      () =>
        networkFailureProvider,
      async () => {
        throw new Error(
          "Network failure reached event processing.",
        );
      },
    );

  assertCondition(
    networkFailureResponse
      .status === 503 &&
      (
        await responseText(
          networkFailureResponse,
        )
      ).length === 0,
    "Provider network failure was not safely normalized.",
  );

  console.log(
    "PASS: Verification mismatches, HTTP rejection and network failure fail closed without credential leakage.",
  );

  const wrongContentTypeResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/paystack",
        rawBody:
          paystackRawBody,
        signatureHeader:
          "x-paystack-signature",
        signature:
          paystackSignature(
            paystackRawBody,
            paystackSecret,
          ),
        contentType:
          "text/plain",
      }),
      () =>
        paystackProvider,
      async () => {
        throw new Error(
          "Invalid content type was processed.",
        );
      },
    );

  const oversizedResponse =
    await handlePaymentWebhook(
      webhookRequest({
        url:
          "http://localhost/api/payments/webhooks/paystack",
        rawBody:
          paystackRawBody,
        signatureHeader:
          "x-paystack-signature",
        signature:
          paystackSignature(
            paystackRawBody,
            paystackSecret,
          ),
        contentLength:
          "1000001",
      }),
      () =>
        paystackProvider,
      async () => {
        throw new Error(
          "Oversized webhook was processed.",
        );
      },
    );

  assertCondition(
    wrongContentTypeResponse
      .status === 415 &&
      oversizedResponse
        .status === 413,
    "Webhook content type and body limits were not enforced.",
  );

  console.log(
    "PASS: Webhook content type and bounded raw-body requirements are enforced.",
  );

  const repeatedEvents:
    ProcessProductPaymentEventInput[] =
      [];

  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    const repeatedResponse =
      await handlePaymentWebhook(
        webhookRequest({
          url:
            "http://localhost/api/payments/webhooks/paystack",
          rawBody:
            paystackRawBody,
          signatureHeader:
            "x-paystack-signature",
          signature:
            paystackSignature(
              paystackRawBody,
              paystackSecret,
            ),
        }),
        () =>
          paystackProvider,
        async (event) => {
          repeatedEvents.push(
            event,
          );
        },
      );

    assertCondition(
      repeatedResponse.status ===
        200,
      "Repeated webhook delivery was not acknowledged.",
    );
  }

  assertCondition(
    repeatedEvents.length ===
      2 &&
      repeatedEvents[0]
        ?.providerEventId ===
        repeatedEvents[1]
          ?.providerEventId &&
      repeatedEvents[0]
        ?.payloadHash ===
        repeatedEvents[1]
          ?.payloadHash,
    "Repeated webhook delivery did not preserve durable idempotency identity.",
  );

  console.log(
    "PASS: Repeated webhook delivery preserves the provider event ID and raw-payload hash.",
  );

  const paystackRoute =
    await readFile(
      "src/app/api/payments/webhooks/paystack/route.ts",
      "utf8",
    );

  const flutterwaveRoute =
    await readFile(
      "src/app/api/payments/webhooks/flutterwave/route.ts",
      "utf8",
    );

  for (
    const routeSource of [
      paystackRoute,
      flutterwaveRoute,
    ]
  ) {
    for (
      const required of [
        "handlePaymentWebhook",
        "resolvePaymentWebhookProvider",
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
        `Payment webhook route is missing: ${required}`,
      );
    }

    for (
      const forbidden of [
        "createHmac",
        "processProductPaymentEvent",
        "PAYSTACK_SECRET_KEY",
        "FLUTTERWAVE_SECRET_KEY",
      ]
    ) {
      assertCondition(
        !routeSource.includes(
          forbidden,
        ),
        `Provider-specific security logic leaked into a route: ${forbidden}`,
      );
    }
  }

  console.log(
    "PASS: Webhook routes remain thin, provider-neutral application boundaries.",
  );

  console.log(
    "PASS: Verified payment webhook audit completed without live provider calls.",
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      error,
    );
    process.exitCode = 1;
  },
);
