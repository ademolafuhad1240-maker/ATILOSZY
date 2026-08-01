import "server-only";

import { prisma } from "../../lib/prisma";

import {
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  normalizeStorefrontCode,
  passwordNeedsRehash,
  verifyPassword,
} from "./crypto";
import { AuthServiceError } from "./errors";
import type {
  LoginCustomerInput,
  LoginResult,
  PlatformAdministratorLoginInput,
  PlatformAdministratorLoginResult,
  ValidatedPlatformSession,
  ValidatedSession,
} from "./types";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_MINUTES = 15;
const DEFAULT_SESSION_TTL_MINUTES =
  30 * 24 * 60;
const MIN_SESSION_TTL_MINUTES = 5;
const MAX_SESSION_TTL_MINUTES =
  90 * 24 * 60;

let dummyHashPromise: Promise<string> | null =
  null;

async function consumePasswordCost(
  password: string,
): Promise<void> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(
      "SORVYRA timing protection password 2026",
    );
  }

  const dummyHash = await dummyHashPromise;

  await verifyPassword(
    password,
    dummyHash,
  );
}

function validateLoginPasswordCandidate(
  password: string,
): void {
  if (
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 1024
  ) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }
}

function resolveSessionTtlMinutes(
  value: number | undefined,
): number {
  const resolved =
    value ?? DEFAULT_SESSION_TTL_MINUTES;

  if (
    !Number.isSafeInteger(resolved) ||
    resolved < MIN_SESSION_TTL_MINUTES ||
    resolved > MAX_SESSION_TTL_MINUTES
  ) {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      "The session duration is invalid.",
    );
  }

  return resolved;
}

