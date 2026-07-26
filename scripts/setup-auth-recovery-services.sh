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
  grep -v '^?? scripts/setup-auth-recovery-services.sh$' ||
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
echo "=== VERIFY IDENTITY FOUNDATION SUPPORT ==="

python - <<'PY'
from pathlib import Path

schema = Path(
    "prisma/schema.prisma"
).read_text(
    encoding="utf-8",
)

required = [
    "model EmailVerification",
    "model PhoneVerification",
    "PASSWORD_RESET",
    "REGISTRATION",
    "sessionVersion",
    "failedLoginAttempts",
    "lockedUntil",
]

for value in required:
    if value not in schema:
        raise RuntimeError(
            f"Required identity foundation value is missing: {value}"
        )

print(
    "PASS: Existing identity schema supports recovery services."
)
PY

echo
echo "=== CONFIGURE DISABLED LOCAL DELIVERY ADAPTER ==="

python - <<'PY'
from pathlib import Path

path = Path(".env")
content = path.read_text(
    encoding="utf-8",
)

entries = [
    "AUTH_DELIVERY_PROVIDER=disabled",
    "AUTH_EMAIL_FROM=",
    "AUTH_SMS_SENDER=",
]

existing_keys = {
    line.split("=", 1)[0]
    for line in content.splitlines()
    if "=" in line
}

new_entries = [
    entry
    for entry in entries
    if entry.split("=", 1)[0]
    not in existing_keys
]

if new_entries:
    updated = content.rstrip()

    if updated:
        updated += "\n"

    updated += "\n".join(new_entries)
    updated += "\n"

    path.write_text(
        updated,
        encoding="utf-8",
    )

    print(
        "Added disabled local delivery settings "
        "without exposing credentials."
    )
else:
    print(
        "Local delivery settings already exist."
    )
PY

if ! git check-ignore -q .env; then
  echo "The local .env file is not ignored by Git."
  exit 1
fi

echo
echo "=== UPDATE SAFE ENVIRONMENT TEMPLATE ==="

python - <<'PY'
from pathlib import Path

path = Path(".env.example")

content = (
    path.read_text(encoding="utf-8")
    if path.exists()
    else ""
)

entries = [
    "AUTH_DELIVERY_PROVIDER=disabled",
    "AUTH_EMAIL_FROM=",
    "AUTH_SMS_SENDER=",
]

existing_keys = {
    line.split("=", 1)[0]
    for line in content.splitlines()
    if "=" in line
}

new_entries = [
    entry
    for entry in entries
    if entry.split("=", 1)[0]
    not in existing_keys
]

if new_entries:
    updated = content.rstrip()

    if updated:
        updated += "\n\n"

    updated += (
        "# Verification and recovery delivery\n"
        + "\n".join(new_entries)
        + "\n"
    )

    path.write_text(
        updated,
        encoding="utf-8",
    )

    print(
        "Added safe delivery placeholders to .env.example."
    )
else:
    print(
        ".env.example already contains delivery placeholders."
    )
PY

echo
echo "=== CREATE DELIVERY ABSTRACTION ==="

cat > src/server/auth/delivery.ts <<'TS'
import "server-only";

export interface EmailVerificationDelivery {
  storefrontCode: string;
  storefrontName: string;
  recipientEmail: string;
  token: string;
  expiresAt: Date;
}

export interface PhoneVerificationDelivery {
  storefrontCode: string;
  storefrontName: string;
  recipientPhone: string;
  challengeId: string;
  code: string;
  expiresAt: Date;
}

export interface PasswordResetDelivery {
  storefrontCode: string;
  storefrontName: string;
  recipientEmail: string;
  token: string;
  expiresAt: Date;
}

export interface AuthDeliveryProvider {
  readonly name: string;
  readonly enabled: boolean;

  sendEmailVerification(
    delivery: EmailVerificationDelivery,
  ): Promise<void>;

