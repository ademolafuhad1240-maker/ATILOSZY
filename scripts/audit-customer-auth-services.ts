import { randomBytes } from "node:crypto";

import { prisma } from "../src/lib/prisma";
import {
  AuthServiceError,
  hashPassword,
  loginCustomer,
  normalizeEmail,
  normalizePhone,
  registerCustomer,
  revokeAllUserSessions,
  revokeSession,
  validateSession,
  verifyCustomerEmail,
  verifyCustomerPhone,
  verifyPassword,
} from "../src/server/auth";

const AUDIT_TOKEN_SECRET =
  "sorvyra-auth-service-audit-secret-only-2026-07-26";

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
      error instanceof AuthServiceError &&
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
    "=== CUSTOMER AUTHENTICATION SERVICE AUDIT ===",
  );

  const storefronts =
    await prisma.storefront.findMany({
      where: {
        code: {
          in: ["ATI", "ZBF"],
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

  const atiloszy = storefronts.find(
    (storefront) =>
      storefront.code === "ATI",
  );

  const zeeBeauty = storefronts.find(
    (storefront) =>
      storefront.code === "ZBF",
  );

  assertCondition(
    atiloszy,
    "ATILOSZY storefront was not found.",
  );

  assertCondition(
    zeeBeauty,
    "ZEE Beauty storefront was not found.",
  );

  const suffix = randomBytes(9)
    .toString("hex");

  const emailInput =
    `Auth.Audit.${suffix}@Example.Test`;

  const normalizedEmail =
    normalizeEmail(emailInput);

  const phoneDigits =
    `${Date.now()}`.slice(-7);

  const phoneInput =
    `+234 700 ${phoneDigits}`;

  const normalizedPhone =
    normalizePhone(phoneInput);

  const password =
    `Audit-Passphrase-${suffix}`;

  const wrongPassword =
    `Wrong-Passphrase-${suffix}`;

  try {
    const passwordHash =
      await hashPassword(password);

    assertCondition(
      passwordHash !== password,
      "The password was stored as plaintext.",
    );

    assertCondition(
      await verifyPassword(
        password,
        passwordHash,
      ),
      "Password verification failed.",
    );

    assertCondition(
      !(await verifyPassword(
        wrongPassword,
        passwordHash,
      )),
      "An incorrect password was accepted.",
    );

    console.log(
      "PASS: Password hashing and verification completed.",
    );

    assertCondition(
      normalizedEmail ===
        emailInput.toLowerCase(),
      "Email normalization failed.",
    );

    assertCondition(
      normalizedPhone ===
        `+234700${phoneDigits}`,
      "Phone normalization failed.",
    );

    console.log(
      "PASS: Email and phone normalization completed.",
    );

    const atiloszyRegistration =
      await registerCustomer({
        storefrontCode: "ati",
        email: emailInput,
        phone: phoneInput,
        password,
        firstName: "Authentication",
        lastName: "Audit",
        displayName: "Auth Audit",
        marketingOptIn: false,
        termsAccepted: true,
        privacyAccepted: true,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    const storedUser =
      await prisma.user.findUnique({
        where: {
          id: atiloszyRegistration.user.id,
        },
        select: {
          passwordHash: true,
          status: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
        },
      });

    assertCondition(
      storedUser,
      "The registered user could not be read.",
    );

    assertCondition(
      storedUser.passwordHash !== password,
      "The registered password was stored as plaintext.",
    );

    assertCondition(
      storedUser.status ===
        "PENDING_VERIFICATION",
      "A new account did not begin pending verification.",
    );

    assertCondition(
      storedUser.emailVerifiedAt === null &&
        storedUser.phoneVerifiedAt === null,
      "A new account was unexpectedly verified.",
    );

    console.log(
      "PASS: Storefront-scoped registration completed.",
    );

    await expectAuthError(
      registerCustomer({
        storefrontCode: "ATI",
        email: emailInput,
        phone: phoneInput,
        password,
        firstName: "Duplicate",
        lastName: "Audit",
        termsAccepted: true,
        privacyAccepted: true,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "ACCOUNT_CONFLICT",
      "A duplicate storefront registration was accepted.",
    );

    console.log(
      "PASS: Duplicate storefront registration was rejected.",
    );

    const zeeRegistration =
      await registerCustomer({
        storefrontCode: "ZBF",
        email: emailInput,
        phone: phoneInput,
        password,
        firstName: "Authentication",
        lastName: "Audit",
        termsAccepted: true,
        privacyAccepted: true,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    assertCondition(
      zeeRegistration.user.id !==
        atiloszyRegistration.user.id,
      "Cross-store registrations shared a user ID.",
    );

    const crossStoreCount =
      await prisma.user.count({
        where: {
          normalizedEmail,
        },
      });

    assertCondition(
      crossStoreCount === 2,
      "The same identity was not isolated across storefronts.",
    );

    console.log(
      "PASS: The same identity remained isolated across storefronts.",
    );

    await expectAuthError(
      loginCustomer({
        storefrontCode: "ATI",
        email: emailInput,
        password,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "VERIFICATION_REQUIRED",
      "An unverified account was permitted to log in.",
    );

    console.log(
      "PASS: Login was blocked before both verifications.",
    );

    const incorrectPhoneCode =
      atiloszyRegistration
        .phoneVerificationCode === "000000"
        ? "111111"
        : "000000";

    await expectAuthError(
      verifyCustomerPhone({
        storefrontCode: "ATI",
        challengeId:
          atiloszyRegistration
            .phoneChallengeId,
        code: incorrectPhoneCode,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "VERIFICATION_INVALID",
      "An incorrect phone code was accepted.",
    );

    const phoneChallenge =
      await prisma.phoneVerification.findUnique({
        where: {
          challengeId:
            atiloszyRegistration
              .phoneChallengeId,
        },
        select: {
          attemptCount: true,
        },
      });

    assertCondition(
      phoneChallenge?.attemptCount === 1,
      "An incorrect phone attempt was not recorded.",
    );

    console.log(
      "PASS: Incorrect phone verification attempts are tracked.",
    );

    const emailVerification =
      await verifyCustomerEmail({
        storefrontCode: "ATI",
        token:
          atiloszyRegistration
            .emailVerificationToken,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    assertCondition(
      emailVerification.emailVerified,
      "Email verification did not complete.",
    );

    assertCondition(
      !emailVerification.phoneVerified,
      "Phone verification completed unexpectedly.",
    );

    assertCondition(
      emailVerification.status ===
        "PENDING_VERIFICATION",
      "The account activated before phone verification.",
    );

    await expectAuthError(
      verifyCustomerEmail({
        storefrontCode: "ATI",
        token:
          atiloszyRegistration
            .emailVerificationToken,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "VERIFICATION_INVALID",
      "A consumed email token was accepted twice.",
    );

    console.log(
      "PASS: Email verification tokens are single use.",
    );

    const phoneVerification =
      await verifyCustomerPhone({
        storefrontCode: "ATI",
        challengeId:
          atiloszyRegistration
            .phoneChallengeId,
        code:
          atiloszyRegistration
            .phoneVerificationCode,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    assertCondition(
      phoneVerification.emailVerified &&
        phoneVerification.phoneVerified,
      "Both verification requirements were not completed.",
    );

    assertCondition(
      phoneVerification.status === "ACTIVE",
      "The verified account did not activate.",
    );

    console.log(
      "PASS: Account activation requires email and phone verification.",
    );

    for (
      let attempt = 1;
      attempt <= 5;
      attempt += 1
    ) {
      await expectAuthError(
        loginCustomer({
          storefrontCode: "ATI",
          email: emailInput,
          password: wrongPassword,
          tokenSecret:
            AUDIT_TOKEN_SECRET,
        }),
        attempt < 5
          ? "INVALID_CREDENTIALS"
          : "ACCOUNT_LOCKED",
        `Failed login attempt ${attempt} was not handled correctly.`,
      );
    }

    await expectAuthError(
      loginCustomer({
        storefrontCode: "ATI",
        email: emailInput,
        password,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "ACCOUNT_LOCKED",
      "A locked account accepted the correct password.",
    );

    const lockedUser =
      await prisma.user.findUnique({
        where: {
          id: atiloszyRegistration.user.id,
        },
        select: {
          failedLoginAttempts: true,
          lockedUntil: true,
        },
      });

    assertCondition(
      lockedUser?.failedLoginAttempts === 5,
      "Failed login attempts were not counted correctly.",
    );

    assertCondition(
      lockedUser.lockedUntil !== null,
      "The account was not temporarily locked.",
    );

    console.log(
      "PASS: Login attempt protection and temporary lockout completed.",
    );

    await prisma.user.update({
      where: {
        id: atiloszyRegistration.user.id,
      },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const login = await loginCustomer({
      storefrontCode: "ATI",
      email: emailInput,
      password,
      tokenSecret:
        AUDIT_TOKEN_SECRET,
      ipAddress: "127.0.0.1",
      userAgent:
        "SORVYRA authentication audit",
      sessionTtlMinutes: 60,
    });

    assertCondition(
      login.sessionToken.length >= 40,
      "The session token lacks sufficient entropy.",
    );

    const storedSession =
      await prisma.session.findUnique({
        where: {
          id: login.session.id,
        },
        select: {
          tokenHash: true,
        },
      });

    assertCondition(
      storedSession,
      "The session record was not created.",
    );

    assertCondition(
      storedSession.tokenHash !==
        login.sessionToken,
      "The raw session token was stored in the database.",
    );

    const validated =
      await validateSession({
        storefrontCode: "ATI",
        sessionToken:
          login.sessionToken,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    assertCondition(
      validated.userId ===
        atiloszyRegistration.user.id,
      "Session validation returned the wrong user.",
    );

    console.log(
      "PASS: Secure session creation and validation completed.",
    );

    const revoked = await revokeSession({
      storefrontCode: "ATI",
      sessionToken:
        login.sessionToken,
      tokenSecret:
        AUDIT_TOKEN_SECRET,
      reason: "AUTH_AUDIT_LOGOUT",
    });

    assertCondition(
      revoked,
      "The session was not revoked.",
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
      "A revoked session remained valid.",
    );

    console.log(
      "PASS: Individual session revocation completed.",
    );

    const secondLogin =
      await loginCustomer({
        storefrontCode: "ATI",
        email: emailInput,
        password,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    const thirdLogin =
      await loginCustomer({
        storefrontCode: "ATI",
        email: emailInput,
        password,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      });

    const revokedCount =
      await revokeAllUserSessions({
        storefrontCode: "ATI",
        userId:
          atiloszyRegistration.user.id,
        reason: "AUTH_AUDIT_REVOKE_ALL",
      });

    assertCondition(
      revokedCount === 2,
      "All active sessions were not revoked.",
    );

    await expectAuthError(
      validateSession({
        storefrontCode: "ATI",
        sessionToken:
          secondLogin.sessionToken,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "SESSION_INVALID",
      "A bulk-revoked session remained valid.",
    );

    await expectAuthError(
      validateSession({
        storefrontCode: "ATI",
        sessionToken:
          thirdLogin.sessionToken,
        tokenSecret:
          AUDIT_TOKEN_SECRET,
      }),
      "SESSION_INVALID",
      "A second bulk-revoked session remained valid.",
    );

    console.log(
      "PASS: All-session revocation completed.",
    );
  } finally {
    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    console.log(
      "PASS: Temporary authentication audit records removed.",
    );
  }

  console.log(
    "PASS: Customer authentication service audit completed.",
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
