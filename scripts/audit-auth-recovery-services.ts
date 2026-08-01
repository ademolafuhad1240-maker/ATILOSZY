import {
  randomBytes,
} from "node:crypto";

import { prisma } from "../src/lib/prisma";
import {
  AuthDeliveryUnavailableError,
  AuthServiceError,
  type AuthDeliveryProvider,
  type EmailVerificationDelivery,
  type PasswordResetDelivery,
  type PhoneVerificationDelivery,
  createDisabledAuthDeliveryProvider,
  loginCustomer,
  normalizeEmail,
  registerCustomer,
  requestPasswordReset,
  resendRegistrationVerification,
  resetCustomerPassword,
  validateSession,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

const AUDIT_TOKEN_SECRET =
  "sorvyra-recovery-service-audit-secret-2026-07-26";

class CaptureDeliveryProvider
  implements AuthDeliveryProvider {
  readonly name = "audit-capture";
  readonly enabled = true;
  readonly phoneVerificationEnabled =
    true;

  readonly emailVerifications:
    EmailVerificationDelivery[] = [];

  readonly phoneVerifications:
    PhoneVerificationDelivery[] = [];

  readonly passwordResets:
    PasswordResetDelivery[] = [];

  async sendEmailVerification(
    delivery:
      EmailVerificationDelivery,
  ): Promise<void> {
    this.emailVerifications.push(
      delivery,
    );
  }

  async sendPhoneVerification(
    delivery:
      PhoneVerificationDelivery,
  ): Promise<void> {
    this.phoneVerifications.push(
      delivery,
    );
  }

  async sendPasswordReset(
    delivery:
      PasswordResetDelivery,
  ): Promise<void> {
    this.passwordResets.push(
      delivery,
    );
  }
}

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectAuthError(
  operation: Promise<unknown>,
  expectedCode:
    AuthServiceError["code"],
  message: string,
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    if (
      error instanceof
        AuthServiceError &&
      error.code === expectedCode
    ) {
      return;
    }

    throw error;
  }

  throw new Error(message);
}

