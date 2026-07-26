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
  grep -v '^?? scripts/setup-customer-auth-services.sh$' ||
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

if [ -d src/server/auth ]; then
  echo "src/server/auth already exists."
  exit 1
fi

mkdir -p src/server/auth

echo
echo "=== CREATE AUTHENTICATION ERRORS ==="

cat > src/server/auth/errors.ts <<'TS'
export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "STOREFRONT_UNAVAILABLE"
  | "ACCOUNT_CONFLICT"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_UNAVAILABLE"
  | "VERIFICATION_REQUIRED"
  | "VERIFICATION_INVALID"
  | "SESSION_INVALID";

export class AuthServiceError extends Error {
  readonly code: AuthErrorCode;

  constructor(
    code: AuthErrorCode,
    message: string,
  ) {
    super(message);

    this.name = "AuthServiceError";
    this.code = code;
  }
}

export function isPrismaErrorCode(
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
TS

echo
echo "=== CREATE AUTHENTICATION TYPES ==="

cat > src/server/auth/types.ts <<'TS'
export interface RegisterCustomerInput {
  storefrontCode: string;
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  marketingOptIn?: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  tokenSecret: string;
}

export interface RegistrationResult {
  user: {
    id: string;
    storefrontId: string;
    status: string;
  };
  emailVerificationToken: string;
  phoneChallengeId: string;
  phoneVerificationCode: string;
}

export interface VerificationResult {
  userId: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: string;
}

export interface LoginCustomerInput {
  storefrontCode: string;
  email: string;
  password: string;
  tokenSecret: string;
  ipAddress?: string;
  userAgent?: string;
  sessionTtlMinutes?: number;
}

export interface LoginResult {
  sessionToken: string;
  session: {
    id: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    storefrontId: string;
    email: string;
    status: string;
  };
}

export interface ValidatedSession {
  sessionId: string;
  userId: string;
  storefrontId: string;
  storefrontCode: string;
  email: string;
  expiresAt: Date;
}
TS

echo
echo "=== CREATE AUTHENTICATION CRYPTO UTILITIES ==="

cat > src/server/auth/crypto.ts <<'TS'
import "server-only";

import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import { AuthServiceError } from "./errors";

const PASSWORD_VERSION = 1;
const SCRYPT_COST = 32768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const MIN_TOKEN_SECRET_LENGTH = 32;

function derivePasswordKey(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export function normalizeStorefrontCode(
  value: string,
): string {
  const normalized = value
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9]{2,12}$/.test(normalized)) {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      "The storefront code is invalid.",
    );
  }

  return normalized;
}

export function normalizeEmail(
  value: string,
): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLowerCase();

  if (
    normalized.length < 3 ||
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      "A valid email address is required.",
    );
  }

  return normalized;
}

export function normalizePhone(
  value: string,
): string {
  let normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/[()\s.-]/g, "");

  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      "The phone number must use international format.",
    );
  }

  return normalized;
}

export function normalizePersonName(
  value: string,
  fieldName: string,
): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

  if (
    normalized.length < 1 ||
    normalized.length > 100
  ) {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      `${fieldName} must contain between 1 and 100 characters.`,
    );
  }

  return normalized;
}