  sendPhoneVerification(
    delivery: PhoneVerificationDelivery,
  ): Promise<void>;

  sendPasswordReset(
    delivery: PasswordResetDelivery,
  ): Promise<void>;
}

export class AuthDeliveryUnavailableError
  extends Error {
  readonly code =
    "AUTH_DELIVERY_UNAVAILABLE";

  constructor(
    message =
      "Authentication message delivery is unavailable.",
  ) {
    super(message);

    this.name =
      "AuthDeliveryUnavailableError";
  }
}

export function isAuthDeliveryUnavailableError(
  error: unknown,
): error is AuthDeliveryUnavailableError {
  return (
    error instanceof
    AuthDeliveryUnavailableError
  );
}

export function createDisabledAuthDeliveryProvider(): AuthDeliveryProvider {
  async function unavailable(): Promise<never> {
    throw new AuthDeliveryUnavailableError();
  }

  return {
    name: "disabled",
    enabled: false,
    sendEmailVerification: unavailable,
    sendPhoneVerification: unavailable,
    sendPasswordReset: unavailable,
  };
}

export function getAuthDeliveryProvider(): AuthDeliveryProvider {
  const configuredProvider = (
    process.env.AUTH_DELIVERY_PROVIDER ??
    "disabled"
  )
    .trim()
    .toLowerCase();

  if (
    configuredProvider === "" ||
    configuredProvider === "disabled"
  ) {
    return createDisabledAuthDeliveryProvider();
  }

  throw new Error(
    `Unsupported AUTH_DELIVERY_PROVIDER: ${configuredProvider}`,
  );
}

export function assertAuthDeliveryEnabled(
  provider: AuthDeliveryProvider,
): void {
  if (!provider.enabled) {
    throw new AuthDeliveryUnavailableError();
  }
}
TS

echo
echo "=== CREATE RECOVERY SERVICE TYPES ==="

cat > src/server/auth/recovery-types.ts <<'TS'
export interface GenericRecoveryResult {
  accepted: true;
}

export interface ResetPasswordResult {
  userId: string;
  storefrontId: string;
  sessionsRevoked: number;
}

export interface RecoveryClockOptions {
  now?: Date;
}

export interface RequestPasswordResetInput {
  storefrontCode: string;
  email: string;
  tokenSecret: string;
}

export interface ResetCustomerPasswordInput {
  storefrontCode: string;
  token: string;
  newPassword: string;
  tokenSecret: string;
}

export interface ResendRegistrationVerificationInput {
  storefrontCode: string;
  email: string;
  tokenSecret: string;
}
TS

echo
echo "=== CREATE PASSWORD RECOVERY SERVICES ==="

cat > src/server/auth/recovery.ts <<'TS'
import "server-only";

import { prisma } from "../../lib/prisma";

import {
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  normalizeStorefrontCode,
} from "./crypto";
import {
  type AuthDeliveryProvider,
  assertAuthDeliveryEnabled,
} from "./delivery";
import {
  AuthServiceError,
} from "./errors";
import type {
  GenericRecoveryResult,
  RecoveryClockOptions,
  RequestPasswordResetInput,
  ResetCustomerPasswordInput,
  ResetPasswordResult,
} from "./recovery-types";

const PASSWORD_RESET_EXPIRY_MINUTES = 30;
const PASSWORD_RESET_COOLDOWN_SECONDS = 60;
const PASSWORD_RESET_LIMIT_WINDOW_MINUTES =
  60;
const PASSWORD_RESET_LIMIT_PER_WINDOW = 3;

const GENERIC_ACCEPTED_RESULT:
  GenericRecoveryResult = {
    accepted: true,
  };

function resolveNow(
  options?: RecoveryClockOptions,
): Date {
  return options?.now
    ? new Date(options.now)
    : new Date();
}