export async function loginCustomer(
  input: LoginCustomerInput,
): Promise<LoginResult> {
  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const normalizedEmail = normalizeEmail(
    input.email,
  );

  validateLoginPasswordCandidate(
    input.password,
  );

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
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }

  const customerAccount =
    await prisma.customerAccount.findUnique({
      where: {
        normalizedEmail,
      },
      select: {
        id: true,
        users: {
          select: {
            id: true,
            storefrontId: true,
            email: true,
            normalizedEmail: true,
            phone: true,
            normalizedPhone: true,
            passwordHash: true,
            status: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            failedLoginAttempts: true,
            lockedUntil: true,
            deletedAt: true,
            customer: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                marketingOptIn: true,
                marketingOptInAt: true,
                termsAcceptedAt: true,
                privacyAcceptedAt: true,
              },
            },
            security: {
              select: {
                twoFactorEnabled: true,
                loginAlertsEnabled: true,
                passwordChangedAt: true,
              },
            },
          },
        },
      },
    });

  if (
    !customerAccount ||
    customerAccount.users.length === 0
  ) {
    await consumePasswordCost(
      input.password,
    );

    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }

  const now = new Date();

  const activeLock =
    customerAccount.users
      .map((candidate) =>
        candidate.lockedUntil,
      )
      .filter(
        (lockedUntil): lockedUntil is Date =>
          lockedUntil !== null &&
          lockedUntil > now,
      )
      .sort(
        (left, right) =>
          right.getTime() -
          left.getTime(),
      )[0] ?? null;

  if (activeLock) {
    throw new AuthServiceError(
      "ACCOUNT_LOCKED",
      "The account is temporarily locked.",
    );
  }

  const expiredLockWasCleared =
    customerAccount.users.some(
      (candidate) =>
        candidate.lockedUntil !== null,
    );

  if (expiredLockWasCleared) {
    await prisma.user.updateMany({
      where: {
        customerAccountId:
          customerAccount.id,
      },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  const targetCandidate =
    customerAccount.users.find(
      (candidate) =>
        candidate.storefrontId ===
        storefront.id,
    );

  const credentialCandidates = [
    ...(targetCandidate?.status ===
        "ACTIVE" &&
      targetCandidate.emailVerifiedAt !==
        null
      ? [targetCandidate]
      : []),
    ...customerAccount.users.filter(
      (candidate) =>
        candidate.id !==
          targetCandidate?.id &&
        candidate.status === "ACTIVE" &&
        candidate.emailVerifiedAt !== null,
    ),
    ...(targetCandidate &&
    (targetCandidate.status !== "ACTIVE" ||
      targetCandidate.emailVerifiedAt ===
        null)
      ? [targetCandidate]
      : []),
    ...customerAccount.users.filter(
      (candidate) =>
        candidate.id !==
          targetCandidate?.id &&
        (candidate.status !== "ACTIVE" ||
          candidate.emailVerifiedAt ===
            null),
    ),
  ];

  let user = null as
    | (typeof credentialCandidates)[number]
    | null;

  for (const candidate of
    credentialCandidates) {
    if (
      await verifyPassword(
        input.password,
        candidate.passwordHash,
      )
    ) {
      user = candidate;
      break;
    }
  }

  if (!user) {
    const failedAttempts =
      (expiredLockWasCleared
        ? 0
        : Math.max(
            ...customerAccount.users.map(
              (candidate) =>
                candidate.failedLoginAttempts,
            ),
          )) + 1;

    await prisma.user.updateMany({
      where: {
        customerAccountId:
          customerAccount.id,
      },
      data: {
        failedLoginAttempts:
          failedAttempts,
      },
    });

    if (
      failedAttempts >=
      MAX_FAILED_LOGIN_ATTEMPTS
    ) {
      const lockedUntil = new Date(
        now.getTime() +
          ACCOUNT_LOCK_MINUTES *
            60 *
            1000,
      );

      await prisma.user.updateMany({
        where: {
          customerAccountId:
            customerAccount.id,
        },
        data: {
          lockedUntil,
        },
      });

      throw new AuthServiceError(
        "ACCOUNT_LOCKED",
        "The account is temporarily locked.",
      );
    }

    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }

  if (
    user.status === "SUSPENDED" ||
    user.status === "DELETED" ||
    user.deletedAt !== null
  ) {
    throw new AuthServiceError(
      "ACCOUNT_UNAVAILABLE",
      "The account is unavailable.",
    );
  }

  if (
    user.status ===
      "PENDING_VERIFICATION" &&
    user.emailVerifiedAt !== null
  ) {
    const activatedUser =
      await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        storefrontId: true,
        email: true,
        passwordHash: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        deletedAt: true,
      },
    });

    user = {
      ...user,
      ...activatedUser,
    };
  }

  if (
    user.status !== "ACTIVE" ||
    user.emailVerifiedAt === null
  ) {
    await prisma.user.updateMany({
      where: {
        customerAccountId:
          customerAccount.id,
      },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    throw new AuthServiceError(
      "VERIFICATION_REQUIRED",
      "Email verification is required.",
    );
  }

  const ttlMinutes =
    resolveSessionTtlMinutes(
      input.sessionTtlMinutes,
    );

  const expiresAt = new Date(
    now.getTime() +
      ttlMinutes *
        60 *
        1000,
  );

  const session = await prisma.$transaction(
    async (transaction) => {
      const currentUser =
        await transaction.user.findUnique({
          where: {
            id: user.id,
          },
          select: {
            id: true,
            customerAccountId: true,
            storefrontId: true,
            email: true,
            normalizedEmail: true,
            phone: true,
            normalizedPhone: true,
            passwordHash: true,
            status: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            deletedAt: true,
            customer: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                marketingOptIn: true,
                marketingOptInAt: true,
                termsAcceptedAt: true,
                privacyAcceptedAt: true,
              },
            },
            security: {
              select: {
                twoFactorEnabled: true,
                loginAlertsEnabled: true,
                passwordChangedAt: true,
              },
            },
          },
        });

      if (
        !currentUser ||
        currentUser.status !== "ACTIVE" ||
        currentUser.emailVerifiedAt ===
          null ||
        currentUser.deletedAt !== null ||
        !currentUser.customerAccountId ||
        !currentUser.customer ||
        !currentUser.security
      ) {
        throw new AuthServiceError(
          "ACCOUNT_UNAVAILABLE",
          "The account is unavailable.",
        );
      }

      const passwordHashUpdate =
        passwordNeedsRehash(
          currentUser.passwordHash,
        )
          ? await hashPassword(
              input.password,
            )
          : null;

      const effectivePasswordHash =
        passwordHashUpdate ??
        currentUser.passwordHash;

      const passwordRecordsToSync =
        await transaction.user.count({
          where: {
            customerAccountId:
              currentUser.customerAccountId,
            passwordHash: {
              not: effectivePasswordHash,
            },
          },
        });

      if (
        passwordHashUpdate ||
        passwordRecordsToSync > 0
      ) {
        await transaction.session.updateMany({
          where: {
            user: {
              customerAccountId:
                currentUser.customerAccountId,
            },
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revokedReason:
              "PLATFORM_ACCOUNT_CREDENTIAL_SYNC",
          },
        });
      }

      await transaction.user.updateMany({
        where: {
          customerAccountId:
            currentUser.customerAccountId,
        },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
          ...(passwordHashUpdate ||
          passwordRecordsToSync > 0
            ? {
                passwordHash:
                  effectivePasswordHash,
                sessionVersion: {
                  increment: 1,
                },
              }
            : {}),
        },
      });

      const sessionStorefronts =
        await transaction.storefront.findMany({
          where:
            input.createAllStorefrontSessions ===
            true
              ? {
                  status: "ACTIVE",
                }
              : {
                  id: storefront.id,
                  status: "ACTIVE",
                },
          select: {
            id: true,
            code: true,
          },
          orderBy: {
            code: "asc",
          },
        });

      const storefrontSessions: Array<{
        id: string;
        storefrontId: string;
        storefrontCode: string;
        userId: string;
        sessionToken: string;
        expiresAt: Date;
      }> = [];

      for (const sessionStorefront of
        sessionStorefronts) {
        let membership =
          await transaction.user.findFirst({
            where: {
              customerAccountId:
                currentUser.customerAccountId,
              storefrontId:
                sessionStorefront.id,
            },
            select: {
              id: true,
              storefrontId: true,
              status: true,
              emailVerifiedAt: true,
              deletedAt: true,
            },
          });

        if (!membership) {
          const phoneConflict =
            await transaction.user.findUnique({
              where: {
                storefrontId_normalizedPhone: {
                  storefrontId:
                    sessionStorefront.id,
                  normalizedPhone:
                    currentUser.normalizedPhone,
                },
              },
              select: {
                customerAccountId: true,
              },
            });

          if (
            phoneConflict &&
            phoneConflict.customerAccountId !==
              currentUser.customerAccountId
          ) {
            if (
              sessionStorefront.id ===
              storefront.id
            ) {
              throw new AuthServiceError(
                "ACCOUNT_CONFLICT",
                "This customer account cannot be connected to the selected storefront. Contact SORVYRA support.",
              );
            }

            continue;
          }

          membership =
            await transaction.user.create({
              data: {
                customerAccountId:
                  currentUser.customerAccountId,
                storefrontId:
                  sessionStorefront.id,
                email: currentUser.email,
                normalizedEmail:
                  currentUser.normalizedEmail,
                phone: currentUser.phone,
                normalizedPhone:
                  currentUser.normalizedPhone,
                passwordHash:
                  passwordHashUpdate ??
                  currentUser.passwordHash,
                status: "ACTIVE",
                emailVerifiedAt:
                  currentUser.emailVerifiedAt,
                phoneVerifiedAt:
                  currentUser.phoneVerifiedAt,
                lastLoginAt: now,
              },
              select: {
                id: true,
                storefrontId: true,
                status: true,
                emailVerifiedAt: true,
                deletedAt: true,
              },
            });

          await transaction.storefrontCustomer.create({
            data: {
              userId: membership.id,
              storefrontId:
                membership.storefrontId,
              firstName:
                currentUser.customer.firstName,
              lastName:
                currentUser.customer.lastName,
              displayName:
                currentUser.customer.displayName,
              marketingOptIn:
                currentUser.customer.marketingOptIn,
              marketingOptInAt:
                currentUser.customer.marketingOptInAt,
              termsAcceptedAt:
                currentUser.customer.termsAcceptedAt,
              privacyAcceptedAt:
                currentUser.customer.privacyAcceptedAt,
            },
          });

          await transaction.customerSecuritySettings.create({
            data: {
              userId: membership.id,
              storefrontId:
                membership.storefrontId,
              twoFactorEnabled: false,
              loginAlertsEnabled:
                currentUser.security.loginAlertsEnabled,
              passwordChangedAt:
                currentUser.security.passwordChangedAt,
            },
          });
        } else if (
          membership.status ===
            "PENDING_VERIFICATION" &&
          currentUser.emailVerifiedAt !==
            null &&
          membership.deletedAt === null
        ) {
          membership =
            await transaction.user.update({
              where: {
                id: membership.id,
              },
              data: {
                status: "ACTIVE",
                emailVerifiedAt:
                  currentUser.emailVerifiedAt,
                phoneVerifiedAt:
                  currentUser.phoneVerifiedAt,
                passwordHash:
                  effectivePasswordHash,
              },
              select: {
                id: true,
                storefrontId: true,
                status: true,
                emailVerifiedAt: true,
                deletedAt: true,
              },
            });
        }

        if (
          membership.status !== "ACTIVE" ||
          membership.emailVerifiedAt ===
            null ||
          membership.deletedAt !== null
        ) {
          if (
            sessionStorefront.id ===
            storefront.id
          ) {
            throw new AuthServiceError(
              "ACCOUNT_UNAVAILABLE",
              "The account is unavailable.",
            );
          }

          continue;
        }

        const storefrontSessionToken =
          createOpaqueToken();

        const createdSession =
          await transaction.session.create({
            data: {
              userId: membership.id,
              storefrontId:
                membership.storefrontId,
              tokenHash: hashOpaqueToken(
                storefrontSessionToken,
                input.tokenSecret,
              ),
              expiresAt,
              lastSeenAt: now,
              ipAddress:
                input.ipAddress?.slice(0, 64) ??
                null,
              userAgent:
                input.userAgent?.slice(
                  0,
                  1000,
                ) ?? null,
            },
            select: {
              id: true,
              expiresAt: true,
            },
          });

        storefrontSessions.push({
          id: createdSession.id,
          storefrontId:
            membership.storefrontId,
          storefrontCode:
            sessionStorefront.code,
          userId: membership.id,
          sessionToken:
            storefrontSessionToken,
          expiresAt:
            createdSession.expiresAt,
        });
      }

      const targetSession =
        storefrontSessions.find(
          (candidate) =>
            candidate.storefrontId ===
            storefront.id,
        );

      if (!targetSession) {
        throw new AuthServiceError(
          "ACCOUNT_UNAVAILABLE",
          "The account is unavailable.",
        );
      }

      return {
        targetSession,
        storefrontSessions,
        currentUser,
      };
    },
  );

  return {
    sessionToken:
      session.targetSession.sessionToken,
    session: {
      id: session.targetSession.id,
      expiresAt:
        session.targetSession.expiresAt,
    },
    user: {
      id: session.targetSession.userId,
      storefrontId:
        session.targetSession.storefrontId,
      email: session.currentUser.email,
      status: session.currentUser.status,
    },
    storefrontSessions:
      session.storefrontSessions.map(
        (storefrontSession) => ({
          storefrontCode:
            storefrontSession.storefrontCode,
          sessionToken:
            storefrontSession.sessionToken,
          expiresAt:
            storefrontSession.expiresAt,
        }),
      ),
  };
}

