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
  grep -v '^?? scripts/setup-auth-api-routes.sh$' ||
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

echo
echo "=== VERIFY LOCAL ENVIRONMENT SAFETY ==="

test -f .env

if ! git check-ignore -q .env; then
  echo "The local .env file is not ignored by Git."
  exit 1
fi

python - <<'PY'
from pathlib import Path
import secrets

path = Path(".env")
content = path.read_text(encoding="utf-8")

lines_to_add = []

if not any(
    line.startswith("AUTH_TOKEN_SECRET=")
    for line in content.splitlines()
):
    lines_to_add.append(
        f"AUTH_TOKEN_SECRET={secrets.token_hex(32)}"
    )

if not any(
    line.startswith("APP_ORIGIN=")
    for line in content.splitlines()
):
    lines_to_add.append(
        "APP_ORIGIN=http://localhost:3000"
    )

if not any(
    line.startswith("AUTH_TRUSTED_ORIGINS=")
    for line in content.splitlines()
):
    lines_to_add.append(
        "AUTH_TRUSTED_ORIGINS="
    )

if not any(
    line.startswith(
        "AUTH_REGISTRATION_API_ENABLED="
    )
    for line in content.splitlines()
):
    lines_to_add.append(
        "AUTH_REGISTRATION_API_ENABLED=false"
    )

if lines_to_add:
    normalized = content.rstrip()

    if normalized:
        normalized += "\n"

    normalized += "\n".join(lines_to_add)
    normalized += "\n"

    path.write_text(
        normalized,
        encoding="utf-8",
    )

    print(
        "Added missing local authentication settings "
        "without displaying secret values."
    )
else:
    print(
        "Local authentication settings already exist."
    )
PY

node --env-file=.env <<'NODE'
const secret = process.env.AUTH_TOKEN_SECRET;
const origin = process.env.APP_ORIGIN;

if (!secret || secret.length < 32) {
  throw new Error(
    "AUTH_TOKEN_SECRET must contain at least 32 characters.",
  );
}

if (!origin) {
  throw new Error(
    "APP_ORIGIN is missing.",
  );
}

const parsedOrigin = new URL(origin);

if (
  parsedOrigin.protocol !== "http:" &&
  parsedOrigin.protocol !== "https:"
) {
  throw new Error(
    "APP_ORIGIN must use HTTP or HTTPS.",
  );
}

console.log(
  "PASS: Local authentication environment is configured.",
);
NODE

echo
echo "=== UPDATE ENVIRONMENT TEMPLATE ==="

python - <<'PY'
from pathlib import Path

path = Path(".env.example")
content = (
    path.read_text(encoding="utf-8")
    if path.exists()
    else ""
)

entries = [
    (
        "AUTH_TOKEN_SECRET",
        "AUTH_TOKEN_SECRET=replace-with-at-least-32-random-characters",
    ),
    (
        "APP_ORIGIN",
        "APP_ORIGIN=http://localhost:3000",
    ),
    (
        "AUTH_TRUSTED_ORIGINS",
        "AUTH_TRUSTED_ORIGINS=",
    ),
    (
        "AUTH_REGISTRATION_API_ENABLED",
        "AUTH_REGISTRATION_API_ENABLED=false",
    ),
]

new_lines = []

for key, line in entries:
    if not any(
        existing.startswith(f"{key}=")
        for existing in content.splitlines()
    ):
        new_lines.append(line)

if new_lines:
    normalized = content.rstrip()

    if normalized:
        normalized += "\n\n"

    normalized += (
        "# Customer authentication\n"
        + "\n".join(new_lines)
        + "\n"
    )

    path.write_text(
        normalized,
        encoding="utf-8",
    )

    print(
        "Added authentication placeholders to .env.example."
    )
else:
    print(
        ".env.example already contains authentication settings."
    )
PY

echo
echo "=== CREATE AUTHENTICATION HTTP UTILITIES ==="

