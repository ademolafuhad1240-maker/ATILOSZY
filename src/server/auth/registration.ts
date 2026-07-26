import "server-only";

import { prisma } from "../../lib/prisma";

import {
  createOpaqueToken,
  createPhoneChallenge,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
  normalizeStorefrontCode,
} from "./crypto";
import {
  AuthServiceError,
  isPrismaErrorCode,
} from "./errors";
import type {
  RegisterCustomerInput,
  RegistrationResult,
} from "./types";

const EMAIL_VERIFICATION_MINUTES = 30;
const PHONE_VERIFICATION_MINUTES = 10;

export async function registerCustomer(
  input: RegisterCustomerInput,
): Promise<RegistrationResult> {
  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const normalizedEmail = normalizeEmail(
    input.email,
  );

  const normalizedPhone = normalizePhone(
    input.phone,
  );

  const firstName = normalizePersonName(
    input.firstName,
    "First name",
  );

  const lastName = normalizePersonName(
    input.lastName,
    "Last name",
  );

  const displayName = input.displayName
    ? normalizePersonName(
        input.displayName,
        "Display name",
      )
    : null;

  if (
    input.termsAccepted !== true ||
    input.privacyAccepted !== true
  ) {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      "The terms and privacy notice must be accepted.",
    );
  }

  const storefront =
    await prisma.storefront.findUnique({
      where: {
        code: storefrontCode,
      },
      select: {
        id: true,
        status: true,
      },
    });

  if (
    !storefront ||
    storefront.status !== "ACTIVE"
  ) {
    throw new AuthServiceError(
      "STOREFRONT_UNAVAILABLE",
      "The selected storefront is unavailable.",
    );
  }

  const passwordHash = await hashPassword(
    input.password,
  );

  const emailVerificationToken =
    createOpaqueToken();

  const emailTokenHash = hashOpaqueToken(
    emailVerificationToken,
    input.tokenSecret,
  );

  const phoneChallenge =
    createPhoneChallenge(input.tokenSecret);

  const now = new Date();

  const emailExpiresAt = new Date(
    now.getTime() +
      EMAIL_VERIFICATION_MINUTES *
        60 *
        1000,
  );

  const phoneExpiresAt = new Date(
    now.getTime() +
      PHONE_VERIFICATION_MINUTES *
        60 *
        1000,
  );

  try {
    const user = await prisma.$transaction(
      async (transaction) => {
        const createdUser =
          await transaction.user.create({
            data: {
              storefrontId: storefront.id,
              email: normalizedEmail,
              normalizedEmail,
              phone: normalizedPhone,
              normalizedPhone,
              passwordHash,
              status:
                "PENDING_VERIFICATION",
            },
            select: {
              id: true,
              storefrontId: true,
              status: true,
            },
          });

        await transaction.storefrontCustomer.create(
          {
            data: {
              userId: createdUser.id,
              storefrontId:
                createdUser.storefrontId,
              firstName,
              lastName,
              displayName,
              marketingOptIn:
                input.marketingOptIn === true,
              marketingOptInAt:
                input.marketingOptIn === true
                  ? now
                  : null,
              termsAcceptedAt: now,
              privacyAcceptedAt: now,
            },
          },
        );

        await transaction.customerSecuritySettings.create(
          {
            data: {
              userId: createdUser.id,
              storefrontId:
                createdUser.storefrontId,
              twoFactorEnabled: false,
              loginAlertsEnabled: true,
            },
          },
        );

        await transaction.emailVerification.create(
          {
            data: {
              userId: createdUser.id,
              storefrontId:
                createdUser.storefrontId,
              email: normalizedEmail,
              tokenHash: emailTokenHash,
              purpose: "REGISTRATION",
              expiresAt: emailExpiresAt,
            },
          },
        );

        await transaction.phoneVerification.create(
          {
            data: {
              userId: createdUser.id,
              storefrontId:
                createdUser.storefrontId,
              phone: normalizedPhone,
              challengeId:
                phoneChallenge.challengeId,
              codeHash:
                phoneChallenge.codeHash,
              purpose: "REGISTRATION",
              expiresAt: phoneExpiresAt,
              maxAttempts: 5,
            },
          },
        );

        return createdUser;
      },
    );

    return {
      user,
      emailVerificationToken,
      phoneChallengeId:
        phoneChallenge.challengeId,
      phoneVerificationCode:
        phoneChallenge.code,
    };
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      throw new AuthServiceError(
        "ACCOUNT_CONFLICT",
        "An account already exists for this storefront.",
      );
    }

    throw error;
  }
}