export async function loginPlatformAdministrator(
  input:
    PlatformAdministratorLoginInput,
): Promise<PlatformAdministratorLoginResult> {
  const normalizedEmail = normalizeEmail(
    input.email,
  );

  validateLoginPasswordCandidate(
    input.password,
  );

  const candidates =
    await prisma.platformAdministrator
      .findMany({
        where: {
          status: "ACTIVE",
          user: {
            normalizedEmail,
            status: "ACTIVE",
            emailVerifiedAt: {
              not: null,
            },
            deletedAt: null,
            storefront: {
              status: "ACTIVE",
            },
          },
        },
        take: 2,
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              email: true,
              storefront: {
                select: {
                  code: true,
                },
              },
            },
          },
        },
      });

  if (candidates.length !== 1) {
    await consumePasswordCost(
      input.password,
    );

    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }

  const candidate = candidates[0]!;
  const result = await loginCustomer({
    storefrontCode:
      candidate.user.storefront.code,
    email: normalizedEmail,
    password: input.password,
    tokenSecret: input.tokenSecret,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    sessionTtlMinutes:
      input.sessionTtlMinutes,
  });

  if (
    result.user.id !== candidate.userId
  ) {
    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }

  return {
    ...result,
    administrator: {
      role: candidate.role,
      email: candidate.user.email,
    },
  };
}

