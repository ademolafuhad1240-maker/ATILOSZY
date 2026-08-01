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
        route: true,
        status: true,
      },
    });

  if (
    !storefront ||
    storefront.status !== "ACTIVE"
  ) {
    return GENERIC_ACCEPTED_RESULT;
  }

  const customerAccount =
    await prisma.customerAccount.findUnique({
    where: {
      normalizedEmail,
    },
    select: {
      id: true,
      users: {
        where: {
          status: "ACTIVE",
          emailVerifiedAt: {
            not: null,
          },
          deletedAt: null,
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          storefrontId: true,
          normalizedEmail: true,
          status: true,
          emailVerifiedAt: true,
          deletedAt: true,
          storefront: {
            select: {
              code: true,
              name: true,
              route: true,
            },
          },
        },
      },
    },
  });

  const user =
    customerAccount?.users.find(
      (candidate) =>
        candidate.storefrontId ===
        storefront.id,
    ) ??
    customerAccount?.users[0] ??
    null;

  if (
    !customerAccount ||
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
          user: {
            customerAccountId:
              customerAccount.id,
          },
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
        user: {
          customerAccountId:
            customerAccount.id,
        },
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
              user: {
                customerAccountId:
                  customerAccount.id,
              },
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
        deliveryId:
          verification.id,
        storefrontCode:
          user.storefront.code,
        storefrontName:
          user.storefront.name,
        storefrontRoute:
          user.storefront.route,
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
              customerAccountId: true,
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
    !record.user.customerAccountId ||
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
            user: {
              customerAccountId:
                record.user.customerAccountId,
            },
            purpose:
              "PASSWORD_RESET",
            consumedAt: null,
          },
          data: {
            consumedAt: now,
          },
        },
      );

      await transaction.user.updateMany({
        where: {
          customerAccountId:
            record.user.customerAccountId,
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
              user: {
                customerAccountId:
                  record.user.customerAccountId,
              },
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
