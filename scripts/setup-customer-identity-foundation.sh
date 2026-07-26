#!/usr/bin/env bash

set -Eeuo pipefail

echo "=== VERIFY CLEAN CHECKPOINT ==="

EXPECTED_BRANCH="feat/commerce-foundation"
CURRENT_BRANCH="$(git branch --show-current)"

if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "Expected branch: $EXPECTED_BRANCH"
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

UNEXPECTED_CHANGES="$(
  git status --porcelain |
  grep -v '^?? scripts/setup-customer-identity-foundation.sh$' ||
  true
)"

if [ -n "$UNEXPECTED_CHANGES" ]; then
  echo "Unexpected repository changes exist:"
  printf '%s\n' "$UNEXPECTED_CHANGES"
  exit 1
fi

echo "Branch: $CURRENT_BRANCH"
echo "Starting commit: $(git rev-parse --short HEAD)"
echo "PASS: No unexpected repository changes found."

echo
echo "=== ADD CUSTOMER IDENTITY SCHEMA ==="

python - <<'PY'
from pathlib import Path

path = Path("prisma/schema.prisma")
schema = path.read_text(encoding="utf-8")

if "model User {" in schema:
    raise RuntimeError(
        "Customer identity models already appear to exist."
    )

enum_block = """enum UserStatus {
  PENDING_VERIFICATION
  ACTIVE
  SUSPENDED
  DELETED
}

enum VerificationPurpose {
  REGISTRATION
  EMAIL_CHANGE
  PHONE_CHANGE
  PASSWORD_RESET
  TWO_FACTOR_RECOVERY
}

enum CustomerAddressType {
  SHIPPING
  BILLING
  BOTH
}

"""

currency_marker = "model Currency {"

if currency_marker not in schema:
    raise RuntimeError("Could not locate the Currency model.")

schema = schema.replace(
    currency_marker,
    enum_block + currency_marker,
    1,
)

country_old = """  storefronts      Storefront[]
  createdAt        DateTime     @default(now())"""

country_new = """  storefronts      Storefront[]
  customerAddresses CustomerAddress[]
  createdAt        DateTime     @default(now())"""

if country_old not in schema:
    raise RuntimeError(
        "Could not locate the Country relation insertion point."
    )

schema = schema.replace(
    country_old,
    country_new,
    1,
)

storefront_old = """  inventories       Inventory[]
  createdAt         DateTime                      @default(now())"""

storefront_new = """  inventories       Inventory[]
  users             User[]
  customers         StorefrontCustomer[]
  customerSecurity  CustomerSecuritySettings[]
  customerAddresses CustomerAddress[]
  customerSessions  Session[]
  emailVerifications EmailVerification[]
  phoneVerifications PhoneVerification[]
  createdAt         DateTime                      @default(now())"""

if storefront_old not in schema:
    raise RuntimeError(
        "Could not locate the Storefront relation insertion point."
    )

schema = schema.replace(
    storefront_old,
    storefront_new,
    1,
)