export async function validateSession(
  input: {
    storefrontCode: string;
    sessionToken: string;
    tokenSecret: string;
  },
): Promise<ValidatedSession> {
  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const tokenHash = hashOpaqueToken(
    input.sessionToken,
    input.tokenSecret,
  );

  const session =
    await prisma.session.findUnique({
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
            email: true,
            status: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            deletedAt: true,
          },
        },
      },
    });

  const now = new Date();

  if (
    !session ||
    session.storefront.code !==
      storefrontCode ||
    session.storefront.status !== "ACTIVE" ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    session.user.status !== "ACTIVE" ||
    session.user.emailVerifiedAt === null ||
    session.user.deletedAt !== null
  ) {
    throw new AuthServiceError(
      "SESSION_INVALID",
      "The session is invalid or expired.",
    );
  }

  await prisma.session.update({
    where: {
      id: session.id,
    },
    data: {
      lastSeenAt: now,
    },
  });

  return {
    sessionId: session.id,
    userId: session.user.id,
    storefrontId:
      session.user.storefrontId,
    storefrontCode:
      session.storefront.code,
    email: session.user.email,
    expiresAt: session.expiresAt,
  };
}

export async function validatePlatformSession(
  input: {
    sessionToken: string;
    tokenSecret: string;
  },
): Promise<ValidatedPlatformSession> {
  const tokenHash = hashOpaqueToken(
    input.sessionToken,
    input.tokenSecret,
  );

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            deletedAt: true,
            storefront: {
              select: {
                status: true,
              },
            },
            platformAdministrator: {
              select: {
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });

  const now = new Date();
  const administrator =
    session?.user
      .platformAdministrator;

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    session.user.status !== "ACTIVE" ||
    session.user.emailVerifiedAt ===
      null ||
    session.user.deletedAt !== null ||
    session.user.storefront.status !==
      "ACTIVE" ||
    !administrator ||
    administrator.status !== "ACTIVE"
  ) {
    throw new AuthServiceError(
      "SESSION_INVALID",
      "The platform session is invalid or expired.",
    );
  }

  await prisma.session.update({
    where: {
      id: session.id,
    },
    data: {
      lastSeenAt: now,
    },
  });

  return {
    sessionId: session.id,
    userId: session.user.id,
    email: session.user.email,
    role: administrator.role,
    expiresAt: session.expiresAt,
  };
}

