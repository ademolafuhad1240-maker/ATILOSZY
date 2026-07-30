import {
  AuthDeliveryProviderError,
  AuthDeliveryUnavailableError,
  type AuthDeliveryFetch,
  type EmailVerificationDelivery,
  type PasswordResetDelivery,
  type PhoneVerificationDelivery,
  createResendEmailSender,
  createResendTwilioAuthDeliveryProvider,
  createTwilioSmsSender,
  getAuthDeliveryProvider,
} from "../src/server/auth/delivery";

const TEST_RESEND_KEY =
  "re_audit_secret_never_return";
const TEST_TWILIO_SECRET =
  "twilio-audit-secret-never-return";
const TEST_ACCOUNT_SID =
  `AC${"1".repeat(32)}`;
const TEST_API_KEY =
  `SK${"2".repeat(32)}`;
const TEST_MESSAGE_SID =
  `SM${"3".repeat(32)}`;
const TEST_MESSAGING_SERVICE_SID =
  `MG${"4".repeat(32)}`;

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectProviderError(
  operation: Promise<unknown>,
  expectedReason:
    AuthDeliveryProviderError["reason"],
): Promise<AuthDeliveryProviderError> {
  try {
    await operation;
  } catch (error) {
    assertCondition(
      error instanceof
        AuthDeliveryProviderError,
      "Delivery failure did not use the safe provider error.",
    );

    assertCondition(
      error.reason ===
        expectedReason,
      `Expected ${expectedReason}, received ${error.reason}.`,
    );

    const safeError =
      JSON.stringify({
        name: error.name,
        message: error.message,
        provider:
          error.provider,
        reason: error.reason,
      });

    assertCondition(
      !safeError.includes(
        TEST_RESEND_KEY,
      ) &&
        !safeError.includes(
          TEST_TWILIO_SECRET,
        ),
      "A credential appeared in a returned delivery error.",
    );

    return error;
  }

  throw new Error(
    `Expected ${expectedReason}.`,
  );
}

