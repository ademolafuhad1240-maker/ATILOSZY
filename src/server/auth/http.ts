import "server-only";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  normalizeStorefrontCode,
} from "./crypto";
import {
  isAuthDeliveryUnavailableError,
} from "./delivery";
import {
  AuthServiceError,
  type AuthErrorCode,
} from "./errors";

const MAX_JSON_BODY_BYTES = 16 * 1024;
const MIN_TOKEN_SECRET_LENGTH = 32;

type JsonObject = Record<string, unknown>;

type ErrorResponseCode =
  | AuthErrorCode
  | "BAD_REQUEST"
  | "BODY_TOO_LARGE"
  | "CONTENT_TYPE_REQUIRED"
  | "FORBIDDEN_ORIGIN"
  | "AUTH_NOT_READY"
  | "AUTH_DELIVERY_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ErrorResponseCode;

  constructor(
    status: number,
    code: ErrorResponseCode,
    message: string,
  ) {
    super(message);

    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

function applyPrivateResponseHeaders(
  response: NextResponse,
): NextResponse {
  response.headers.set(
    "Cache-Control",
    "no-store, max-age=0, must-revalidate",
  );

  response.headers.set(
    "Pragma",
    "no-cache",
  );

  response.headers.set(
    "Expires",
    "0",
  );

  response.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  response.headers.set(
    "Referrer-Policy",
    "no-referrer",
  );

  response.headers.set(
    "Vary",
    "Cookie, Origin",
  );

  return response;
}

export function authJsonResponse(
  payload: unknown,
  status = 200,
): NextResponse {
  return applyPrivateResponseHeaders(
    NextResponse.json(
      payload,
      {
        status,
      },
    ),
  );
}

const authErrorResponses: Record<
  AuthErrorCode,
  {
    status: number;
    message: string;
  }
> = {
  VALIDATION_ERROR: {
    status: 400,
    message:
      "The submitted information is invalid.",
  },
  STOREFRONT_UNAVAILABLE: {
    status: 404,
    message:
      "The selected storefront is unavailable.",
  },
  ACCOUNT_CONFLICT: {
    status: 409,
    message:
      "An account could not be created with those details.",
  },
  INVALID_CREDENTIALS: {
    status: 401,
    message:
      "The email or password is incorrect.",
  },
  ACCOUNT_LOCKED: {
    status: 429,
    message:
      "The account is temporarily locked.",
  },
  ACCOUNT_UNAVAILABLE: {
    status: 403,
    message:
      "The account is unavailable.",
  },
  VERIFICATION_REQUIRED: {
    status: 403,
    message:
      "Email verification is required.",
  },
  VERIFICATION_INVALID: {
    status: 400,
    message:
      "The verification request is invalid or expired.",
  },
  SESSION_INVALID: {
    status: 401,
    message:
      "The session is invalid or expired.",
  },
};

export function authApiErrorResponse(
  error: unknown,
): NextResponse {
  if (error instanceof ApiRequestError) {
    return authJsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status,
    );
  }

  if (
    isAuthDeliveryUnavailableError(
      error,
    )
  ) {
    return authJsonResponse(
      {
        ok: false,
        error: {
          code:
            "AUTH_DELIVERY_UNAVAILABLE",
          message:
            "Verification and recovery delivery is not available yet.",
        },
      },
      503,
    );
  }

  if (error instanceof AuthServiceError) {
    const responseDefinition =
      authErrorResponses[error.code];

    const response = authJsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message:
            responseDefinition.message,
        },
      },
      responseDefinition.status,
    );

    if (error.code === "ACCOUNT_LOCKED") {
      response.headers.set(
        "Retry-After",
        "900",
      );
    }

    return response;
  }

  console.error(
    "Authentication API request failed.",
    {
      errorName:
        error instanceof Error
          ? error.name
          : "UnknownError",
    },
  );

  return authJsonResponse(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          "The request could not be completed.",
      },
    },
    500,
  );
}

