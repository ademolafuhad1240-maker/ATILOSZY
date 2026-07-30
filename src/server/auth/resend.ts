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
          deliveryId:
            records.emailRecordId,
          storefrontCode:
            storefront.code,
          storefrontName:
            storefront.name,
          storefrontRoute:
            storefront.route,
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
          deliveryId:
            records.phoneRecordId,
          storefrontCode:
            storefront.code,
          storefrontName:
            storefront.name,
          storefrontRoute:
            storefront.route,
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