export async function requestPasswordReset(
  input: RequestPasswordResetInput,
  deliveryProvider: AuthDeliveryProvider,
  options?: RecoveryClockOptions,
): Promise<GenericRecoveryResult> {
  assertAuthDeliveryEnabled(
    deliveryProvider,
  );

  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const normalizedEmail =
    normalizeEmail(input.email);

  const storefront =
    await prisma.storefront.findUnique({
      where: {
        code: storefrontCode,
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });

  if (
    !storefront ||
    storefront.status !== "ACTIVE"
  ) {
    return GENERIC_ACCEPTED_RESULT;
  }

  const user = await prisma.user.findUnique({
    where: {
      storefrontId_normalizedEmail: {
        storefrontId: storefront.id,
        normalizedEmail,
      },
    },
    select: {
      id: true,
      storefrontId: true,
      normalizedEmail: true,
      status: true,
      emailVerifiedAt: true,
      deletedAt: true,
    },
  });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.emailVerifiedAt === null ||
    user.deletedAt !== null
  ) {
    return GENERIC_ACCEPTED_RESULT;
  }

  const now = resolveNow(options);

  const cooldownCutoff = new Date(
    now.getTime() -
      PASSWORD_RESET_COOLDOWN_SECONDS *
        1000,
  );

  const latestRequest =
    await prisma.emailVerification.findFirst(
      {
        where: {
          userId: user.id,
          storefrontId:
            user.storefrontId,
          purpose: "PASSWORD_RESET",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
      },
    );

  if (
    latestRequest &&
    latestRequest.createdAt >
      cooldownCutoff
  ) {
    return GENERIC_ACCEPTED_RESULT;
  }

  const windowCutoff = new Date(
    now.getTime() -
      PASSWORD_RESET_LIMIT_WINDOW_MINUTES *
        60 *
        1000,
  );

  const recentRequestCount =
    await prisma.emailVerification.count({
      where: {
        userId: user.id,
        storefrontId:
          user.storefrontId,
        purpose: "PASSWORD_RESET",
        createdAt: {
          gte: windowCutoff,
        },
      },
    });

  if (
    recentRequestCount >=
    PASSWORD_RESET_LIMIT_PER_WINDOW
  ) {
    return GENERIC_ACCEPTED_RESULT;
  }

  const token = createOpaqueToken();

  const tokenHash = hashOpaqueToken(
    token,
    input.tokenSecret,
  );

  const expiresAt = new Date(
    now.getTime() +
      PASSWORD_RESET_EXPIRY_MINUTES *
        60 *
        1000,
  );

  const verification =
    await prisma.$transaction(
      async (transaction) => {
        await transaction.emailVerification.updateMany(
          {
            where: {
              userId: user.id,
              storefrontId:
                user.storefrontId,
              purpose:
                "PASSWORD_RESET",
              consumedAt: null,
            },
            data: {
              consumedAt: now,
            },
          },
        );

        return transaction.emailVerification.create(
          {
            data: {
              userId: user.id,
              storefrontId:
                user.storefrontId,
              email:
                user.normalizedEmail,
              tokenHash,
              purpose:
                "PASSWORD_RESET",
              expiresAt,
              createdAt: now,
            },
            select: {
              id: true,
            },
          },
        );
      },
    );

  try {
    await deliveryProvider.sendPasswordReset(
      {
        storefrontCode:
          storefront.code,
        storefrontName:
          storefront.name,
        recipientEmail:
          user.normalizedEmail,
        token,
        expiresAt,
      },
    );
  } catch (error) {
    await prisma.emailVerification.updateMany(
      {
        where: {
          id: verification.id,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      },
    );

    throw error;
  }

  return GENERIC_ACCEPTED_RESULT;
}

export async function resetCustomerPassword(
  input: ResetCustomerPasswordInput,
  options?: RecoveryClockOptions,
): Promise<ResetPasswordResult> {
  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const tokenHash = hashOpaqueToken(
    input.token,
    input.tokenSecret,
  );

  const newPasswordHash =
    await hashPassword(
      input.newPassword,
    );

  const record =
    await prisma.emailVerification.findUnique(
      {
        where: {
          tokenHash,
        },
        include: {
          storefront: {
            select: {
              code: true,
              status: true,
            },
          },
          user: {
            select: {
              id: true,
              storefrontId: true,
              normalizedEmail: true,
              status: true,
              deletedAt: true,
            },
          },
        },
      },
    );

  const now = resolveNow(options);

  if (
    !record ||
    record.purpose !==
      "PASSWORD_RESET" ||
    record.storefront.code !==
      storefrontCode ||
    record.storefront.status !==
      "ACTIVE" ||
    record.consumedAt !== null ||
    record.expiresAt <= now ||
    record.user.status !== "ACTIVE" ||
    record.user.deletedAt !== null ||
    normalizeEmail(record.email) !==
      record.user.normalizedEmail
  ) {
    throw new AuthServiceError(
      "VERIFICATION_INVALID",
      "The password reset request is invalid or expired.",
    );
  }

  return prisma.$transaction(
    async (transaction) => {
      const consumed =
        await transaction.emailVerification.updateMany(
          {
            where: {
              id: record.id,
              purpose:
                "PASSWORD_RESET",
              consumedAt: null,
              expiresAt: {
                gt: now,
              },
            },
            data: {
              consumedAt: now,
            },
          },
        );

      if (consumed.count !== 1) {
        throw new AuthServiceError(
          "VERIFICATION_INVALID",
          "The password reset request is invalid or expired.",
        );
      }

      await transaction.emailVerification.updateMany(
        {
          where: {
            userId: record.user.id,
            storefrontId:
              record.user.storefrontId,
            purpose:
              "PASSWORD_RESET",
            consumedAt: null,
          },
          data: {
            consumedAt: now,
          },
        },
      );

      await transaction.user.update({
        where: {
          id: record.user.id,
        },
        data: {
          passwordHash:
            newPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          sessionVersion: {
            increment: 1,
          },
        },
      });

      const revoked =
        await transaction.session.updateMany(
          {
            where: {
              userId:
                record.user.id,
              storefrontId:
                record.user
                  .storefrontId,
              revokedAt: null,
            },
            data: {
              revokedAt: now,
              revokedReason:
                "PASSWORD_RESET",
            },
          },
        );

      return {
        userId: record.user.id,
        storefrontId:
          record.user.storefrontId,
        sessionsRevoked:
          revoked.count,
      };
    },
  );
}
TS

echo
echo "=== CREATE VERIFICATION RESEND SERVICE ==="

cat > src/server/auth/resend.ts <<'TS'
import "server-only";

import { prisma } from "../../lib/prisma";

import {
  createOpaqueToken,
  createPhoneChallenge,
  hashOpaqueToken,
  normalizeEmail,
  normalizeStorefrontCode,
} from "./crypto";
import {
  type AuthDeliveryProvider,
  assertAuthDeliveryEnabled,
} from "./delivery";
import type {
  GenericRecoveryResult,
  RecoveryClockOptions,
  ResendRegistrationVerificationInput,
} from "./recovery-types";

const EMAIL_VERIFICATION_EXPIRY_MINUTES =
  30;
const PHONE_VERIFICATION_EXPIRY_MINUTES =
  10;
const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_WINDOW_MINUTES = 60;
const RESEND_LIMIT_PER_WINDOW = 5;

const GENERIC_ACCEPTED_RESULT:
  GenericRecoveryResult = {
    accepted: true,
  };

function resolveNow(
  options?: RecoveryClockOptions,
): Date {
  return options?.now
    ? new Date(options.now)
    : new Date();
}

async function channelMaySend(
  input: {
    userId: string;
    storefrontId: string;
    channel: "EMAIL" | "PHONE";
    now: Date;
  },
): Promise<boolean> {
  const cooldownCutoff = new Date(
    input.now.getTime() -
      RESEND_COOLDOWN_SECONDS *
        1000,
  );

  const windowCutoff = new Date(
    input.now.getTime() -
      RESEND_WINDOW_MINUTES *
        60 *
        1000,
  );

  if (input.channel === "EMAIL") {
    const latest =
      await prisma.emailVerification.findFirst(
        {
          where: {
            userId: input.userId,
            storefrontId:
              input.storefrontId,
            purpose: "REGISTRATION",
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            createdAt: true,
          },
        },
      );

    if (
      latest &&
      latest.createdAt >
        cooldownCutoff
    ) {
      return false;
    }

    const count =
      await prisma.emailVerification.count(
        {
          where: {
            userId: input.userId,
            storefrontId:
              input.storefrontId,
            purpose: "REGISTRATION",
            createdAt: {
              gte: windowCutoff,
            },
          },
        },
      );

    return (
      count <
      RESEND_LIMIT_PER_WINDOW
    );
  }

  const latest =
    await prisma.phoneVerification.findFirst(
      {
        where: {
          userId: input.userId,
          storefrontId:
            input.storefrontId,
          purpose: "REGISTRATION",
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          createdAt: true,
        },
      },
    );

  if (
    latest &&
    latest.createdAt >
      cooldownCutoff
  ) {
    return false;
  }

  const count =
    await prisma.phoneVerification.count({
      where: {
        userId: input.userId,
        storefrontId:
          input.storefrontId,
        purpose: "REGISTRATION",
        createdAt: {
          gte: windowCutoff,
        },
      },
    });

  return (
    count <
    RESEND_LIMIT_PER_WINDOW
  );
}

export async function resendRegistrationVerification(
  input:
    ResendRegistrationVerificationInput,
  deliveryProvider:
    AuthDeliveryProvider,
  options?: RecoveryClockOptions,
): Promise<GenericRecoveryResult> {
  assertAuthDeliveryEnabled(
    deliveryProvider,
  );

  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const normalizedEmail =
    normalizeEmail(input.email);

  const storefront =
    await prisma.storefront.findUnique({
      where: {
        code: storefrontCode,
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });

  if (
    !storefront ||
    storefront.status !== "ACTIVE"
  ) {
    return GENERIC_ACCEPTED_RESULT;
  }

  const user = await prisma.user.findUnique({
    where: {
      storefrontId_normalizedEmail: {
        storefrontId: storefront.id,
        normalizedEmail,
      },
    },
    select: {
      id: true,
      storefrontId: true,
      normalizedEmail: true,
      normalizedPhone: true,
      status: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      deletedAt: true,
    },
  });

  if (
    !user ||
    user.status !==
      "PENDING_VERIFICATION" ||
    user.deletedAt !== null
  ) {
    return GENERIC_ACCEPTED_RESULT;
  }

  const now = resolveNow(options);

  const sendEmail =
    user.emailVerifiedAt === null &&
    await channelMaySend({
      userId: user.id,
      storefrontId:
        user.storefrontId,
      channel: "EMAIL",
      now,
    });

  const sendPhone =
    user.phoneVerifiedAt === null &&
    await channelMaySend({
      userId: user.id,
      storefrontId:
        user.storefrontId,
      channel: "PHONE",
      now,
    });

  if (!sendEmail && !sendPhone) {
    return GENERIC_ACCEPTED_RESULT;
  }

  const emailToken = sendEmail
    ? createOpaqueToken()
    : null;

  const phoneChallenge = sendPhone
    ? createPhoneChallenge(
        input.tokenSecret,
      )
    : null;

  const emailExpiresAt = new Date(
    now.getTime() +
      EMAIL_VERIFICATION_EXPIRY_MINUTES *
        60 *
        1000,
  );

  const phoneExpiresAt = new Date(
    now.getTime() +
      PHONE_VERIFICATION_EXPIRY_MINUTES *
        60 *
        1000,
  );

  const records =
    await prisma.$transaction(
      async (transaction) => {
        let emailRecordId:
          | string
          | null = null;

        let phoneRecordId:
          | string
          | null = null;

        if (emailToken) {
          await transaction.emailVerification.updateMany(
            {
              where: {
                userId: user.id,
                storefrontId:
                  user.storefrontId,
                purpose:
                  "REGISTRATION",
                consumedAt: null,
              },
              data: {
                consumedAt: now,
              },
            },
          );

          const emailRecord =
            await transaction.emailVerification.create(
              {
                data: {
                  userId: user.id,
                  storefrontId:
                    user.storefrontId,
                  email:
                    user.normalizedEmail,
                  tokenHash:
                    hashOpaqueToken(
                      emailToken,
                      input.tokenSecret,
                    ),
                  purpose:
                    "REGISTRATION",
                  expiresAt:
                    emailExpiresAt,
                  createdAt: now,
                },
                select: {
                  id: true,
                },
              },
            );

          emailRecordId =
            emailRecord.id;
        }

        if (phoneChallenge) {
          await transaction.phoneVerification.updateMany(
            {
              where: {
                userId: user.id,
                storefrontId:
                  user.storefrontId,
                purpose:
                  "REGISTRATION",
                consumedAt: null,
              },
              data: {
                consumedAt: now,
              },
            },
          );

          const phoneRecord =
            await transaction.phoneVerification.create(
              {
                data: {
                  userId: user.id,
                  storefrontId:
                    user.storefrontId,
                  phone:
                    user.normalizedPhone,
                  challengeId:
                    phoneChallenge
                      .challengeId,
                  codeHash:
                    phoneChallenge
                      .codeHash,
                  purpose:
                    "REGISTRATION",
                  expiresAt:
                    phoneExpiresAt,
                  createdAt: now,
                  maxAttempts: 5,
                },
                select: {
                  id: true,
                },
              },
            );

          phoneRecordId =
            phoneRecord.id;
        }

        return {
          emailRecordId,
          phoneRecordId,
        };
      },
    );

  let firstDeliveryError:
    unknown = null;

  if (
    emailToken &&
    records.emailRecordId
  ) {
    try {
      await deliveryProvider.sendEmailVerification(
        {
          storefrontCode:
            storefront.code,
          storefrontName:
            storefront.name,
          recipientEmail:
            user.normalizedEmail,
          token: emailToken,
          expiresAt:
            emailExpiresAt,
        },
      );
    } catch (error) {
      firstDeliveryError = error;

      await prisma.emailVerification.updateMany(
        {
          where: {
            id: records.emailRecordId,
            consumedAt: null,
          },
          data: {
            consumedAt:
              new Date(),
          },
        },
      );
    }
  }

  if (
    phoneChallenge &&
    records.phoneRecordId
  ) {
    try {
      await deliveryProvider.sendPhoneVerification(
        {
          storefrontCode:
            storefront.code,
          storefrontName:
            storefront.name,
          recipientPhone:
            user.normalizedPhone,
          challengeId:
            phoneChallenge.challengeId,
          code:
            phoneChallenge.code,
          expiresAt:
            phoneExpiresAt,
        },
      );
    } catch (error) {
      firstDeliveryError ??= error;

      await prisma.phoneVerification.updateMany(
        {
          where: {
            id: records.phoneRecordId,
            consumedAt: null,
          },
          data: {
            consumedAt:
              new Date(),
          },
        },
      );
    }
  }

  if (firstDeliveryError) {
    throw firstDeliveryError;
  }

  return GENERIC_ACCEPTED_RESULT;
}
TS

echo
echo "=== EXPORT RECOVERY SERVICES ==="

python - <<'PY'
from pathlib import Path

path = Path(
    "src/server/auth/index.ts"
)

content = path.read_text(
    encoding="utf-8",
)

addition = '''
export {
  assertAuthDeliveryEnabled,
  createDisabledAuthDeliveryProvider,
  getAuthDeliveryProvider,
  isAuthDeliveryUnavailableError,
  AuthDeliveryUnavailableError,
} from "./delivery";

export {
  requestPasswordReset,
  resetCustomerPassword,
} from "./recovery";

export {
  resendRegistrationVerification,
} from "./resend";

export type {
  AuthDeliveryProvider,
  EmailVerificationDelivery,
  PasswordResetDelivery,
  PhoneVerificationDelivery,
} from "./delivery";

export type {
  GenericRecoveryResult,
  RecoveryClockOptions,
  RequestPasswordResetInput,
  ResendRegistrationVerificationInput,
  ResetCustomerPasswordInput,
  ResetPasswordResult,
} from "./recovery-types";
'''

marker = (
    'export {\n'
    '  registerCustomer,\n'
    '} from "./registration";'
)

if (
    'from "./recovery";'
    in content
):
    print(
        "Recovery exports already exist."
    )
elif marker in content:
    content = (
        content.rstrip()
        + "\n"
        + addition
    )

    path.write_text(
        content,
        encoding="utf-8",
    )

    print(
        "Added recovery and delivery exports."
    )
else:
    raise RuntimeError(
        "Could not locate the authentication export structure."
    )
PY

echo
echo "=== CREATE RECOVERY SERVICE AUDIT ==="

cat > scripts/audit-auth-recovery-services.ts <<'TS'
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
      storefrontCode: "ATI",
      storefrontName:
        "ATILOSZY Varieties Store",
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
      });

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
      capture.emailVerifications
        .length === 1,
      "The email verification resend was not delivered.",
    );

    assertCondition(
      capture.phoneVerifications
        .length === 1,
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
      capture.emailVerifications
        .length === 1 &&
      capture.phoneVerifications
        .length === 1,
      "The resend cooldown was not enforced.",
    );

    console.log(
      "PASS: Verification resend cooldown completed.",
    );

    const resentEmail =
      capture.emailVerifications[0];

    const resentPhone =
      capture.phoneVerifications[0];

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
TS