models = r"""

model User {
  id                    String                     @id @default(cuid())
  storefrontId          String
  email                 String                     @db.VarChar(254)
  normalizedEmail       String                     @db.VarChar(254)
  phone                 String                     @db.VarChar(32)
  normalizedPhone       String                     @db.VarChar(32)
  passwordHash          String                     @db.VarChar(255)
  status                UserStatus                 @default(PENDING_VERIFICATION)
  emailVerifiedAt       DateTime?
  phoneVerifiedAt       DateTime?
  lastLoginAt           DateTime?
  failedLoginAttempts   Int                        @default(0)
  lockedUntil           DateTime?
  sessionVersion        Int                        @default(1)
  deletedAt             DateTime?
  storefront            Storefront                 @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  customer              StorefrontCustomer?
  security              CustomerSecuritySettings?
  addresses             CustomerAddress[]
  sessions              Session[]
  emailVerifications    EmailVerification[]
  phoneVerifications    PhoneVerification[]
  createdAt             DateTime                   @default(now())
  updatedAt             DateTime                   @updatedAt

  @@unique([storefrontId, normalizedEmail])
  @@unique([storefrontId, normalizedPhone])
  @@unique([id, storefrontId])
  @@index([storefrontId, status])
  @@index([normalizedEmail])
  @@index([normalizedPhone])
  @@index([emailVerifiedAt, phoneVerifiedAt])
  @@map("users")
}

model StorefrontCustomer {
  id                 String     @id @default(cuid())
  userId             String
  storefrontId       String
  firstName          String
  lastName           String
  displayName        String?
  marketingOptIn     Boolean    @default(false)
  marketingOptInAt   DateTime?
  termsAcceptedAt    DateTime
  privacyAcceptedAt  DateTime
  user               User       @relation(fields: [userId, storefrontId], references: [id, storefrontId], onDelete: Cascade, onUpdate: Cascade)
  storefront         Storefront @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  @@unique([userId, storefrontId])
  @@index([storefrontId, createdAt])
  @@map("storefront_customers")
}

model CustomerSecuritySettings {
  id                        String     @id @default(cuid())
  userId                    String
  storefrontId              String
  twoFactorEnabled          Boolean    @default(false)
  twoFactorSecretCiphertext String?
  twoFactorRecoveryData     Json?
  twoFactorConfirmedAt      DateTime?
  loginAlertsEnabled        Boolean    @default(true)
  passwordChangedAt         DateTime?
  user                      User       @relation(fields: [userId, storefrontId], references: [id, storefrontId], onDelete: Cascade, onUpdate: Cascade)
  storefront                Storefront @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  createdAt                 DateTime   @default(now())
  updatedAt                 DateTime   @updatedAt

  @@unique([userId, storefrontId])
  @@index([storefrontId, twoFactorEnabled])
  @@map("customer_security_settings")
}

model CustomerAddress {
  id                 String              @id @default(cuid())
  userId             String
  storefrontId       String
  countryCode        String              @db.VarChar(2)
  type               CustomerAddressType @default(SHIPPING)
  label              String?
  recipientFirstName String
  recipientLastName  String
  recipientPhone     String              @db.VarChar(32)
  addressLine1       String
  addressLine2       String?
  city               String
  stateOrProvince    String?
  postalCode         String?             @db.VarChar(32)
  deliveryNotes      String?
  isDefaultShipping  Boolean             @default(false)
  isDefaultBilling   Boolean             @default(false)
  deletedAt          DateTime?
  user               User                @relation(fields: [userId, storefrontId], references: [id, storefrontId], onDelete: Cascade, onUpdate: Cascade)
  storefront         Storefront          @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  country            Country             @relation(fields: [countryCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  @@index([userId, storefrontId])
  @@index([storefrontId, city])
  @@index([countryCode])
  @@index([isDefaultShipping, isDefaultBilling])
  @@map("customer_addresses")
}

model Session {
  id             String     @id @default(cuid())
  userId         String
  storefrontId   String
  tokenHash      String     @unique @db.VarChar(128)
  expiresAt      DateTime
  lastSeenAt     DateTime?
  revokedAt      DateTime?
  revokedReason  String?
  ipAddress      String?    @db.VarChar(64)
  userAgent      String?
  user           User       @relation(fields: [userId, storefrontId], references: [id, storefrontId], onDelete: Cascade, onUpdate: Cascade)
  storefront     Storefront @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@index([userId, storefrontId, expiresAt])
  @@index([storefrontId, revokedAt])
  @@map("sessions")
}

model EmailVerification {
  id           String              @id @default(cuid())
  userId       String
  storefrontId String
  email        String              @db.VarChar(254)
  tokenHash    String              @unique @db.VarChar(128)
  purpose      VerificationPurpose @default(REGISTRATION)
  expiresAt    DateTime
  consumedAt   DateTime?
  attemptCount Int                 @default(0)
  user         User                @relation(fields: [userId, storefrontId], references: [id, storefrontId], onDelete: Cascade, onUpdate: Cascade)
  storefront   Storefront          @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  createdAt    DateTime            @default(now())

  @@index([userId, storefrontId, purpose, expiresAt])
  @@index([email, consumedAt])
  @@map("email_verifications")
}

model PhoneVerification {
  id           String              @id @default(cuid())
  userId       String
  storefrontId String
  phone        String              @db.VarChar(32)
  challengeId  String              @unique @db.VarChar(128)
  codeHash     String              @db.VarChar(128)
  purpose      VerificationPurpose @default(REGISTRATION)
  expiresAt    DateTime
  consumedAt   DateTime?
  attemptCount Int                 @default(0)
  maxAttempts  Int                 @default(5)
  user         User                @relation(fields: [userId, storefrontId], references: [id, storefrontId], onDelete: Cascade, onUpdate: Cascade)
  storefront   Storefront          @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  createdAt    DateTime            @default(now())

  @@index([userId, storefrontId, purpose, expiresAt])
  @@index([phone, consumedAt])
  @@map("phone_verifications")
}
"""

schema = schema.rstrip() + models + "\n"

path.write_text(schema, encoding="utf-8")

print("Added customer identity models and storefront relations.")
PY

echo
echo "=== CREATE CUSTOMER IDENTITY AUDIT ==="

cat > scripts/audit-customer-identity.ts <<'TS'
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
TS

echo
echo "=== REGISTER IDENTITY AUDIT COMMAND ==="

npm pkg set \
  "scripts.db:audit:identity=node --env-file=.env --conditions=react-server --import tsx scripts/audit-customer-identity.ts"

echo
echo "=== FORMAT AND VALIDATE PRISMA SCHEMA ==="

npx prisma format

npm run db:up
npm run db:validate
npm run db:generate

echo
echo "=== CREATE CUSTOMER IDENTITY MIGRATION ==="

npx prisma migrate dev \
  --name customer_identity_foundation

echo
echo "=== RUN CUSTOMER IDENTITY AUDIT ==="

npm run db:audit:identity

echo
echo "=== RUN EXISTING COMMERCE AUDITS ==="

npm run db:audit
npm run db:audit:catalog
npm run db:audit:services

echo
echo "=== RUN APPLICATION VALIDATION ==="

npm run lint
npm run build

echo
echo "=== VERIFY MIGRATION STATUS ==="

npx prisma migrate status

echo
echo "=== VALIDATE REPOSITORY CHANGES ==="

git diff --check
git status --short

echo
echo "PHASE 2E-A CUSTOMER IDENTITY FOUNDATION PASSED"