export async function readJsonObject(
  request: NextRequest,
): Promise<JsonObject> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    throw new ApiRequestError(
      415,
      "CONTENT_TYPE_REQUIRED",
      "The request must contain JSON.",
    );
  }

  const contentLengthHeader =
    request.headers.get("content-length");

  if (contentLengthHeader) {
    const contentLength = Number(
      contentLengthHeader,
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength >
        MAX_JSON_BODY_BYTES
    ) {
      throw new ApiRequestError(
        413,
        "BODY_TOO_LARGE",
        "The request body is too large.",
      );
    }
  }

  const text = await request.text();

  const encodedLength =
    new TextEncoder().encode(text).byteLength;

  if (
    encodedLength === 0 ||
    encodedLength >
      MAX_JSON_BODY_BYTES
  ) {
    throw new ApiRequestError(
      encodedLength === 0 ? 400 : 413,
      encodedLength === 0
        ? "BAD_REQUEST"
        : "BODY_TOO_LARGE",
      encodedLength === 0
        ? "A JSON request body is required."
        : "The request body is too large.",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiRequestError(
      400,
      "BAD_REQUEST",
      "The JSON request body is invalid.",
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new ApiRequestError(
      400,
      "BAD_REQUEST",
      "The JSON request body must be an object.",
    );
  }

  return parsed as JsonObject;
}

export function requiredString(
  body: JsonObject,
  key: string,
  options?: {
    maxLength?: number;
    trim?: boolean;
  },
): string {
  const value = body[key];
  const maxLength =
    options?.maxLength ?? 1000;
  const shouldTrim =
    options?.trim ?? true;

  if (typeof value !== "string") {
    throw new ApiRequestError(
      400,
      "BAD_REQUEST",
      `${key} is required.`,
    );
  }

  const resolved = shouldTrim
    ? value.trim()
    : value;

  if (
    resolved.length === 0 ||
    resolved.length > maxLength
  ) {
    throw new ApiRequestError(
      400,
      "BAD_REQUEST",
      `${key} is invalid.`,
    );
  }

  return resolved;
}

export function optionalString(
  body: JsonObject,
  key: string,
  options?: {
    maxLength?: number;
    trim?: boolean;
  },
): string | undefined {
  const value = body[key];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  return requiredString(
    body,
    key,
    options,
  );
}

export function requiredBoolean(
  body: JsonObject,
  key: string,
): boolean {
  const value = body[key];

  if (typeof value !== "boolean") {
    throw new ApiRequestError(
      400,
      "BAD_REQUEST",
      `${key} must be a boolean.`,
    );
  }

  return value;
}

export function optionalBoolean(
  body: JsonObject,
  key: string,
): boolean | undefined {
  const value = body[key];

  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  return requiredBoolean(body, key);
}

function normalizeOrigin(
  value: string,
): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new ApiRequestError(
      403,
      "FORBIDDEN_ORIGIN",
      "The request origin is not trusted.",
    );
  }

  if (
    parsed.protocol !== "http:" &&
    parsed.protocol !== "https:"
  ) {
    throw new ApiRequestError(
      403,
      "FORBIDDEN_ORIGIN",
      "The request origin is not trusted.",
    );
  }

  if (
    parsed.username ||
    parsed.password
  ) {
    throw new ApiRequestError(
      403,
      "FORBIDDEN_ORIGIN",
      "The request origin is not trusted.",
    );
  }

  return parsed.origin;
}

export function getAppOrigin(): string {
  const value =
    process.env.APP_ORIGIN?.trim();

  if (!value) {
    throw new Error(
      "APP_ORIGIN is missing from the server environment.",
    );
  }

  const origin = normalizeOrigin(value);
  const parsed = new URL(origin);

  if (parsed.protocol === "http:") {
    const localHosts = new Set([
      "localhost",
      "127.0.0.1",
      "[::1]",
    ]);

    if (!localHosts.has(parsed.hostname)) {
      throw new Error(
        "Non-local APP_ORIGIN values must use HTTPS.",
      );
    }
  }

  return origin;
}

function trustedOrigins(): Set<string> {
  const origins = new Set<string>([
    getAppOrigin(),
  ]);

  const additionalOrigins =
    process.env.AUTH_TRUSTED_ORIGINS
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  for (
    const origin of additionalOrigins
  ) {
    origins.add(
      normalizeOrigin(origin),
    );
  }

  return origins;
}