cat > src/server/auth/http.ts <<'TS'
import "server-only";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  normalizeStorefrontCode,
} from "./crypto";
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
      "Email and phone verification are required.",
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
TS

echo
echo "=== CREATE AUTHENTICATION ROUTE DIRECTORIES ==="

mkdir -p \
  src/app/api/auth/register \
  src/app/api/auth/login \
  src/app/api/auth/logout \
  src/app/api/auth/session \
  src/app/api/auth/verify/email \
  src/app/api/auth/verify/phone

echo
echo "=== CREATE REGISTRATION ROUTE ==="

cat > src/app/api/auth/register/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  registerCustomer,
} from "../../../../server/auth";
import {
  assertRegistrationApiEnabled,
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  optionalBoolean,
  optionalString,
  readJsonObject,
  requiredBoolean,
  requiredString,
} from "../../../../server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);
    assertRegistrationApiEnabled();

    const body =
      await readJsonObject(request);

    const result =
      await registerCustomer({
        storefrontCode:
          requiredString(
            body,
            "storefrontCode",
            {
              maxLength: 12,
            },
          ),
        email: requiredString(
          body,
          "email",
          {
            maxLength: 254,
          },
        ),
        phone: requiredString(
          body,
          "phone",
          {
            maxLength: 32,
          },
        ),
        password: requiredString(
          body,
          "password",
          {
            maxLength: 128,
            trim: false,
          },
        ),
        firstName: requiredString(
          body,
          "firstName",
          {
            maxLength: 100,
          },
        ),
        lastName: requiredString(
          body,
          "lastName",
          {
            maxLength: 100,
          },
        ),
        displayName: optionalString(
          body,
          "displayName",
          {
            maxLength: 100,
          },
        ),
        marketingOptIn:
          optionalBoolean(
            body,
            "marketingOptIn",
          ),
        termsAccepted:
          requiredBoolean(
            body,
            "termsAccepted",
          ),
        privacyAccepted:
          requiredBoolean(
            body,
            "privacyAccepted",
          ),
        tokenSecret:
          getAuthTokenSecret(),
      });

    return authJsonResponse(
      {
        ok: true,
        data: {
          user: {
            id: result.user.id,
            status:
              result.user.status,
          },
          verification: {
            emailRequired: true,
            phoneRequired: true,
            delivery:
              "PENDING_PROVIDER_INTEGRATION",
          },
        },
      },
      201,
    );
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
TS

echo
echo "=== CREATE EMAIL VERIFICATION ROUTE ==="

cat > src/app/api/auth/verify/email/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  verifyCustomerEmail,
} from "../../../../../server/auth";
import {
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  readJsonObject,
  requiredString,
} from "../../../../../server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const result =
      await verifyCustomerEmail({
        storefrontCode:
          requiredString(
            body,
            "storefrontCode",
            {
              maxLength: 12,
            },
          ),
        token: requiredString(
          body,
          "token",
          {
            maxLength: 256,
            trim: false,
          },
        ),
        tokenSecret:
          getAuthTokenSecret(),
      });

    return authJsonResponse({
      ok: true,
      data: result,
    });
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
TS

echo
echo "=== CREATE PHONE VERIFICATION ROUTE ==="

cat > src/app/api/auth/verify/phone/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  verifyCustomerPhone,
} from "../../../../../server/auth";
import {
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  readJsonObject,
  requiredString,
} from "../../../../../server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const result =
      await verifyCustomerPhone({
        storefrontCode:
          requiredString(
            body,
            "storefrontCode",
            {
              maxLength: 12,
            },
          ),
        challengeId:
          requiredString(
            body,
            "challengeId",
            {
              maxLength: 256,
              trim: false,
            },
          ),
        code: requiredString(
          body,
          "code",
          {
            maxLength: 12,
            trim: false,
          },
        ),
        tokenSecret:
          getAuthTokenSecret(),
      });

    return authJsonResponse({
      ok: true,
      data: result,
    });
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
TS