export function validatePassword(
  password: string,
): void {
  if (typeof password !== "string") {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      "A password is required.",
    );
  }

  if (
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      `Passwords must contain between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
    );
  }

  if (password.trim().length === 0) {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      "The password cannot contain only whitespace.",
    );
  }
}

export async function hashPassword(
  password: string,
): Promise<string> {
  validatePassword(password);

  const salt = randomBytes(16);

  const derivedKey = await derivePasswordKey(
    password,
    salt,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
  );

  return [
    "scrypt",
    `v=${PASSWORD_VERSION}`,
    `N=${SCRYPT_COST}`,
    `r=${SCRYPT_BLOCK_SIZE}`,
    `p=${SCRYPT_PARALLELIZATION}`,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

interface ParsedPasswordHash {
  version: number;
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  hash: Buffer;
}

function parsePasswordHash(
  encodedHash: string,
): ParsedPasswordHash | null {
  const match = encodedHash.match(
    /^scrypt\$v=([0-9]+)\$N=([0-9]+)\$r=([0-9]+)\$p=([0-9]+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/,
  );

  if (!match) {
    return null;
  }

  const version = Number(match[1]);
  const cost = Number(match[2]);
  const blockSize = Number(match[3]);
  const parallelization = Number(match[4]);

  if (
    !Number.isSafeInteger(version) ||
    !Number.isSafeInteger(cost) ||
    !Number.isSafeInteger(blockSize) ||
    !Number.isSafeInteger(parallelization) ||
    cost < 2 ||
    cost > 1048576 ||
    blockSize < 1 ||
    blockSize > 32 ||
    parallelization < 1 ||
    parallelization > 16
  ) {
    return null;
  }

  try {
    return {
      version,
      cost,
      blockSize,
      parallelization,
      salt: Buffer.from(match[5], "base64url"),
      hash: Buffer.from(match[6], "base64url"),
    };
  } catch {
    return null;
  }
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash);

  if (
    !parsed ||
    parsed.hash.length !== SCRYPT_KEY_LENGTH
  ) {
    return false;
  }

  const derivedKey = await derivePasswordKey(
    password,
    parsed.salt,
    parsed.cost,
    parsed.blockSize,
    parsed.parallelization,
  );

  return timingSafeEqual(
    derivedKey,
    parsed.hash,
  );
}

export function passwordNeedsRehash(
  encodedHash: string,
): boolean {
  const parsed = parsePasswordHash(encodedHash);

  if (!parsed) {
    return true;
  }

  return (
    parsed.version !== PASSWORD_VERSION ||
    parsed.cost !== SCRYPT_COST ||
    parsed.blockSize !== SCRYPT_BLOCK_SIZE ||
    parsed.parallelization !==
      SCRYPT_PARALLELIZATION
  );
}

export function assertTokenSecret(
  tokenSecret: string,
): void {
  if (
    typeof tokenSecret !== "string" ||
    tokenSecret.length < MIN_TOKEN_SECRET_LENGTH
  ) {
    throw new AuthServiceError(
      "VALIDATION_ERROR",
      "The authentication token secret is missing or too short.",
    );
  }
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(
  token: string,
  tokenSecret: string,
): string {
  assertTokenSecret(tokenSecret);

  return createHmac(
    "sha256",
    tokenSecret,
  )
    .update(`sorvyra:opaque:${token}`)
    .digest("hex");
}

export interface PhoneChallenge {
  challengeId: string;
  code: string;
  codeHash: string;
}

export function createPhoneChallenge(
  tokenSecret: string,
): PhoneChallenge {
  assertTokenSecret(tokenSecret);

  const challengeId = createOpaqueToken();

  const code = randomInt(
    0,
    1000000,
  )
    .toString()
    .padStart(6, "0");

  return {
    challengeId,
    code,
    codeHash: hashPhoneCode(
      challengeId,
      code,
      tokenSecret,
    ),
  };
}

export function hashPhoneCode(
  challengeId: string,
  code: string,
  tokenSecret: string,
): string {
  assertTokenSecret(tokenSecret);

  return createHmac(
    "sha256",
    tokenSecret,
  )
    .update(
      `sorvyra:phone:${challengeId}:${code}`,
    )
    .digest("hex");
}

export function verifyPhoneCodeHash(
  challengeId: string,
  code: string,
  expectedHash: string,
  tokenSecret: string,
): boolean {
  const actualHash = hashPhoneCode(
    challengeId,
    code,
    tokenSecret,
  );

  const actualBuffer = Buffer.from(
    actualHash,
    "hex",
  );

  const expectedBuffer = Buffer.from(
    expectedHash,
    "hex",
  );

  if (
    actualBuffer.length !== expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    actualBuffer,
    expectedBuffer,
  );
}
TS

echo
echo "=== CREATE REGISTRATION SERVICE ==="

cat > src/server/auth/registration.ts <<'TS'
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
TS

echo
echo "=== CREATE VERIFICATION SERVICES ==="

cat > src/server/auth/verification.ts <<'TS'
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
        user.emailVerifiedAt !== null &&
        user.phoneVerifiedAt !== null
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
        user.emailVerifiedAt !== null &&
        user.phoneVerifiedAt !== null
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
TS

echo
echo "=== CREATE LOGIN AND SESSION SERVICES ==="

cat > src/server/auth/session.ts <<'TS'
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
    user.status !== "ACTIVE" ||
    user.emailVerifiedAt === null ||
    user.phoneVerifiedAt === null
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
      "Email and phone verification are required.",
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
        currentUser.phoneVerifiedAt ===
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
    session.user.phoneVerifiedAt === null ||
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
TS

echo
echo "=== CREATE AUTHENTICATION EXPORTS ==="

cat > src/server/auth/index.ts <<'TS'
export {
  AuthServiceError,
  isPrismaErrorCode,
} from "./errors";

export {
  assertTokenSecret,
  createOpaqueToken,
  createPhoneChallenge,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  normalizePersonName,
  normalizePhone,
  normalizeStorefrontCode,
  passwordNeedsRehash,
  validatePassword,
  verifyPassword,
  verifyPhoneCodeHash,
} from "./crypto";

export {
  registerCustomer,
} from "./registration";

export {
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "./verification";

export {
  loginCustomer,
  revokeAllUserSessions,
  revokeSession,
  validateSession,
} from "./session";

export type {
  LoginCustomerInput,
  LoginResult,
  RegisterCustomerInput,
  RegistrationResult,
  ValidatedSession,
  VerificationResult,
} from "./types";
TS

echo
echo "=== CREATE AUTHENTICATION SERVICE AUDIT ==="

cat > scripts/audit-customer-auth-services.ts <<'TS'
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
TS

echo
echo "=== REGISTER AUTHENTICATION AUDIT COMMAND ==="

npm pkg set \
  "scripts.db:audit:auth=node --env-file=.env --conditions=react-server --import tsx scripts/audit-customer-auth-services.ts"

echo
echo "=== VALIDATE DATABASE STATE ==="

npm run db:up
npm run db:validate
npm run db:generate
npx prisma migrate status

echo
echo "=== RUN AUTHENTICATION SERVICE AUDIT ==="

npm run db:audit:auth

echo
echo "=== RUN IDENTITY AND COMMERCE AUDITS ==="

npm run db:audit:identity
npm run db:audit
npm run db:audit:catalog
npm run db:audit:services

echo
echo "=== RUN APPLICATION VALIDATION ==="

npm run lint
npm run build

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "PHASE 2E-B CUSTOMER AUTHENTICATION SERVICES PASSED"
