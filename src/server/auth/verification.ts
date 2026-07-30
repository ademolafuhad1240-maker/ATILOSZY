import "server-only";

import { prisma } from "../../lib/prisma";

import {
  hashOpaqueToken,
  normalizeEmail,
  normalizeStorefrontCode,
  verifyPhoneCodeHash,
} from "./crypto";
import { AuthServiceError } from "./errors";
import type {
  VerificationResult,
} from "./types";

export async function verifyCustomerEmail(
  input: {
    storefrontCode: string;
    token: string;
    tokenSecret: string;
  },
): Promise<VerificationResult> {
  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const tokenHash = hashOpaqueToken(
    input.token,
    input.tokenSecret,
  );

  const record =
    await prisma.emailVerification.findUnique({
      where: {
        tokenHash,
      },
      include: {
        storefront: {
          select: {
            code: true,
          },
        },
        user: {
          select: {
            id: true,
            normalizedEmail: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            status: true,
          },
        },
      },
    });

  const now = new Date();

  if (
    !record ||
    record.storefront.code !== storefrontCode ||
    record.consumedAt !== null ||
    record.expiresAt <= now ||
    normalizeEmail(record.email) !==
      record.user.normalizedEmail
  ) {
    throw new AuthServiceError(
      "VERIFICATION_INVALID",
      "The email verification request is invalid or expired.",
    );
  }

  return prisma.$transaction(
    async (transaction) => {
      const consumed =
        await transaction.emailVerification.updateMany(
          {
            where: {
              id: record.id,
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
          "The email verification request is invalid or expired.",
        );
      }

      let user = await transaction.user.update({
        where: {
          id: record.user.id,
        },
        data: {
          emailVerifiedAt: now,
        },
        select: {
          id: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          status: true,
        },
      });

      if (
        user.status ===
          "PENDING_VERIFICATION" &&
        user.emailVerifiedAt !== null
      ) {
        user = await transaction.user.update({
          where: {
            id: user.id,
          },
          data: {
            status: "ACTIVE",
          },
          select: {
            id: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            status: true,
          },
        });
      }

      return {
        userId: user.id,
        emailVerified:
          user.emailVerifiedAt !== null,
        phoneVerified:
          user.phoneVerifiedAt !== null,
        status: user.status,
      };
    },
  );
}

export async function verifyCustomerPhone(
  input: {
    storefrontCode: string;
    challengeId: string;
    code: string;
    tokenSecret: string;
  },
): Promise<VerificationResult> {
  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const record =
    await prisma.phoneVerification.findUnique({
      where: {
        challengeId: input.challengeId,
      },
      include: {
        storefront: {
          select: {
            code: true,
          },
        },
        user: {
          select: {
            id: true,
            normalizedPhone: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            status: true,
          },
        },
      },
    });

  const now = new Date();

  if (
    !record ||
    record.storefront.code !== storefrontCode ||
    record.consumedAt !== null ||
    record.expiresAt <= now ||
    record.attemptCount >= record.maxAttempts ||
    record.phone !== record.user.normalizedPhone
  ) {
    throw new AuthServiceError(
      "VERIFICATION_INVALID",
      "The phone verification request is invalid or expired.",
    );
  }

  const validCode = verifyPhoneCodeHash(
    record.challengeId,
    input.code,
    record.codeHash,
    input.tokenSecret,
  );

  if (!validCode) {
    await prisma.phoneVerification.updateMany({
      where: {
        id: record.id,
        consumedAt: null,
        attemptCount: {
          lt: record.maxAttempts,
        },
      },
      data: {
        attemptCount: {
          increment: 1,
        },
      },
    });

    throw new AuthServiceError(
      "VERIFICATION_INVALID",
      "The phone verification code is invalid or expired.",
    );
  }

  return prisma.$transaction(
    async (transaction) => {
      const consumed =
        await transaction.phoneVerification.updateMany(
          {
            where: {
              id: record.id,
              consumedAt: null,
              expiresAt: {
                gt: now,
              },
              attemptCount: {
                lt: record.maxAttempts,
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
          "The phone verification request is invalid or expired.",
        );
      }

      let user = await transaction.user.update({
        where: {
          id: record.user.id,
        },
        data: {
          phoneVerifiedAt: now,
        },
        select: {
          id: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          status: true,
        },
      });

      if (
        user.status ===
          "PENDING_VERIFICATION" &&
        user.emailVerifiedAt !== null
      ) {
        user = await transaction.user.update({
          where: {
            id: user.id,
          },
          data: {
            status: "ACTIVE",
          },
          select: {
            id: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            status: true,
          },
        });
      }

      return {
        userId: user.id,
        emailVerified:
          user.emailVerifiedAt !== null,
        phoneVerified:
          user.phoneVerifiedAt !== null,
        status: user.status,
      };
    },
  );
}