echo
echo "=== CREATE LOGIN ROUTE ==="

cat > src/app/api/auth/login/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  loginCustomer,
} from "../../../../server/auth";
import {
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  getClientIp,
  getUserAgent,
  readJsonObject,
  requiredString,
  setSessionCookie,
} from "../../../../server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requiredString(
        body,
        "storefrontCode",
        {
          maxLength: 12,
        },
      );

    const result =
      await loginCustomer({
        storefrontCode,
        email: requiredString(
          body,
          "email",
          {
            maxLength: 254,
          },
        ),
        password: requiredString(
          body,
          "password",
          {
            maxLength: 1024,
            trim: false,
          },
        ),
        tokenSecret:
          getAuthTokenSecret(),
        ipAddress:
          getClientIp(request),
        userAgent:
          getUserAgent(request),
      });

    const response =
      authJsonResponse({
        ok: true,
        data: {
          user: result.user,
          session: {
            expiresAt:
              result.session.expiresAt
                .toISOString(),
          },
        },
      });

    setSessionCookie(
      response,
      storefrontCode,
      result.sessionToken,
      result.session.expiresAt,
    );

    return response;
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
TS

echo
echo "=== CREATE CURRENT SESSION ROUTE ==="

cat > src/app/api/auth/session/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  AuthServiceError,
  validateSession,
} from "../../../../server/auth";
import {
  authApiErrorResponse,
  authJsonResponse,
  getAuthTokenSecret,
  readSessionCookie,
} from "../../../../server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const storefrontCode =
      request.nextUrl.searchParams
        .get("storefrontCode")
        ?.trim();

    if (!storefrontCode) {
      throw new AuthServiceError(
        "VALIDATION_ERROR",
        "A storefront code is required.",
      );
    }

    const sessionToken =
      readSessionCookie(
        request,
        storefrontCode,
      );

    if (!sessionToken) {
      throw new AuthServiceError(
        "SESSION_INVALID",
        "The session is invalid or expired.",
      );
    }

    const session =
      await validateSession({
        storefrontCode,
        sessionToken,
        tokenSecret:
          getAuthTokenSecret(),
      });

    return authJsonResponse({
      ok: true,
      data: {
        session: {
          id: session.sessionId,
          expiresAt:
            session.expiresAt
              .toISOString(),
        },
        user: {
          id: session.userId,
          storefrontId:
            session.storefrontId,
          storefrontCode:
            session.storefrontCode,
          email: session.email,
        },
      },
    });
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
TS

echo
echo "=== CREATE LOGOUT ROUTE ==="

cat > src/app/api/auth/logout/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  revokeSession,
} from "../../../../server/auth";
import {
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  clearSessionCookie,
  getAuthTokenSecret,
  readJsonObject,
  readSessionCookie,
  requiredString,
} from "../../../../server/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requiredString(
        body,
        "storefrontCode",
        {
          maxLength: 12,
        },
      );

    const sessionToken =
      readSessionCookie(
        request,
        storefrontCode,
      );

    if (sessionToken) {
      await revokeSession({
        storefrontCode,
        sessionToken,
        tokenSecret:
          getAuthTokenSecret(),
        reason: "USER_LOGOUT",
      });
    }

    const response =
      authJsonResponse({
        ok: true,
        data: {
          loggedOut: true,
        },
      });

    clearSessionCookie(
      response,
      storefrontCode,
    );

    return response;
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
TS

echo
echo "=== CREATE AUTHENTICATION HTTP AUDIT ==="

cat > scripts/audit-auth-api-routes.ts <<'TS'
import {
  type ChildProcessByStdio,
  spawn,
} from "node:child_process";
import type { Readable } from "node:stream";
import {
  randomBytes,
  randomInt,
} from "node:crypto";

import { prisma } from "../src/lib/prisma";
import {
  normalizeEmail,
  registerCustomer,
} from "../src/server/auth";

