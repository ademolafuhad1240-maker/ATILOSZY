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