function response(
  body: unknown,
  status: number,
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

const baseDelivery = {
  storefrontCode: "ATI",
  storefrontName: "ATILOSZY",
  storefrontRoute:
    "/ng/atiloszy",
  expiresAt:
    new Date(
      "2026-07-30T18:00:00.000Z",
    ),
};

const emailDelivery:
  EmailVerificationDelivery = {
    ...baseDelivery,
    deliveryId:
      "email-delivery-audit",
    recipientEmail:
      "delivery-audit@example.test",
    token:
      "email-verification-token",
  };

const phoneDelivery:
  PhoneVerificationDelivery = {
    ...baseDelivery,
    deliveryId:
      "phone-delivery-audit",
    recipientPhone:
      "+2347000000000",
    challengeId:
      "phone-challenge-id",
    code: "417205",
  };

const passwordDelivery:
  PasswordResetDelivery = {
    ...baseDelivery,
    deliveryId:
      "password-delivery-audit",
    recipientEmail:
      "delivery-audit@example.test",
    token:
      "password-reset-token",
  };

async function main(): Promise<void> {
  console.log(
    "=== AUTHENTICATION DELIVERY ADAPTER AUDIT ===",
  );

  const environmentKeys = [
    "APP_ORIGIN",
    "AUTH_DELIVERY_PROVIDER",
    "AUTH_DELIVERY_TIMEOUT_MS",
    "AUTH_EMAIL_FROM",
    "AUTH_SMS_SENDER",
    "RESEND_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY",
    "TWILIO_API_KEY_SECRET",
    "TWILIO_MESSAGING_SERVICE_SID",
  ] as const;

  const originalEnvironment =
    new Map(
      environmentKeys.map(
        (key) => [
          key,
          process.env[key],
        ],
      ),
    );

  try {
    for (const key of environmentKeys) {
      delete process.env[key];
    }

    const disabled =
      getAuthDeliveryProvider();

    assertCondition(
      disabled.name === "disabled" &&
        disabled.enabled === false &&
        disabled
          .phoneVerificationEnabled ===
          false,
      "Disabled delivery was not the default.",
    );

    console.log(
      "PASS: Disabled authentication delivery remains the default.",
    );

    process.env
      .AUTH_DELIVERY_PROVIDER =
      "unsupported-provider";

    try {
      getAuthDeliveryProvider();
      throw new Error(
        "Invalid delivery configuration was accepted.",
      );
    } catch (error) {
      assertCondition(
        error instanceof
          AuthDeliveryProviderError &&
          error.reason ===
            "CONFIGURATION",
        "Invalid delivery provider did not fail closed.",
      );
    }

    process.env
      .AUTH_DELIVERY_PROVIDER =
      "resend";
    process.env.APP_ORIGIN =
      "https://staging.example.test";

    try {
      getAuthDeliveryProvider();
      throw new Error(
        "Missing delivery credentials were accepted.",
      );
    } catch (error) {
      assertCondition(
        error instanceof
          AuthDeliveryProviderError &&
          error.reason ===
            "CONFIGURATION",
        "Missing delivery credentials did not fail closed.",
      );
    }

    process.env.RESEND_API_KEY =
      TEST_RESEND_KEY;
    process.env.AUTH_EMAIL_FROM =
      "SORVYRA STORE <accounts@example.test>";

    const resendOnly =
      getAuthDeliveryProvider();

    assertCondition(
      resendOnly.name === "resend" &&
        resendOnly.enabled &&
        !resendOnly
          .phoneVerificationEnabled,
      "The Resend-only provider was not selected safely.",
    );

    try {
      await resendOnly.sendPhoneVerification(
        phoneDelivery,
      );
      throw new Error(
        "Resend-only delivery accepted an SMS request.",
      );
    } catch (error) {
      assertCondition(
        error instanceof
          AuthDeliveryUnavailableError,
        "Resend-only SMS did not fail safely.",
      );
    }

    process.env
      .AUTH_DELIVERY_PROVIDER =
      "resend-twilio";

    try {
      getAuthDeliveryProvider();
      throw new Error(
        "Missing Twilio credentials were accepted.",
      );
    } catch (error) {
      assertCondition(
        error instanceof
          AuthDeliveryProviderError &&
          error.reason ===
            "CONFIGURATION",
        "Incomplete combined provider configuration did not fail closed.",
      );
    }

    process.env.TWILIO_ACCOUNT_SID =
      TEST_ACCOUNT_SID;
    process.env.TWILIO_API_KEY =
      TEST_API_KEY;
    process.env
      .TWILIO_API_KEY_SECRET =
      TEST_TWILIO_SECRET;
    process.env
      .TWILIO_MESSAGING_SERVICE_SID =
      TEST_MESSAGING_SERVICE_SID;

    const configured =
      getAuthDeliveryProvider();

    assertCondition(
      configured.name ===
        "resend-twilio" &&
        configured.enabled &&
        configured
          .phoneVerificationEnabled,
      "The configured delivery provider was not selected.",
    );

    console.log(
      "PASS: Provider selection and incomplete configuration fail closed.",
    );

    const captured:
      CapturedRequest[] = [];

    const successfulFetch:
      AuthDeliveryFetch =
      async (
        input,
        init,
      ): Promise<Response> => {
        const url =
          input.toString();

        captured.push({
          url,
          init: init ?? {},
        });

        return url.includes(
          "resend.com",
        )
          ? response(
              {
                id:
                  "resend-email-id",
              },
              200,
            )
          : response(
              {
                sid:
                  TEST_MESSAGE_SID,
                status: "queued",
              },
              201,
            );
      };

    const provider =
      createResendTwilioAuthDeliveryProvider(
        {
          resend: {
            apiKey:
              TEST_RESEND_KEY,
            from:
              "SORVYRA STORE <accounts@example.test>",
            appOrigin:
              "https://staging.example.test",
            fetchImplementation:
              successfulFetch,
          },
          twilio: {
            accountSid:
              TEST_ACCOUNT_SID,
            apiKey:
              TEST_API_KEY,
            apiKeySecret:
              TEST_TWILIO_SECRET,
            messagingServiceSid:
              TEST_MESSAGING_SERVICE_SID,
            appOrigin:
              "https://staging.example.test",
            fetchImplementation:
              successfulFetch,
          },
        },
      );

    await provider.sendEmailVerification(
      emailDelivery,
    );
    await provider.sendPhoneVerification(
      phoneDelivery,
    );
    await provider.sendPasswordReset(
      passwordDelivery,
    );

    assertCondition(
      captured.length === 3,
      "The composite provider did not route all delivery methods.",
    );

    const emailRequest =
      captured[0];
    const smsRequest =
      captured[1];
    const passwordRequest =
      captured[2];

    assertCondition(
      emailRequest.url ===
        "https://api.resend.com/emails" &&
        passwordRequest.url ===
          "https://api.resend.com/emails",
      "Resend used an unexpected endpoint.",
    );

    const emailBody =
      JSON.parse(
        String(
          emailRequest.init.body,
        ),
      ) as Record<string, unknown>;
    const passwordBody =
      JSON.parse(
        String(
          passwordRequest.init.body,
        ),
      ) as Record<string, unknown>;
    const emailHeaders =
      new Headers(
        emailRequest.init.headers,
      );

    assertCondition(
      String(emailBody.text).includes(
        "/ng/atiloszy/account/verify?token=email-verification-token",
      ) &&
        String(
          passwordBody.text,
        ).includes(
          "/ng/atiloszy/account/reset-password?token=password-reset-token",
        ),
      "Resend did not create storefront-scoped authentication links.",
    );

    assertCondition(
      emailHeaders.get(
        "Idempotency-Key",
      ) ===
        "auth/email-verification/email-delivery-audit",
      "Resend email idempotency was not bound to the verification record.",
    );

    assertCondition(
      smsRequest.url ===
        `https://api.twilio.com/2010-04-01/Accounts/${TEST_ACCOUNT_SID}/Messages.json`,
      "Twilio used an unexpected endpoint.",
    );

    const smsForm =
      new URLSearchParams(
        String(
          smsRequest.init.body,
        ),
      );

    assertCondition(
      smsForm.get("To") ===
        phoneDelivery.recipientPhone &&
        smsForm.get(
          "MessagingServiceSid",
        ) ===
          TEST_MESSAGING_SERVICE_SID &&
        smsForm
          .get("Body")
          ?.includes(
            "challengeId=phone-challenge-id",
          ),
      "Twilio did not normalize the recipient, sender and challenge link.",
    );

    console.log(
      "PASS: Resend email and Twilio SMS responses normalize successfully.",
    );

    const rejectedEmail =
      createResendEmailSender({
        apiKey:
          TEST_RESEND_KEY,
        from:
          "SORVYRA STORE <accounts@example.test>",
        appOrigin:
          "https://staging.example.test",
        fetchImplementation:
          async () =>
            response(
              {
                message:
                  TEST_RESEND_KEY,
              },
              401,
            ),
      });

    await expectProviderError(
      rejectedEmail.sendEmailVerification(
        emailDelivery,
      ),
      "HTTP_REJECTED",
    );

    const malformedEmail =
      createResendEmailSender({
        apiKey:
          TEST_RESEND_KEY,
        from:
          "SORVYRA STORE <accounts@example.test>",
        appOrigin:
          "https://staging.example.test",
        fetchImplementation:
          async () =>
            response({}, 200),
      });

    await expectProviderError(
      malformedEmail.sendEmailVerification(
        emailDelivery,
      ),
      "MALFORMED_RESPONSE",
    );

    const malformedSms =
      createTwilioSmsSender({
        accountSid:
          TEST_ACCOUNT_SID,
        apiKey:
          TEST_API_KEY,
        apiKeySecret:
          TEST_TWILIO_SECRET,
        from: "+15005550006",
        appOrigin:
          "https://staging.example.test",
        fetchImplementation:
          async () =>
            response(
              {
                sid:
                  TEST_MESSAGE_SID,
                status: "failed",
              },
              201,
            ),
      });

    await expectProviderError(
      malformedSms.sendPhoneVerification(
        phoneDelivery,
      ),
      "MALFORMED_RESPONSE",
    );

    const networkFailure =
      createResendEmailSender({
        apiKey:
          TEST_RESEND_KEY,
        from:
          "SORVYRA STORE <accounts@example.test>",
        appOrigin:
          "https://staging.example.test",
        fetchImplementation:
          async () => {
            throw new Error(
              TEST_RESEND_KEY,
            );
          },
      });

    await expectProviderError(
      networkFailure.sendPasswordReset(
        passwordDelivery,
      ),
      "NETWORK",
    );

    console.log(
      "PASS: HTTP rejection, malformed responses and network failures are safe.",
    );

    const timeoutFetch:
      AuthDeliveryFetch =
      async (
        _input,
        init,
      ): Promise<Response> =>
        new Promise(
          (_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                const error =
                  new Error(
                    "aborted",
                  );
                error.name =
                  "AbortError";
                reject(error);
              },
              {
                once: true,
              },
            );
          },
        );

    const timeoutEmail =
      createResendEmailSender({
        apiKey:
          TEST_RESEND_KEY,
        from:
          "SORVYRA STORE <accounts@example.test>",
        appOrigin:
          "https://staging.example.test",
        timeoutMs: 1_000,
        fetchImplementation:
          timeoutFetch,
      });

    await expectProviderError(
      timeoutEmail.sendEmailVerification(
        emailDelivery,
      ),
      "TIMEOUT",
    );

    console.log(
      "PASS: Timeouts fail safely without returning credentials.",
    );
  } finally {
    for (
      const [
        key,
        value,
      ] of originalEnvironment
    ) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] =
          value;
      }
    }
  }

  console.log(
    "PASS: Authentication delivery adapter audit completed without live requests.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
