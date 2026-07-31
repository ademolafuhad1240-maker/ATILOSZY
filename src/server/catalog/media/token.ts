import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import {
  CatalogServiceError,
} from "../errors";
import type {
  CatalogImageInput,
} from "../types";
import type {
  StoredCatalogMediaAsset,
} from "./types";

const TOKEN_VERSION = 1;
const TOKEN_TTL_MS =
  2 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 8_192;
const MIN_SECRET_LENGTH = 32;

interface CatalogMediaTokenPayload {
  v: number;
  iat: number;
  exp: number;
  storefrontCode: string;
  provider: "cloudinary";
  storageKey: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
}

function requireSecret(
  value: string | undefined,
): string {
  if (
    !value ||
    value.length <
      MIN_SECRET_LENGTH
  ) {
    throw new CatalogServiceError(
      "MEDIA_UNAVAILABLE",
      "Product photo attachment security is not configured correctly.",
    );
  }

  return value;
}

function sign(
  encodedPayload: string,
  secret: string,
): string {
  return createHmac(
    "sha256",
    secret,
  )
    .update(
      `sorvyra:catalog-media:v1:${encodedPayload}`,
    )
    .digest("base64url");
}

function invalidToken(): never {
  throw new CatalogServiceError(
    "VALIDATION",
    "A product photo attachment is invalid or has expired. Upload it again.",
  );
}

export function issueCatalogMediaToken(
  input: {
    storefrontCode: string;
    asset:
      StoredCatalogMediaAsset;
  },
  tokenSecret:
    string | undefined =
      process.env
        .AUTH_TOKEN_SECRET,
  now = Date.now(),
): {
  token: string;
  expiresAt: Date;
} {
  const secret =
    requireSecret(tokenSecret);
  const expiresAt =
    new Date(
      now + TOKEN_TTL_MS,
    );
  const payload:
    CatalogMediaTokenPayload = {
      v: TOKEN_VERSION,
      iat: now,
      exp:
        expiresAt.getTime(),
      storefrontCode:
        input.storefrontCode,
      provider:
        input.asset.provider,
      storageKey:
        input.asset.storageKey,
      url: input.asset.url,
      mimeType:
        input.asset.mimeType,
      byteSize:
        input.asset.byteSize,
      width: input.asset.width,
      height:
        input.asset.height,
    };
  const encoded =
    Buffer.from(
      JSON.stringify(payload),
      "utf8",
    ).toString("base64url");

  return {
    token:
      `${encoded}.${sign(encoded, secret)}`,
    expiresAt,
  };
}

export function verifyCatalogMediaToken(
  token: string,
  expectedStorefrontCode:
    string,
  tokenSecret:
    string | undefined =
      process.env
        .AUTH_TOKEN_SECRET,
  now = Date.now(),
): CatalogImageInput {
  const secret =
    requireSecret(tokenSecret);

  if (
    typeof token !== "string" ||
    token.length < 16 ||
    token.length >
      MAX_TOKEN_LENGTH
  ) {
    return invalidToken();
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return invalidToken();
  }

  const [
    encoded,
    receivedSignature,
  ] = parts;
  const expectedSignature =
    sign(encoded, secret);
  const receivedBuffer =
    Buffer.from(
      receivedSignature,
      "base64url",
    );
  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "base64url",
    );

  if (
    receivedBuffer.length !==
      expectedBuffer.length ||
    !timingSafeEqual(
      receivedBuffer,
      expectedBuffer,
    )
  ) {
    return invalidToken();
  }

  let payload: unknown;

  try {
    payload = JSON.parse(
      Buffer.from(
        encoded,
        "base64url",
      ).toString("utf8"),
    ) as unknown;
  } catch {
    return invalidToken();
  }

  if (
    typeof payload !==
      "object" ||
    payload === null
  ) {
    return invalidToken();
  }

  const value =
    payload as Partial<
      CatalogMediaTokenPayload
    >;

  if (
    value.v !== TOKEN_VERSION ||
    typeof value.iat !==
      "number" ||
    typeof value.exp !==
      "number" ||
    value.iat > now +
      5 * 60 * 1000 ||
    value.exp <= now ||
    value.exp - value.iat !==
      TOKEN_TTL_MS ||
    value.storefrontCode !==
      expectedStorefrontCode ||
    value.provider !==
      "cloudinary" ||
    typeof value.storageKey !==
      "string" ||
    !value.storageKey.startsWith(
      `sorvyra-store/${expectedStorefrontCode.toLowerCase()}/`,
    ) ||
    value.storageKey.length >
      255 ||
    typeof value.url !==
      "string" ||
    value.url.length > 2048 ||
    typeof value.mimeType !==
      "string" ||
    value.mimeType !==
      "image/webp" ||
    typeof value.byteSize !==
      "number" ||
    !Number.isSafeInteger(
      value.byteSize,
    ) ||
    value.byteSize < 1 ||
    typeof value.width !==
      "number" ||
    !Number.isSafeInteger(
      value.width,
    ) ||
    value.width < 1 ||
    typeof value.height !==
      "number" ||
    !Number.isSafeInteger(
      value.height,
    ) ||
    value.height < 1
  ) {
    return invalidToken();
  }

  let url: URL;

  try {
    url = new URL(value.url);
  } catch {
    return invalidToken();
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !==
      "res.cloudinary.com" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    return invalidToken();
  }

  return {
    url: url.toString(),
    storageProvider:
      value.provider,
    storageKey:
      value.storageKey,
    mimeType:
      value.mimeType,
    byteSize:
      value.byteSize,
    width: value.width,
    height: value.height,
  };
}