async function main(): Promise<void> {
  console.log(
    "=== AUTHENTICATION RECOVERY SERVICE AUDIT ===",
  );

  const suffix = randomBytes(8)
    .toString("hex");

  const email =
    `recovery-audit-${suffix}@example.test`;

  const missingEmail =
    `missing-recovery-${suffix}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phoneSuffix =
    `${Date.now()}`.slice(-7);

  const phone =
    `+234704${phoneSuffix}`;

  const oldPassword =
    `Old-Recovery-Passphrase-${suffix}`;

  const newPassword =
    `New-Recovery-Passphrase-${suffix}`;

  const capture =
    new CaptureDeliveryProvider();

  const disabled =
    createDisabledAuthDeliveryProvider();

  try {
    await disabled.sendPasswordReset({
      deliveryId:
        "audit-delivery",
      storefrontCode: "ATI",
      storefrontName:
        "ATILOSZY Varieties Store",
      storefrontRoute:
        "/ng/atiloszy",
      recipientEmail: email,
      token: "audit-token",
      expiresAt: new Date(),
    });

    throw new Error(
      "The disabled delivery provider unexpectedly sent a message.",
    );
  } catch (error) {
    assertCondition(
      error instanceof
        AuthDeliveryUnavailableError,
      "The disabled adapter did not reject delivery safely.",
    );
  }

  console.log(
    "PASS: Provider-disabled delivery adapter completed.",
  );

  try {
    const registration =
      await registerCustomer({
        storefrontCode: "ATI",
        email,
        phone,
        password: oldPassword,
        firstName: "Recovery",
        lastName: "Audit",
        displayName:
          "Recovery Audit",
        marketingOptIn: false,
        termsAccepted: true,
        privacyAccepted: true,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }, capture);

    assertCondition(
      capture.emailVerifications
        .length === 1 &&
        capture.phoneVerifications
          .length === 1,
      "Initial registration verification was not delivered through both channels.",
    );

    assertCondition(
      capture.emailVerifications[0]
        .storefrontRoute ===
        "/ng/atiloszy" &&
        capture.phoneVerifications[0]
          .storefrontRoute ===
          "/ng/atiloszy",
      "Initial registration delivery was not scoped to the storefront route.",
    );

    console.log(
      "PASS: Initial registration email and phone delivery completed.",
    );

    const registrationTime =
      new Date();

    const resendTime = new Date(
      registrationTime.getTime() +
        2 *
          60 *
          1000,
    );

    await resendRegistrationVerification(
      {
        storefrontCode: "ATI",
        email,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      },
      capture,
      {
        now: resendTime,
      },
    );

    assertCondition(
      Number(
        capture.emailVerifications
          .length,
      ) === 2,
      "The email verification resend was not delivered.",
    );

    assertCondition(
      Number(
        capture.phoneVerifications
          .length,
      ) === 2,
      "The phone verification resend was not delivered.",
    );

    console.log(
      "PASS: Email and phone verification resend completed.",
    );

    await resendRegistrationVerification(
      {
        storefrontCode: "ATI",
        email,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      },
      capture,
      {
        now: new Date(
          resendTime.getTime() +
            10 *
              1000,
        ),
      },
    );

    assertCondition(
      Number(
        capture.emailVerifications
          .length,
      ) === 2 &&
      Number(
        capture.phoneVerifications
          .length,
      ) === 2,
      "The resend cooldown was not enforced.",
    );

    console.log(
      "PASS: Verification resend cooldown completed.",
    );

    const resentEmail =
      capture.emailVerifications[1];

    const resentPhone =
      capture.phoneVerifications[1];

    await verifyCustomerEmail({
      storefrontCode: "ATI",
      token:
        resentEmail.token,
      tokenSecret:
        AUDIT_TOKEN_SECRET,
    });

    const phoneVerification =
      await verifyCustomerPhone({
        storefrontCode: "ATI",
        challengeId:
          resentPhone.challengeId,
        code:
          resentPhone.code,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    assertCondition(
      phoneVerification.status ===
        "ACTIVE",
      "The resent challenges did not activate the account.",
    );

    console.log(
      "PASS: Resent verification challenges remained valid.",
    );

    const login =
      await loginCustomer({
        storefrontCode: "ATI",
        email,
        password: oldPassword,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    const recoveryTime = new Date(
      resendTime.getTime() +
        5 *
          60 *
          1000,
    );

    await requestPasswordReset(
      {
        storefrontCode: "ATI",
        email,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      },
      capture,
      {
        now: recoveryTime,
      },
    );

    assertCondition(
      capture.passwordResets
        .length === 1,
      "The password reset delivery was not created.",
    );

    const resetDelivery =
      capture.passwordResets[0];

    assertCondition(
      resetDelivery.token.length >=
        40,
      "The password reset token lacks sufficient entropy.",
    );

    console.log(
      "PASS: Password reset request and delivery completed.",
    );

    await requestPasswordReset(
      {
        storefrontCode: "ATI",
        email,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      },
      capture,
      {
        now: new Date(
          recoveryTime.getTime() +
            10 *
              1000,
        ),
      },
    );

    assertCondition(
      capture.passwordResets
        .length === 1,
      "The password reset cooldown was not enforced.",
    );

    await requestPasswordReset(
      {
        storefrontCode: "ATI",
        email: missingEmail,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      },
      capture,
      {
        now: recoveryTime,
      },
    );

    assertCondition(
      capture.passwordResets
        .length === 1,
      "A missing account triggered recovery delivery.",
    );

    console.log(
      "PASS: Recovery cooldown and generic missing-account handling completed.",
    );

    await expectAuthError(
      resetCustomerPassword({
        storefrontCode: "ATI",
        token:
          `${resetDelivery.token}-wrong`,
        newPassword,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "VERIFICATION_INVALID",
      "An invalid reset token was accepted.",
    );

    const reset =
      await resetCustomerPassword(
        {
          storefrontCode: "ATI",
          token:
            resetDelivery.token,
          newPassword,
          tokenSecret:
            AUDIT_TOKEN_SECRET,
        },
        {
          now: new Date(
            recoveryTime.getTime() +
              60 *
                1000,
          ),
        },
      );

    assertCondition(
      reset.userId ===
        registration.user.id,
      "The password reset updated the wrong user.",
    );

    assertCondition(
      reset.sessionsRevoked === 1,
      "The active customer session was not revoked.",
    );

    console.log(
      "PASS: Password replacement and session revocation completed.",
    );

    await expectAuthError(
      validateSession({
        storefrontCode: "ATI",
        sessionToken:
          login.sessionToken,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "SESSION_INVALID",
      "A pre-reset session remained valid.",
    );

    await expectAuthError(
      loginCustomer({
        storefrontCode: "ATI",
        email,
        password: oldPassword,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "INVALID_CREDENTIALS",
      "The old password remained valid.",
    );

    const newLogin =
      await loginCustomer({
        storefrontCode: "ATI",
        email,
        password: newPassword,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    assertCondition(
      newLogin.user.id ===
        registration.user.id,
      "The new password logged into the wrong account.",
    );

    await expectAuthError(
      resetCustomerPassword({
        storefrontCode: "ATI",
        token:
          resetDelivery.token,
        newPassword:
          `${newPassword}-second`,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "VERIFICATION_INVALID",
      "A password reset token was accepted twice.",
    );

    console.log(
      "PASS: Reset tokens are single use and the new password works.",
    );
  } finally {
    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    await prisma.customerAccount.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    console.log(
      "PASS: Temporary recovery audit records removed.",
    );
  }

  console.log(
    "PASS: Authentication recovery service audit completed.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