echo
echo "=== REGISTER RECOVERY AUDIT COMMAND ==="

npm pkg set \
  "scripts.db:audit:recovery=node --env-file=.env --conditions=react-server --import tsx scripts/audit-auth-recovery-services.ts"

echo
echo "=== VALIDATE DATABASE STATE ==="

npm run db:up
npm run db:validate
npm run db:generate
npx prisma migrate status

echo
echo "=== RUN RECOVERY SERVICE AUDIT ==="

npm run db:audit:recovery

echo
echo "=== RUN AUTHENTICATION REGRESSION AUDITS ==="

npm run db:audit:auth
npm run db:audit:auth-api
npm run db:audit:auth-ui
npm run db:audit:identity

echo
echo "=== RUN COMMERCE REGRESSION AUDITS ==="

npm run db:audit
npm run db:audit:catalog
npm run db:audit:services

echo
echo "=== RUN APPLICATION VALIDATION ==="

npm run lint
npm run build

echo
echo "=== VERIFY RECOVERY AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TS'
import { prisma } from "./src/lib/prisma";

const remainingUsers =
  await prisma.user.count({
    where: {
      normalizedEmail: {
        contains:
          "recovery-audit-",
        endsWith:
          "@example.test",
      },
    },
  });

if (remainingUsers !== 0) {
  throw new Error(
    `${remainingUsers} temporary recovery audit user(s) remain.`,
  );
}

console.log(
  "PASS: No temporary recovery audit users remain.",
);

await prisma.$disconnect();
TS

echo
echo "=== VERIFY NO TEST SERVER REMAINS ==="

if ps -ef |
  grep -E \
    '[n]ode_modules/next/dist/bin/next start' \
  >/tmp/sorvyra-recovery-server-check.txt
then
  echo "A temporary Next.js test server remains:"
  cat /tmp/sorvyra-recovery-server-check.txt
  exit 1
fi

echo "PASS: No authentication test server remains."

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "PHASE 2E-E-A AUTH RECOVERY SERVICES PASSED"