interface HttpResult {
  status: number;
  json: unknown;
  text: string;
  setCookie: string | null;
}

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function responseContainsKey(
  value: unknown,
  key: string,
): boolean {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) =>
      responseContainsKey(item, key),
    );
  }

  const record =
    value as Record<string, unknown>;

  if (
    Object.prototype.hasOwnProperty.call(
      record,
      key,
    )
  ) {
    return true;
  }

  return Object.values(record).some(
    (item) =>
      responseContainsKey(item, key),
  );
}

async function waitForServerExit(
  server: ChildProcessByStdio<null, Readable, Readable>,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return true;
  }

  return new Promise((resolve) => {
    let settled = false;

    let timer:
      | ReturnType<typeof setTimeout>
      | null = null;

    const finish = (
      exited: boolean,
    ): void => {
      if (settled) {
        return;
      }

      settled = true;

      if (timer) {
        clearTimeout(timer);
      }

      server.removeListener(
        "exit",
        handleExit,
      );

      resolve(exited);
    };

    const handleExit = (): void => {
      finish(true);
    };

    server.once(
      "exit",
      handleExit,
    );

    timer = setTimeout(
      () => finish(false),
      timeoutMilliseconds,
    );

    if (
      server.exitCode !== null ||
      server.signalCode !== null
    ) {
      finish(true);
    }
  });
}

async function stopServer(
  server: ChildProcessByStdio<null, Readable, Readable>,
): Promise<void> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return;
  }

  server.kill("SIGTERM");

  const terminated =
    await waitForServerExit(
      server,
      5000,
    );

  if (terminated) {
    return;
  }

  server.kill("SIGKILL");

  const killed =
    await waitForServerExit(
      server,
      2000,
    );

  if (!killed) {
    console.warn(
      "The temporary Next.js process did not confirm shutdown.",
    );
  }
}