export async function revokeSession(
  input: {
    storefrontCode: string;
    sessionToken: string;
    tokenSecret: string;
    reason?: string;
  },
): Promise<boolean> {
  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const storefront =
    await prisma.storefront.findUnique({
      where: {
        code: storefrontCode,
      },
      select: {
        id: true,
      },
    });

  if (!storefront) {
    return false;
  }

  const tokenHash = hashOpaqueToken(
    input.sessionToken,
    input.tokenSecret,
  );

  const result =
    await prisma.session.updateMany({
      where: {
        storefrontId: storefront.id,
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason:
          input.reason?.slice(0, 500) ??
          "USER_LOGOUT",
      },
    });

  return result.count === 1;
}

export async function revokeSessionToken(
  input: {
    sessionToken: string;
    tokenSecret: string;
    reason?: string;
  },
): Promise<boolean> {
  const tokenHash = hashOpaqueToken(
    input.sessionToken,
    input.tokenSecret,
  );

  const result =
    await prisma.session.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason:
          input.reason?.slice(0, 500) ??
          "USER_LOGOUT",
      },
    });

  return result.count === 1;
}

export async function revokeCustomerAccountSessions(
  input: {
    sessionToken: string;
    tokenSecret: string;
    reason?: string;
  },
): Promise<string[]> {
  const tokenHash = hashOpaqueToken(
    input.sessionToken,
    input.tokenSecret,
  );

  const session =
    await prisma.session.findUnique({
      where: {
        tokenHash,
      },
      select: {
        user: {
          select: {
            customerAccountId: true,
          },
        },
      },
    });

  const customerAccountId =
    session?.user.customerAccountId;

  if (!customerAccountId) {
    await revokeSessionToken(input);
    return [];
  }

  const memberships =
    await prisma.user.findMany({
      where: {
        customerAccountId,
      },
      select: {
        storefront: {
          select: {
            code: true,
          },
        },
      },
    });

  await prisma.session.updateMany({
    where: {
      user: {
        customerAccountId,
      },
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedReason:
        input.reason?.slice(0, 500) ??
        "USER_LOGOUT",
    },
  });

  return Array.from(
    new Set(
      memberships.map(
        (membership) =>
          membership.storefront.code,
      ),
    ),
  );
}

export async function revokeAllUserSessions(
  input: {
    storefrontCode: string;
    userId: string;
    reason?: string;
  },
): Promise<number> {
  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const storefront =
    await prisma.storefront.findUnique({
      where: {
        code: storefrontCode,
      },
      select: {
        id: true,
      },
    });

  if (!storefront) {
    return 0;
  }

  return prisma.$transaction(
    async (transaction) => {
      const user =
        await transaction.user.findFirst({
          where: {
            id: input.userId,
            storefrontId: storefront.id,
          },
          select: {
            id: true,
          },
        });

      if (!user) {
        return 0;
      }

      const revoked =
        await transaction.session.updateMany({
          where: {
            userId: user.id,
            storefrontId: storefront.id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            revokedReason:
              input.reason?.slice(0, 500) ??
              "ALL_SESSIONS_REVOKED",
          },
        });

      await transaction.user.update({
        where: {
          id: user.id,
        },
        data: {
          sessionVersion: {
            increment: 1,
          },
        },
      });

      return revoked.count;
    },
  );
}