export function assertTrustedOrigin(
  request: NextRequest,
): void {
  const fetchSite = request.headers
    .get("sec-fetch-site")
    ?.toLowerCase();

  if (fetchSite === "cross-site") {
    throw new ApiRequestError(
      403,
      "FORBIDDEN_ORIGIN",
      "The request origin is not trusted.",
    );
  }

  const originHeader =
    request.headers.get("origin");

  if (!originHeader) {
    throw new ApiRequestError(
      403,
      "FORBIDDEN_ORIGIN",
      "The request origin is required.",
    );
  }

  const origin =
    normalizeOrigin(originHeader);

  if (!trustedOrigins().has(origin)) {
    throw new ApiRequestError(
      403,
      "FORBIDDEN_ORIGIN",
      "The request origin is not trusted.",
    );
  }
}

export function assertRegistrationApiEnabled(): void {
  if (
    process.env
      .AUTH_REGISTRATION_API_ENABLED !==
    "true"
  ) {
    throw new ApiRequestError(
      503,
      "AUTH_NOT_READY",
      "Customer registration is not available yet.",
    );
  }
}

export function getAuthTokenSecret(): string {
  const value =
    process.env.AUTH_TOKEN_SECRET;

  if (
    !value ||
    value.length <
      MIN_TOKEN_SECRET_LENGTH
  ) {
    throw new Error(
      "AUTH_TOKEN_SECRET is missing or too short.",
    );
  }

  return value;
}

export function getClientIp(
  request: NextRequest,
): string | undefined {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for",
    );

  const candidate =
    forwardedFor
      ?.split(",")[0]
      ?.trim() ||
    request.headers
      .get("x-real-ip")
      ?.trim();

  if (!candidate) {
    return undefined;
  }

  return candidate.slice(0, 64);
}

export function getUserAgent(
  request: NextRequest,
): string | undefined {
  return request.headers
    .get("user-agent")
    ?.slice(0, 1000);
}

function secureCookiesEnabled(): boolean {
  return (
    new URL(getAppOrigin()).protocol ===
    "https:"
  );
}

export function getSessionCookieName(
  storefrontCode: string,
): string {
  const normalizedCode =
    normalizeStorefrontCode(
      storefrontCode,
    ).toLowerCase();

  const baseName =
    `sorvyra_session_${normalizedCode}`;

  return secureCookiesEnabled()
    ? `__Host-${baseName}`
    : baseName;
}

export function readSessionCookie(
  request: NextRequest,
  storefrontCode: string,
): string | null {
  const name = getSessionCookieName(
    storefrontCode,
  );

  return (
    request.cookies.get(name)?.value ??
    null
  );
}

export function setSessionCookie(
  response: NextResponse,
  storefrontCode: string,
  sessionToken: string,
  expiresAt: Date,
): void {
  response.cookies.set({
    name: getSessionCookieName(
      storefrontCode,
    ),
    value: sessionToken,
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(
  response: NextResponse,
  storefrontCode: string,
): void {
  response.cookies.set({
    name: getSessionCookieName(
      storefrontCode,
    ),
    value: "",
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

export function getPlatformSessionCookieName(): string {
  const baseName =
    "sorvyra_platform_session";

  return secureCookiesEnabled()
    ? `__Host-${baseName}`
    : baseName;
}

export function readPlatformSessionCookie(
  request: NextRequest,
): string | null {
  return (
    request.cookies.get(
      getPlatformSessionCookieName(),
    )?.value ?? null
  );
}

export function setPlatformSessionCookie(
  response: NextResponse,
  sessionToken: string,
  expiresAt: Date,
): void {
  response.cookies.set({
    name:
      getPlatformSessionCookieName(),
    value: sessionToken,
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearPlatformSessionCookie(
  response: NextResponse,
): void {
  response.cookies.set({
    name:
      getPlatformSessionCookieName(),
    value: "",
    httpOnly: true,
    secure: secureCookiesEnabled(),
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}
