import { randomUUID } from "node:crypto";

import { prisma } from "../src/lib/prisma";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function hasPrismaCode(
  error: unknown,
  expectedCode: string,
): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return false;
  }

  return (
    (error as { code?: unknown }).code === expectedCode
  );
}

async function main(): Promise<void> {
  console.log("=== CUSTOMER IDENTITY FOUNDATION AUDIT ===");

  const storefronts = await prisma.storefront.findMany({
    where: {
      code: {
        in: ["ATI", "ZBF"],
      },
    },
    select: {
      id: true,
      code: true,
      countryCode: true,
      name: true,
    },
  });

  const atiloszy = storefronts.find(
    (storefront) => storefront.code === "ATI",
  );

  const zeeBeauty = storefronts.find(
    (storefront) => storefront.code === "ZBF",
  );

  assertCondition(
    atiloszy,
    "ATILOSZY storefront was not found.",
  );

  assertCondition(
    zeeBeauty,
    "ZEE Beauty storefront was not found.",
  );

  const suffix = randomUUID()
    .replace(/-/g, "")
    .slice(0, 18);

  const phoneDigits = `${Date.now()}`.slice(-9);

  const email =
    `identity-audit-${suffix}@example.test`;

  const phone =
    `+234700${phoneDigits}`;

  const passwordHash =
    `audit-password-hash-${suffix}`;

  const expiresAt = new Date(
    Date.now() + 15 * 60 * 1000,
  );

  try {
    const firstUser = await prisma.user.create({
      data: {
        storefrontId: atiloszy.id,
        email,
        normalizedEmail: email.toLowerCase(),
        phone,
        normalizedPhone: phone,
        passwordHash,
        customer: {
          create: {
            firstName: "Identity",
            lastName: "Audit",
            displayName: "Identity Audit",
            marketingOptIn: false,
            termsAcceptedAt: new Date(),
            privacyAcceptedAt: new Date(),
          },
        },
        security: {
          create: {
            twoFactorEnabled: false,
            loginAlertsEnabled: true,
          },
        },
        addresses: {
          create: {
            countryCode: atiloszy.countryCode,
            type: "BOTH",
            label: "Audit address",
            recipientFirstName: "Identity",
            recipientLastName: "Audit",
            recipientPhone: phone,
            addressLine1: "Audit address only",
            city: "Osogbo",
            stateOrProvince: "Osun",
            isDefaultShipping: true,
            isDefaultBilling: true,
          },
        },
        sessions: {
          create: {
            tokenHash: `audit-session-${suffix}`,
            expiresAt,
            ipAddress: "127.0.0.1",
            userAgent: "SORVYRA identity audit",
          },
        },
        emailVerifications: {
          create: {
            email,
            tokenHash: `audit-email-${suffix}`,
            purpose: "REGISTRATION",
            expiresAt,
          },
        },
        phoneVerifications: {
          create: {
            phone,
            challengeId: `audit-phone-${suffix}`,
            codeHash: `audit-code-hash-${suffix}`,
            purpose: "REGISTRATION",
            expiresAt,
          },
        },
      },
    });

    const secondUser = await prisma.user.create({
      data: {
        storefrontId: zeeBeauty.id,
        email,
        normalizedEmail: email.toLowerCase(),
        phone,
        normalizedPhone: phone,
        passwordHash,
        customer: {
          create: {
            firstName: "Identity",
            lastName: "Audit",
            marketingOptIn: false,
            termsAcceptedAt: new Date(),
            privacyAcceptedAt: new Date(),
          },
        },
        security: {
          create: {
          },
        },
      },
    });

    assertCondition(
      firstUser.id !== secondUser.id,
      "Separate storefront registrations shared an ID.",
    );

    const crossStoreCount = await prisma.user.count({
      where: {
        normalizedEmail: email.toLowerCase(),
      },
    });

    assertCondition(
      crossStoreCount === 2,
      "The same email was not accepted independently across two storefronts.",
    );

    console.log(
      "PASS: The same email and phone can register separately across storefronts.",
    );

    let duplicateRejected = false;

    try {
      await prisma.user.create({
        data: {
          storefrontId: atiloszy.id,
          email,
          normalizedEmail: email.toLowerCase(),
          phone,
          normalizedPhone: phone,
          passwordHash,
        },
      });
    } catch (error) {
      if (!hasPrismaCode(error, "P2002")) {
        throw error;
      }

      duplicateRejected = true;
    }

    assertCondition(
      duplicateRejected,
      "A duplicate storefront account was not rejected.",
    );

    console.log(
      "PASS: Duplicate email or phone within one storefront was rejected.",
    );

    let crossStoreRelationRejected = false;

    try {
      await prisma.customerAddress.create({
        data: {
          userId: firstUser.id,
          storefrontId: zeeBeauty.id,
          countryCode: zeeBeauty.countryCode,
          type: "SHIPPING",
          recipientFirstName: "Invalid",
          recipientLastName: "Relation",
          recipientPhone: phone,
          addressLine1: "This record must not be created",
          city: "Osogbo",
        },
      });
    } catch (error) {
      if (!hasPrismaCode(error, "P2003")) {
        throw error;
      }

      crossStoreRelationRejected = true;
    }

    assertCondition(
      crossStoreRelationRejected,
      "A cross-store customer relation was not rejected.",
    );

    console.log(
      "PASS: Cross-store customer data attachment was rejected.",
    );

    const loadedUser = await prisma.user.findUnique({
      where: {
        id: firstUser.id,
      },
      include: {
        customer: true,
        security: true,
        addresses: true,
        sessions: true,
        emailVerifications: true,
        phoneVerifications: true,
      },
    });

    assertCondition(
      loadedUser,
      "The customer account could not be read.",
    );

    assertCondition(
      loadedUser.status === "PENDING_VERIFICATION",
      "New users must begin pending verification.",
    );

    assertCondition(
      loadedUser.emailVerifiedAt === null,
      "The audit user was unexpectedly email verified.",
    );

    assertCondition(
      loadedUser.phoneVerifiedAt === null,
      "The audit user was unexpectedly phone verified.",
    );

    assertCondition(
      loadedUser.customer?.storefrontId === atiloszy.id,
      "Customer profile storefront scope is invalid.",
    );

    assertCondition(
      loadedUser.security?.twoFactorEnabled === false,
      "Customer 2FA must begin disabled.",
    );

    assertCondition(
      loadedUser.addresses.length === 1,
      "Customer address relationship failed.",
    );

    assertCondition(
      loadedUser.sessions.length === 1,
      "Customer session relationship failed.",
    );

    assertCondition(
      loadedUser.emailVerifications.length === 1,
      "Email verification relationship failed.",
    );

    assertCondition(
      loadedUser.phoneVerifications.length === 1,
      "Phone verification relationship failed.",
    );

    console.log(
      "PASS: Customer profile and security settings completed.",
    );

    console.log(
      "PASS: Address and storefront scoping completed.",
    );

    console.log(
      "PASS: Session foundation completed.",
    );

    console.log(
      "PASS: Email and phone verification foundations completed.",
    );
  } finally {
    await prisma.user.deleteMany({
      where: {
        normalizedEmail: email.toLowerCase(),
      },
    });

    console.log(
      "PASS: Temporary customer identity audit records removed.",
    );
  }

  console.log(
    "PASS: Customer identity foundation audit completed.",
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
