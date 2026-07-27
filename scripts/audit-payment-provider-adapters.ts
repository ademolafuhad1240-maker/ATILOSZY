import {
  OrderPaymentMethod,
} from "../src/generated/prisma/client";
import {
  PaymentInitiationConfigurationError,
  PaymentInitiationProviderError,
  type PaymentInitiationRequest,
} from "../src/server/payments/initiation";
import {
  createFlutterwavePaymentInitiationProvider,
} from "../src/server/payments/providers/flutterwave";
import {
  amountToMinorUnits,
} from "../src/server/payments/providers/money";
import {
  createPaystackPaymentInitiationProvider,
} from "../src/server/payments/providers/paystack";
import {
  resolvePaymentInitiationProvider,
} from "../src/server/payments/registry";

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

function requestBody(
  init:
    RequestInit |
    undefined,
): Record<string, unknown> {
  assertCondition(
    typeof init?.body ===
      "string",
    "Expected a JSON request body.",
  );

  const parsed =
    JSON.parse(
      init.body,
    ) as unknown;

  assertCondition(
    isRecord(
      parsed,
    ),
    "Expected a provider request object.",
  );

  return parsed;
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

function paymentRequest(
  input: {
    currencyCode?: string;
    method?:
      OrderPaymentMethod;
    merchantReference?:
      string;
    idempotencyKey?:
      string;
  } = {},
): PaymentInitiationRequest {
  return {
    storefrontCode:
      "ATI",
    userId:
      "user-adapter-audit",
    orderId:
      "order-adapter-audit",
    orderNumber:
      "ATI-ADAPTER-AUDIT",
    customer: {
      email:
        "customer@example.test",
      name:
        "Adapter Audit Customer",
      phone:
        "+2348000000000",
    },
    currencyCode:
      input.currencyCode ??
      "NGN",
    amount:
      "15000.25",
    method:
      input.method ??
      OrderPaymentMethod.CARD,
    merchantReference:
      input.merchantReference ??
      "svy-ati-adapter-audit",
    idempotencyKey:
      input.idempotencyKey ??
      "pay:ati:adapter-audit",
    returnUrl:
      "http://localhost:3000/ng/atiloszy/account/orders/ATI-ADAPTER-AUDIT",
  };
}

async function expectProviderError(
  operation:
    () => Promise<unknown>,
  expectedReason: string,
): Promise<
  PaymentInitiationProviderError
> {
  try {
    await operation();
  } catch (error) {
    assertCondition(
      error instanceof
        PaymentInitiationProviderError,
      "Expected a safe payment-provider error.",
    );

    assertCondition(
      error.details?.[
        "reason"
      ] === expectedReason,
      `Expected provider failure reason ${expectedReason}.`,
    );

    return error;
  }

  throw new Error(
    "Expected the payment provider to reject the request.",
  );
}

function serializedError(
  error:
    PaymentInitiationProviderError,
): string {
  return JSON.stringify({
    name:
      error.name,
    message:
      error.message,
    details:
      error.details,
  });
}

async function main(): Promise<void> {
  console.log(
    "=== PAYMENT PROVIDER ADAPTER AUDIT ===",
  );

  const disabled =
    resolvePaymentInitiationProvider({
      environment: {},
    });

  assertCondition(
    disabled.name ===
      "disabled" &&
      !disabled.enabled &&
      disabled
        .supportedMethods
        .length === 0,
    "The payment provider default is not safely disabled.",
  );

  console.log(
    "PASS: Payment provider selection remains disabled by default.",
  );

  const paystackSecret =
    "sk_test_paystack_adapter_audit";
  const flutterwaveSecret =
    "FLWSECK_TEST-flutterwave-adapter-audit";

  const selectedPaystack =
    resolvePaymentInitiationProvider({
      environment: {
        PAYMENT_INITIATION_PROVIDER:
          "paystack",
        PAYSTACK_SECRET_KEY:
          paystackSecret,
      },
    });

  const selectedFlutterwave =
    resolvePaymentInitiationProvider({
      environment: {
        PAYMENT_INITIATION_PROVIDER:
          "flutterwave",
        FLUTTERWAVE_SECRET_KEY:
          flutterwaveSecret,
      },
    });

  assertCondition(
    selectedPaystack.name ===
      "paystack" &&
      selectedPaystack.enabled &&
      selectedFlutterwave
        .name ===
        "flutterwave" &&
      selectedFlutterwave
        .enabled,
    "The payment provider registry selected the wrong adapter.",
  );

  let invalidConfigurationRejected =
    false;

  try {
    resolvePaymentInitiationProvider({
      environment: {
        PAYMENT_INITIATION_PROVIDER:
          "unknown-provider",
      },
    });
  } catch (error) {
    invalidConfigurationRejected =
      error instanceof
        PaymentInitiationConfigurationError;
  }

  assertCondition(
    invalidConfigurationRejected,
    "An invalid payment provider configuration did not fail closed.",
  );

  for (
    const environment of [
      {
        PAYMENT_INITIATION_PROVIDER:
          "paystack",
      },
      {
        PAYMENT_INITIATION_PROVIDER:
          "flutterwave",
      },
    ]
  ) {
    let missingCredentialsRejected =
      false;

    try {
      resolvePaymentInitiationProvider({
        environment,
      });
    } catch (error) {
      missingCredentialsRejected =
        error instanceof
          PaymentInitiationConfigurationError;
    }

    assertCondition(
      missingCredentialsRejected,
      "A live provider was enabled without its server secret.",
    );
  }

  console.log(
    "PASS: Registry selection rejects invalid providers and missing credentials.",
  );

  assertCondition(
    amountToMinorUnits(
      "15000.25",
      "NGN",
    ) === "1500025" &&
      amountToMinorUnits(
        "42",
        "QAR",
      ) === "4200",
    "Provider amount conversion did not preserve exact minor units.",
  );

  await expectProviderError(
    async () => {
      amountToMinorUnits(
        "10.001",
        "NGN",
      );
    },
    "INVALID_AMOUNT",
  );

  console.log(
    "PASS: Provider amounts use exact currency minor-unit conversion.",
  );

  let paystackRequest:
    Record<string, unknown> |
    null = null;

  const paystackFetch:
    typeof fetch =
      async (
        request,
        init,
      ) => {
        assertCondition(
          request.toString() ===
            "https://api.paystack.co/transaction/initialize",
          "Paystack used an unexpected initialization endpoint.",
        );

        const headers =
          new Headers(
            init?.headers,
          );

        assertCondition(
          headers.get(
            "authorization",
          ) ===
            `Bearer ${paystackSecret}`,
          "Paystack did not use secret-key bearer authentication.",
        );

        paystackRequest =
          requestBody(
            init,
          );

        return jsonResponse({
          status: true,
          message:
            "Authorization URL created",
          data: {
            authorization_url:
              "https://checkout.paystack.com/audit-checkout",
            access_code:
              "audit-access-code",
            reference:
              "svy-ati-adapter-audit",
          },
        });
      };

  const paystack =
    createPaystackPaymentInitiationProvider(
      {
        secretKey:
          paystackSecret,
        fetchImplementation:
          paystackFetch,
      },
    );

  const paystackResult =
    await paystack.initiate(
      paymentRequest(),
    );

  assertCondition(
    paystackResult
      .providerReference ===
      "svy-ati-adapter-audit" &&
      paystackResult
        .nextAction.type ===
        "REDIRECT" &&
      paystackResult
        .nextAction.url ===
        "https://checkout.paystack.com/audit-checkout" &&
      !JSON.stringify(
        paystackResult,
      ).includes(
        "audit-access-code",
      ),
    "Paystack did not return a normalized hosted-checkout result.",
  );

  assertCondition(
    paystackRequest !==
      null &&
      paystackRequest[
        "amount"
      ] ===
        "1500025" &&
      paystackRequest[
        "currency"
      ] === "NGN" &&
      paystackRequest[
        "reference"
      ] ===
        "svy-ati-adapter-audit" &&
      Array.isArray(
        paystackRequest[
          "channels"
        ],
      ),
    "Paystack did not receive the server-derived amount, currency, reference and channel.",
  );

  await expectProviderError(
    () =>
      paystack.initiate(
        paymentRequest({
          currencyCode:
            "QAR",
        }),
      ),
    "UNSUPPORTED_CURRENCY",
  );

  console.log(
    "PASS: Paystack initializes normalized NGN hosted checkout and rejects unsupported currency.",
  );

  let flutterwaveRequest:
    Record<string, unknown> |
    null = null;

  const flutterwaveFetch:
    typeof fetch =
      async (
        request,
        init,
      ) => {
        assertCondition(
          request.toString() ===
            "https://api.flutterwave.com/v3/payments",
          "Flutterwave used an unexpected initialization endpoint.",
        );

        const headers =
          new Headers(
            init?.headers,
          );

        assertCondition(
          headers.get(
            "authorization",
          ) ===
            `Bearer ${flutterwaveSecret}`,
          "Flutterwave did not use secret-key bearer authentication.",
        );

        flutterwaveRequest =
          requestBody(
            init,
          );

        return jsonResponse({
          status:
            "success",
          message:
            "Hosted Link",
          data: {
            link:
              "https://checkout.flutterwave.com/v3/hosted/pay/audit-checkout",
          },
        });
      };

  const flutterwave =
    createFlutterwavePaymentInitiationProvider(
      {
        secretKey:
          flutterwaveSecret,
        fetchImplementation:
          flutterwaveFetch,
      },
    );

  const flutterwaveResult =
    await flutterwave
      .initiate(
        paymentRequest(),
      );

  assertCondition(
    flutterwaveResult
      .providerReference ===
      "svy-ati-adapter-audit" &&
      flutterwaveResult
        .nextAction.type ===
        "REDIRECT" &&
      flutterwaveResult
        .nextAction.url ===
        "https://checkout.flutterwave.com/v3/hosted/pay/audit-checkout",
    "Flutterwave did not return a normalized hosted-checkout result.",
  );

  assertCondition(
    flutterwaveRequest !==
      null &&
      flutterwaveRequest[
        "amount"
      ] ===
        "15000.25" &&
      flutterwaveRequest[
        "currency"
      ] === "NGN" &&
      flutterwaveRequest[
        "tx_ref"
      ] ===
        "svy-ati-adapter-audit" &&
      flutterwaveRequest[
        "payment_options"
      ] === "card",
    "Flutterwave did not receive the server-derived payment values.",
  );

  const qarResult =
    await flutterwave
      .initiate(
        paymentRequest({
          currencyCode:
            "QAR",
          merchantReference:
            "svy-zch-adapter-audit",
          idempotencyKey:
            "pay:zch:adapter-audit",
        }),
      );

  assertCondition(
    qarResult
      .providerReference ===
      "svy-zch-adapter-audit" &&
      flutterwaveRequest !==
        null &&
      flutterwaveRequest[
        "currency"
      ] === "QAR" &&
      flutterwaveRequest[
        "payment_options"
      ] === "card",
    "Flutterwave did not preserve the server-derived QAR card request.",
  );

  await expectProviderError(
    () =>
      flutterwave.initiate(
        paymentRequest({
          currencyCode:
            "QAR",
          method:
            OrderPaymentMethod
              .BANK_TRANSFER,
        }),
      ),
    "UNSUPPORTED_METHOD_FOR_CURRENCY",
  );

  await expectProviderError(
    () =>
      flutterwave.initiate(
        paymentRequest({
          currencyCode:
            "USD",
        }),
      ),
    "UNSUPPORTED_CURRENCY",
  );

  console.log(
    "PASS: Flutterwave normalizes hosted checkout for NGN and QAR card requests and rejects unsafe currency-method combinations.",
  );

  const rejectionSecret =
    "sk_test_must_never_escape";

  const rejectedPaystack =
    createPaystackPaymentInitiationProvider(
      {
        secretKey:
          rejectionSecret,
        fetchImplementation:
          async () =>
            jsonResponse(
              {
                status:
                  false,
                message:
                  `Rejected ${rejectionSecret}`,
              },
              401,
            ),
      },
    );

  const rejectionError =
    await expectProviderError(
      () =>
        rejectedPaystack
          .initiate(
            paymentRequest(),
          ),
      "HTTP_REJECTED",
    );

  assertCondition(
    !serializedError(
      rejectionError,
    ).includes(
      rejectionSecret,
    ),
    "A provider HTTP rejection exposed credentials.",
  );

  const malformedFlutterwave =
    createFlutterwavePaymentInitiationProvider(
      {
        secretKey:
          flutterwaveSecret,
        fetchImplementation:
          async () =>
            jsonResponse({
              status:
                "success",
              data: {},
            }),
      },
    );

  await expectProviderError(
    () =>
      malformedFlutterwave
        .initiate(
          paymentRequest(),
        ),
    "MALFORMED_RESPONSE",
  );

  console.log(
    "PASS: Provider HTTP rejection and malformed responses fail safely.",
  );

  const networkSecret =
    "FLWSECK_TEST-network-secret";

  const networkFailureProvider =
    createFlutterwavePaymentInitiationProvider(
      {
        secretKey:
          networkSecret,
        fetchImplementation:
          async () => {
            throw new Error(
              `Network failure ${networkSecret}`,
            );
          },
      },
    );

  const networkError =
    await expectProviderError(
      () =>
        networkFailureProvider
          .initiate(
            paymentRequest(),
          ),
      "NETWORK_FAILURE",
    );

  assertCondition(
    !serializedError(
      networkError,
    ).includes(
      networkSecret,
    ),
    "A provider network failure exposed credentials.",
  );

  const timeoutProvider =
    createPaystackPaymentInitiationProvider(
      {
        secretKey:
          paystackSecret,
        timeoutMilliseconds:
          5,
        fetchImplementation:
          (
            _request,
            init,
          ) =>
            new Promise<Response>(
              (
                _resolve,
                reject,
              ) => {
                const signal =
                  init?.signal;

                assertCondition(
                  signal !==
                    null &&
                    signal !==
                      undefined,
                  "Provider timeout did not attach an abort signal.",
                );

                signal.addEventListener(
                  "abort",
                  () => {
                    reject(
                      new DOMException(
                        "Aborted",
                        "AbortError",
                      ),
                    );
                  },
                  {
                    once: true,
                  },
                );
              },
            ),
      },
    );

  await expectProviderError(
    () =>
      timeoutProvider.initiate(
        paymentRequest(),
      ),
    "TIMEOUT",
  );

  console.log(
    "PASS: Provider network and timeout failures are normalized without credential leakage.",
  );

  const repeatedReferences:
    string[] = [];

  const repeatedProvider =
    createPaystackPaymentInitiationProvider(
      {
        secretKey:
          paystackSecret,
        fetchImplementation:
          async (
            _request,
            init,
          ) => {
            const body =
              requestBody(
                init,
              );

            const reference =
              body[
                "reference"
              ];

            assertCondition(
              typeof reference ===
                "string",
              "Repeated provider request omitted its reference.",
            );

            repeatedReferences.push(
              reference,
            );

            return jsonResponse({
              status: true,
              data: {
                authorization_url:
                  "https://checkout.paystack.com/repeated-audit",
                reference,
              },
            });
          },
      },
    );

  const repeatedRequest =
    paymentRequest({
      merchantReference:
        "svy-ati-repeated-audit",
      idempotencyKey:
        "pay:ati:repeated-audit",
    });

  const firstRepeatedResult =
    await repeatedProvider
      .initiate(
        repeatedRequest,
      );

  const secondRepeatedResult =
    await repeatedProvider
      .initiate(
        repeatedRequest,
      );

  assertCondition(
    repeatedReferences.length ===
      2 &&
      repeatedReferences[0] ===
        "svy-ati-repeated-audit" &&
      repeatedReferences[1] ===
        repeatedReferences[0] &&
      firstRepeatedResult
        .providerReference ===
        secondRepeatedResult
          .providerReference,
    "Repeated initialization changed the server-generated provider reference.",
  );

  console.log(
    "PASS: Repeated initialization preserves deterministic provider references for durable idempotency checks.",
  );

  console.log(
    "PASS: Paystack and Flutterwave payment provider adapter audit completed.",
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