async function main(): Promise<void> {
  console.log(
    "=== AUTHENTICATION API ROUTE AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const suffix = randomBytes(8)
    .toString("hex");

  const routeEmail =
    `api-route-${suffix}@example.test`;

  const serviceEmail =
    `api-service-${suffix}@example.test`;

  const normalizedEmails = [
    normalizeEmail(routeEmail),
    normalizeEmail(serviceEmail),
  ];

  const phoneSuffix =
    `${Date.now()}`.slice(-7);

  const routePhone =
    `+234701${phoneSuffix}`;

  const servicePhone =
    `+234702${phoneSuffix}`;

  const password =
    `API-Audit-Passphrase-${suffix}`;

  const port = randomInt(
    32000,
    39000,
  );

  const baseUrl =
    `http://127.0.0.1:${port}`;

  let server:
    | ChildProcessByStdio<null, Readable, Readable>
    | null = null;

  let serverLogs = "";

  const appendLogs = (
    chunk: Buffer,
  ): void => {
    serverLogs = (
      serverLogs +
      chunk.toString("utf8")
    ).slice(-16000);
  };

  const requestJson = async (
    method: string,
    path: string,
    body?: unknown,
    cookie?: string,
    origin?: string,
  ): Promise<HttpResult> => {
    const headers:
      Record<string, string> = {
        Accept: "application/json",
      };

    if (body !== undefined) {
      headers["Content-Type"] =
        "application/json";
    }

    if (cookie) {
      headers.Cookie = cookie;
    }

    if (origin) {
      headers.Origin = origin;
    }

    const response = await fetch(
      `${baseUrl}${path}`,
      {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
        redirect: "manual",
      },
    );

    const text = await response.text();

    let json: unknown = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `Expected JSON from ${path}, received: ${text.slice(0, 200)}`,
        );
      }
    }

    return {
      status: response.status,
      json,
      text,
      setCookie:
        response.headers.get(
          "set-cookie",
        ),
    };
  };

  try {
    const registration =
      await registerCustomer({
        storefrontCode: "ATI",
        email: serviceEmail,
        phone: servicePhone,
        password,
        firstName: "API",
        lastName: "Audit",
        termsAccepted: true,
        privacyAccepted: true,
        marketingOptIn: false,
        tokenSecret,
      });

    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-p",
        String(port),
        "-H",
        "127.0.0.1",
      ],
      {
        env: {
          ...process.env,
          APP_ORIGIN: baseUrl,
          AUTH_REGISTRATION_API_ENABLED:
            "true",
        },
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      },
    );

    server.stdout.on(
      "data",
      appendLogs,
    );

    server.stderr.on(
      "data",
      appendLogs,
    );

    let ready = false;

    for (
      let attempt = 0;
      attempt < 60;
      attempt += 1
    ) {
      if (server.exitCode !== null) {
        break;
      }

      try {
        const response = await fetch(
          baseUrl,
        );

        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // The server is still starting.
      }

      await delay(500);
    }

    if (!ready) {
      throw new Error(
        "The production server did not become ready.\n" +
        serverLogs,
      );
    }

    console.log(
      "PASS: Production Next.js server started.",
    );

    const crossOrigin =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email: serviceEmail,
          password,
        },
        undefined,
        "https://untrusted.example",
      );

    assertCondition(
      crossOrigin.status === 403,
      "A cross-origin authentication request was accepted.",
    );

    console.log(
      "PASS: Cross-origin authentication requests are rejected.",
    );

    const routeRegistration =
      await requestJson(
        "POST",
        "/api/auth/register",
        {
          storefrontCode: "ATI",
          email: routeEmail,
          phone: routePhone,
          password,
          firstName: "Route",
          lastName: "Audit",
          marketingOptIn: false,
          termsAccepted: true,
          privacyAccepted: true,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      routeRegistration.status ===
        201,
      "The registration route did not return 201.",
    );

    for (
      const forbiddenKey of [
        "emailVerificationToken",
        "phoneVerificationCode",
        "phoneChallengeId",
        "sessionToken",
        "password",
        "passwordHash",
        "tokenHash",
        "codeHash",
      ]
    ) {
      assertCondition(
        !responseContainsKey(
          routeRegistration.json,
          forbiddenKey,
        ),
        `The registration response exposed ${forbiddenKey}.`,
      );
    }

    console.log(
      "PASS: Registration route completed without exposing secrets.",
    );

    const loginBeforeVerification =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email: serviceEmail,
          password,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      loginBeforeVerification.status ===
        403,
      "An unverified account logged in through the API.",
    );

    console.log(
      "PASS: HTTP login is blocked before both verifications.",
    );

    const emailVerification =
      await requestJson(
        "POST",
        "/api/auth/verify/email",
        {
          storefrontCode: "ATI",
          token:
            registration
              .emailVerificationToken,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      emailVerification.status === 200,
      "Email verification route failed.",
    );

    const phoneVerification =
      await requestJson(
        "POST",
        "/api/auth/verify/phone",
        {
          storefrontCode: "ATI",
          challengeId:
            registration
              .phoneChallengeId,
          code:
            registration
              .phoneVerificationCode,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      phoneVerification.status === 200,
      "Phone verification route failed.",
    );

    assertCondition(
      !responseContainsKey(
        emailVerification.json,
        "token",
      ),
      "Email verification response exposed a token.",
    );

    assertCondition(
      !responseContainsKey(
        phoneVerification.json,
        "code",
      ),
      "Phone verification response exposed a code.",
    );

    console.log(
      "PASS: Email and phone verification routes completed safely.",
    );

    const login =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email: serviceEmail,
          password,
        },
        undefined,
        baseUrl,
      );

    assertCondition(
      login.status === 200,
      "Verified API login failed.",
    );

    assertCondition(
      login.setCookie,
      "Login did not set a session cookie.",
    );

    assertCondition(
      !responseContainsKey(
        login.json,
        "sessionToken",
      ),
      "Login exposed the raw session token in JSON.",
    );

    const lowerCookie =
      login.setCookie.toLowerCase();

    assertCondition(
      lowerCookie.includes("httponly"),
      "The session cookie is not HttpOnly.",
    );

    assertCondition(
      lowerCookie.includes(
        "samesite=lax",
      ),
      "The session cookie does not use SameSite=Lax.",
    );

    assertCondition(
      lowerCookie.includes("path=/"),
      "The session cookie is not scoped to the root path.",
    );

    const cookiePair =
      login.setCookie.split(";")[0];

    assertCondition(
      cookiePair.startsWith(
        "sorvyra_session_ati=",
      ),
      "The local storefront cookie name is invalid.",
    );

    console.log(
      "PASS: Login sets a protected storefront-specific cookie.",
    );

    const currentSession =
      await requestJson(
        "GET",
        "/api/auth/session?storefrontCode=ATI",
        undefined,
        cookiePair,
      );

    assertCondition(
      currentSession.status === 200,
      "The current-session route rejected a valid cookie.",
    );

    assertCondition(
      !responseContainsKey(
        currentSession.json,
        "sessionToken",
      ),
      "The current-session response exposed a raw token.",
    );

    console.log(
      "PASS: Current-session route validated the protected cookie.",
    );

    const wrongStoreSession =
      await requestJson(
        "GET",
        "/api/auth/session?storefrontCode=ZBF",
        undefined,
        cookiePair,
      );

    assertCondition(
      wrongStoreSession.status === 401,
      "A session cookie crossed storefront boundaries.",
    );

    console.log(
      "PASS: Session cookies remain isolated by storefront.",
    );

    const logout =
      await requestJson(
        "POST",
        "/api/auth/logout",
        {
          storefrontCode: "ATI",
        },
        cookiePair,
        baseUrl,
      );

    assertCondition(
      logout.status === 200,
      "Logout route failed.",
    );

    assertCondition(
      logout.setCookie,
      "Logout did not clear the session cookie.",
    );

    const lowerLogoutCookie =
      logout.setCookie.toLowerCase();

    assertCondition(
      lowerLogoutCookie.includes(
        "max-age=0",
      ) ||
        lowerLogoutCookie.includes(
          "expires=thu, 01 jan 1970",
        ),
      "Logout did not expire the session cookie.",
    );

    const revokedSession =
      await requestJson(
        "GET",
        "/api/auth/session?storefrontCode=ATI",
        undefined,
        cookiePair,
      );

    assertCondition(
      revokedSession.status === 401,
      "The logged-out session remained valid.",
    );

    console.log(
      "PASS: Logout clears and revokes the active session.",
    );

    console.log(
      "PASS: Authentication API route audit completed.",
    );
  } catch (error) {
    if (serverLogs) {
      console.error(
        "=== PRODUCTION SERVER LOG TAIL ===",
      );

      console.error(serverLogs);
    }

    throw error;
  } finally {
    await prisma.user.deleteMany({
      where: {
        normalizedEmail: {
          in: normalizedEmails,
        },
      },
    });

    console.log(
      "PASS: Temporary authentication API audit records removed.",
    );

    if (server) {
      await stopServer(server);
    }

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
TS

echo
echo "=== REGISTER AUTHENTICATION API AUDIT ==="

npm pkg set \
  "scripts.db:audit:auth-api=node --env-file=.env --conditions=react-server --import tsx scripts/audit-auth-api-routes.ts"

echo
echo "=== VALIDATE DATABASE STATE ==="

npm run db:up
npm run db:validate
npm run db:generate
npx prisma migrate status

echo
echo "=== RUN SERVICE REGRESSION AUDITS ==="

npm run db:audit:auth
npm run db:audit:identity
npm run db:audit
npm run db:audit:catalog
npm run db:audit:services

echo
echo "=== RUN APPLICATION VALIDATION ==="

npm run lint
npm run build

echo
echo "=== RUN AUTHENTICATION API AUDIT ==="

npm run db:audit:auth-api

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "PHASE 2E-C AUTHENTICATION API ROUTES PASSED"
