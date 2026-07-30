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

  let user = await prisma.user.findUnique({
    where: {
      storefrontId_normalizedEmail: {
        storefrontId: storefront.id,
        normalizedEmail,
      },
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

  if (!user) {
    await consumePasswordCost(
      input.password,
    );

    throw new AuthServiceError(
      "INVALID_CREDENTIALS",
      "The email or password is incorrect.",
    );
  }

  const now = new Date();

  if (
    user.lockedUntil &&
    user.lockedUntil > now
  ) {
    throw new AuthServiceError(
      "ACCOUNT_LOCKED",
      "The account is temporarily locked.",
    );
  }

  if (
    user.lockedUntil &&
    user.lockedUntil <= now
  ) {
    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
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
  }

  const validPassword = await verifyPassword(
    input.password,
    user.passwordHash,
  );

  if (!validPassword) {
    const failedUser =
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          failedLoginAttempts: {
            increment: 1,
          },
        },
        select: {
          failedLoginAttempts: true,
        },
      });

    if (
      failedUser.failedLoginAttempts >=
      MAX_FAILED_LOGIN_ATTEMPTS
    ) {
      const lockedUntil = new Date(
        now.getTime() +
          ACCOUNT_LOCK_MINUTES *
            60 *
            1000,
      );

      await prisma.user.update({
        where: {
          id: user.id,
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
    user = await prisma.user.update({
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
  }

  if (
    user.status !== "ACTIVE" ||
    user.emailVerifiedAt === null
  ) {
    await prisma.user.update({
      where: {
        id: user.id,
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

  const sessionToken =
    createOpaqueToken();

  const tokenHash = hashOpaqueToken(
    sessionToken,
    input.tokenSecret,
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
            storefrontId: true,
            email: true,
            passwordHash: true,
            status: true,
            emailVerifiedAt: true,
            phoneVerifiedAt: true,
            deletedAt: true,
          },
        });

      if (
        !currentUser ||
        currentUser.status !== "ACTIVE" ||
        currentUser.emailVerifiedAt ===
          null ||
        currentUser.deletedAt !== null
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

      await transaction.user.update({
        where: {
          id: currentUser.id,
        },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
          ...(passwordHashUpdate
            ? {
                passwordHash:
                  passwordHashUpdate,
                sessionVersion: {
                  increment: 1,
                },
              }
            : {}),
        },
      });

      const createdSession =
        await transaction.session.create({
          data: {
            userId: currentUser.id,
            storefrontId:
              currentUser.storefrontId,
            tokenHash,
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

      return {
        createdSession,
        currentUser,
      };
    },
  );

  return {
    sessionToken,
    session: {
      id: session.createdSession.id,
      expiresAt:
        session.createdSession.expiresAt,
    },
    user: {
      id: session.currentUser.id,
      storefrontId:
        session.currentUser.storefrontId,
      email: session.currentUser.email,
      status: session.currentUser.status,
    },
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
