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
  grep -v '^?? scripts/setup-auth-recovery-routes-pages.sh$' ||
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
echo "=== VERIFY RECOVERY SERVICE FOUNDATION ==="

python - <<'PY'
from pathlib import Path

required_files = [
    Path("src/server/auth/delivery.ts"),
    Path("src/server/auth/recovery.ts"),
    Path("src/server/auth/resend.ts"),
    Path("src/server/auth/recovery-types.ts"),
]

for path in required_files:
    if not path.exists():
        raise RuntimeError(
            f"Required recovery service file is missing: {path}"
        )

index_content = Path(
    "src/server/auth/index.ts"
).read_text(
    encoding="utf-8",
)

required_exports = [
    "requestPasswordReset",
    "resetCustomerPassword",
    "resendRegistrationVerification",
    "getAuthDeliveryProvider",
]

for value in required_exports:
    if value not in index_content:
        raise RuntimeError(
            f"Required authentication export is missing: {value}"
        )

print(
    "PASS: Recovery and delivery service foundation is available."
)
PY

echo
echo "=== PATCH SAFE AUTHENTICATION HTTP ERRORS ==="

python - <<'PY'
from pathlib import Path

path = Path(
    "src/server/auth/http.ts"
)

content = path.read_text(
    encoding="utf-8",
)

old_import = '''import {
  AuthServiceError,
  type AuthErrorCode,
} from "./errors";'''

new_import = '''import {
  isAuthDeliveryUnavailableError,
} from "./delivery";
import {
  AuthServiceError,
  type AuthErrorCode,
} from "./errors";'''

if old_import in content:
    content = content.replace(
        old_import,
        new_import,
        1,
    )

    print(
        "Added delivery-error import to authentication HTTP utilities."
    )
elif new_import in content:
    print(
        "Delivery-error import already exists."
    )
else:
    raise RuntimeError(
        "Could not locate the authentication error import."
    )

old_error_union = '''  | "FORBIDDEN_ORIGIN"
  | "AUTH_NOT_READY"
  | "INTERNAL_ERROR";'''

new_error_union = '''  | "FORBIDDEN_ORIGIN"
  | "AUTH_NOT_READY"
  | "AUTH_DELIVERY_UNAVAILABLE"
  | "INTERNAL_ERROR";'''

if old_error_union in content:
    content = content.replace(
        old_error_union,
        new_error_union,
        1,
    )

    print(
        "Added delivery-unavailable API error code."
    )
elif new_error_union in content:
    print(
        "Delivery-unavailable API error code already exists."
    )
else:
    raise RuntimeError(
        "Could not locate the API error-code union."
    )

auth_service_branch = '''  if (error instanceof AuthServiceError) {
    const responseDefinition =
      authErrorResponses[error.code];'''

delivery_branch = '''  if (
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
      authErrorResponses[error.code];'''

if auth_service_branch in content:
    content = content.replace(
        auth_service_branch,
        delivery_branch,
        1,
    )

    print(
        "Added safe delivery-unavailable response handling."
    )
elif delivery_branch in content:
    print(
        "Delivery-unavailable response handling already exists."
    )
else:
    raise RuntimeError(
        "Could not locate authentication API error handling."
    )

path.write_text(
    content,
    encoding="utf-8",
)
PY

echo
echo "=== VERIFY HTTP ERROR PATCH ==="

python - <<'PY'
from pathlib import Path

content = Path(
    "src/server/auth/http.ts"
).read_text(
    encoding="utf-8",
)

required = [
    "isAuthDeliveryUnavailableError",
    '"AUTH_DELIVERY_UNAVAILABLE"',
    (
        "Verification and recovery delivery "
        "is not available yet."
    ),
]

for value in required:
    if value not in content:
        raise RuntimeError(
            f"Authentication HTTP patch is missing: {value}"
        )

print(
    "PASS: Delivery failures produce safe HTTP responses."
)
PY

echo
echo "=== CREATE RECOVERY API DIRECTORIES ==="

mkdir -p \
  src/app/api/auth/recovery/request \
  src/app/api/auth/recovery/reset \
  src/app/api/auth/verify/resend

echo
echo "=== CREATE PASSWORD RESET REQUEST ROUTE ==="

cat > src/app/api/auth/recovery/request/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  getAuthDeliveryProvider,
  requestPasswordReset,
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

    await requestPasswordReset(
      {
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
        tokenSecret:
          getAuthTokenSecret(),
      },
      getAuthDeliveryProvider(),
    );

    return authJsonResponse(
      {
        ok: true,
        data: {
          accepted: true,
        },
      },
      202,
    );
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
TS

echo
echo "=== CREATE PASSWORD RESET COMPLETION ROUTE ==="

cat > src/app/api/auth/recovery/reset/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  resetCustomerPassword,
} from "../../../../../server/auth";
import {
  assertTrustedOrigin,
  authApiErrorResponse,
  authJsonResponse,
  clearSessionCookie,
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

    const storefrontCode =
      requiredString(
        body,
        "storefrontCode",
        {
          maxLength: 12,
        },
      );

    await resetCustomerPassword({
      storefrontCode,
      token: requiredString(
        body,
        "token",
        {
          maxLength: 256,
          trim: false,
        },
      ),
      newPassword:
        requiredString(
          body,
          "newPassword",
          {
            maxLength: 128,
            trim: false,
          },
        ),
      tokenSecret:
        getAuthTokenSecret(),
    });

    const response =
      authJsonResponse({
        ok: true,
        data: {
          passwordReset: true,
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
echo "=== CREATE VERIFICATION RESEND ROUTE ==="

cat > src/app/api/auth/verify/resend/route.ts <<'TS'
import type {
  NextRequest,
} from "next/server";

import {
  getAuthDeliveryProvider,
  resendRegistrationVerification,
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

    await resendRegistrationVerification(
      {
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
        tokenSecret:
          getAuthTokenSecret(),
      },
      getAuthDeliveryProvider(),
    );

    return authJsonResponse(
      {
        ok: true,
        data: {
          accepted: true,
        },
      },
      202,
    );
  } catch (error) {
    return authApiErrorResponse(error);
  }
}
TS

echo
echo "=== EXTEND STOREFRONT RECOVERY LINKS ==="

python - <<'PY'
from pathlib import Path

path = Path(
    "src/lib/storefront-auth.ts"
)

content = path.read_text(
    encoding="utf-8",
)

old_interface = '''  registerHref: string;
  verifyHref: string;'''

new_interface = '''  registerHref: string;
  forgotPasswordHref: string;
  resetPasswordHref: string;
  verifyHref: string;'''

if old_interface in content:
    content = content.replace(
        old_interface,
        new_interface,
        1,
    )

    print(
        "Added recovery links to storefront configuration type."
    )
elif new_interface in content:
    print(
        "Storefront recovery-link fields already exist."
    )
else:
    raise RuntimeError(
        "Could not locate storefront authentication link fields."
    )

replacements = [
    (
        '''    registerHref:
      "/ng/atiloszy/account/register",
    verifyHref:''',
        '''    registerHref:
      "/ng/atiloszy/account/register",
    forgotPasswordHref:
      "/ng/atiloszy/account/forgot-password",
    resetPasswordHref:
      "/ng/atiloszy/account/reset-password",
    verifyHref:''',
        "ATI",
    ),
    (
        '''    registerHref:
      "/ng/zee-beauty-fashion/account/register",
    verifyHref:''',
        '''    registerHref:
      "/ng/zee-beauty-fashion/account/register",
    forgotPasswordHref:
      "/ng/zee-beauty-fashion/account/forgot-password",
    resetPasswordHref:
      "/ng/zee-beauty-fashion/account/reset-password",
    verifyHref:''',
        "ZBF",
    ),
    (
        '''    registerHref:
      "/ng/denald/account/register",
    verifyHref:''',
        '''    registerHref:
      "/ng/denald/account/register",
    forgotPasswordHref:
      "/ng/denald/account/forgot-password",
    resetPasswordHref:
      "/ng/denald/account/reset-password",
    verifyHref:''',
        "DEN",
    ),
    (
        '''    registerHref:
      "/qa/zee-comfort-hub/account/register",
    verifyHref:''',
        '''    registerHref:
      "/qa/zee-comfort-hub/account/register",
    forgotPasswordHref:
      "/qa/zee-comfort-hub/account/forgot-password",
    resetPasswordHref:
      "/qa/zee-comfort-hub/account/reset-password",
    verifyHref:''',
        "ZCH",
    ),
]

for old, new, code in replacements:
    if old in content:
        content = content.replace(
            old,
            new,
            1,
        )

        print(
            f"Added recovery routes for {code}."
        )
    elif new in content:
        print(
            f"Recovery routes already exist for {code}."
        )
    else:
        raise RuntimeError(
            f"Could not locate the {code} storefront links."
        )

path.write_text(
    content,
    encoding="utf-8",
)
PY

echo
echo "=== CREATE CUSTOMER RECOVERY FORMS ==="

cat > src/components/auth/recovery-forms.tsx <<'TS'
"use client";

import {
  type FormEvent,
  useState,
} from "react";
import Link from "next/link";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import styles from "./auth.module.css";

interface ApiPayload {
  error?: {
    message?: string;
  };
}

interface FormNotice {
  kind: "error" | "success";
  message: string;
}

async function readPayload(
  response: Response,
): Promise<ApiPayload> {
  try {
    return await response.json() as ApiPayload;
  } catch {
    return {};
  }
}

function resolveMessage(
  payload: ApiPayload,
  fallback: string,
): string {
  return (
    payload.error?.message ??
    fallback
  );
}

export function ForgotPasswordForm({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  const [
    notice,
    setNotice,
  ] = useState<FormNotice | null>(
    null,
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const form =
      event.currentTarget;

    const formData =
      new FormData(form);

    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/recovery/request",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode:
              storefront.code,
            email:
              formData.get("email"),
          }),
        },
      );

      const payload =
        await readPayload(response);

      if (!response.ok) {
        throw new Error(
          resolveMessage(
            payload,
            "The recovery request could not be completed.",
          ),
        );
      }

      form.reset();

      setNotice({
        kind: "success",
        message:
          "When an eligible account exists, password-reset instructions will be sent to its registered email.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The recovery request could not be completed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Recover your account
        </h2>

        <p className={styles.panelText}>
          Enter the email registered
          specifically with{" "}
          {storefront.shortName}.
        </p>
      </div>

      <div className={styles.notice}>
        Recovery email delivery remains
        disabled until a verified provider
        is connected.
      </div>

      <form
        className={styles.form}
        onSubmit={submit}
        data-auth-form="forgot-password"
      >
        <label className={styles.field}>
          <span className={styles.label}>
            Registered email address
          </span>

          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
            placeholder="you@example.com"
          />
        </label>

        {notice ? (
          <div
            className={
              notice.kind === "error"
                ? styles.errorNotice
                : styles.successNotice
            }
            role={
              notice.kind === "error"
                ? "alert"
                : "status"
            }
            aria-live="polite"
          >
            {notice.message}
          </div>
        ) : null}

        <button
          className={styles.primaryButton}
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Requesting recovery…"
            : "Send password-reset instructions"}
        </button>
      </form>

      <p className={styles.formFooter}>
        Remembered your password?{" "}
        <Link
          href={storefront.loginHref}
          className={styles.inlineLink}
        >
          Return to sign in
        </Link>
        .
      </p>
    </>
  );
}

export function ResetPasswordForm({
  storefront,
  initialToken,
}: {
  storefront: StorefrontAuthConfig;
  initialToken?: string;
}) {
  const [
    notice,
    setNotice,
  ] = useState<FormNotice | null>(
    null,
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const form =
      event.currentTarget;

    const formData =
      new FormData(form);

    const newPassword =
      formData.get("newPassword");

    const confirmPassword =
      formData.get("confirmPassword");

    setNotice(null);

    if (
      typeof newPassword !== "string" ||
      newPassword !== confirmPassword
    ) {
      setNotice({
        kind: "error",
        message:
          "The password confirmation does not match.",
      });

      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/recovery/reset",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode:
              storefront.code,
            token:
              formData.get("token"),
            newPassword,
          }),
        },
      );

      const payload =
        await readPayload(response);

      if (!response.ok) {
        throw new Error(
          resolveMessage(
            payload,
            "The password could not be reset.",
          ),
        );
      }

      form.reset();

      setNotice({
        kind: "success",
        message:
          "Your password has been replaced and existing sessions have been revoked. Sign in again using the new password.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The password could not be reset.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Set a new password
        </h2>

        <p className={styles.panelText}>
          Use the secure token from your
          recovery email and create a new
          storefront password.
        </p>
      </div>

      <form
        className={styles.form}
        onSubmit={submit}
        data-auth-form="reset-password"
      >
        <label className={styles.field}>
          <span className={styles.label}>
            Password-reset token
          </span>

          <input
            className={styles.input}
            type="text"
            name="token"
            defaultValue={initialToken}
            maxLength={256}
            required
            autoComplete="off"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            New password
          </span>

          <input
            className={styles.input}
            type="password"
            name="newPassword"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            placeholder="At least 12 characters"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Confirm new password
          </span>

          <input
            className={styles.input}
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>

        {notice ? (
          <div
            className={
              notice.kind === "error"
                ? styles.errorNotice
                : styles.successNotice
            }
            role={
              notice.kind === "error"
                ? "alert"
                : "status"
            }
            aria-live="polite"
          >
            {notice.message}
          </div>
        ) : null}

        <button
          className={styles.primaryButton}
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Replacing password…"
            : "Replace password"}
        </button>
      </form>

      <p className={styles.formFooter}>
        Ready to continue?{" "}
        <Link
          href={storefront.loginHref}
          className={styles.inlineLink}
        >
          Return to sign in
        </Link>
        .
      </p>
    </>
  );
}

export function ResendVerificationForm({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  const [
    notice,
    setNotice,
  ] = useState<FormNotice | null>(
    null,
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const form =
      event.currentTarget;

    const formData =
      new FormData(form);

    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/verify/resend",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode:
              storefront.code,
            email:
              formData.get("email"),
          }),
        },
      );

      const payload =
        await readPayload(response);

      if (!response.ok) {
        throw new Error(
          resolveMessage(
            payload,
            "Verification messages could not be requested.",
          ),
        );
      }

      form.reset();

      setNotice({
        kind: "success",
        message:
          "When an eligible pending account exists, new verification instructions will be delivered.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Verification messages could not be requested.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.verifyCard}>
      <h3 className={styles.verifyTitle}>
        Need new verification messages?
      </h3>

      <p className={styles.verifyText}>
        Request replacement email and
        phone challenges using the
        storefront email you registered.
      </p>

      <div className={styles.notice}>
        Message delivery remains disabled
        until verified providers are
        connected.
      </div>

      <form
        className={styles.form}
        onSubmit={submit}
        data-auth-form="resend-verification"
      >
        <label className={styles.field}>
          <span className={styles.label}>
            Registered email address
          </span>

          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>

        {notice ? (
          <div
            className={
              notice.kind === "error"
                ? styles.errorNotice
                : styles.successNotice
            }
            role={
              notice.kind === "error"
                ? "alert"
                : "status"
            }
            aria-live="polite"
          >
            {notice.message}
          </div>
        ) : null}

        <button
          className={styles.secondaryButton}
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Requesting messages…"
            : "Resend verification messages"}
        </button>
      </form>
    </section>
  );
}
TS

echo
echo "=== ADD PASSWORD RECOVERY LINK TO LOGIN ==="

python - <<'PY'
from pathlib import Path

path = Path(
    "src/components/auth/auth-forms.tsx"
)

content = path.read_text(
    encoding="utf-8",
)

old_footer = '''      <p className={styles.formFooter}>
        New to this storefront?{" "}
        <Link
          href={storefront.registerHref}
          className={styles.inlineLink}
        >
          Create an account
        </Link>
        .
      </p>'''

new_footer = '''      <p className={styles.formFooter}>
        <Link
          href={
            storefront.forgotPasswordHref
          }
          className={styles.inlineLink}
        >
          Forgot your password?
        </Link>
        {" · "}
        New to this storefront?{" "}
        <Link
          href={storefront.registerHref}
          className={styles.inlineLink}
        >
          Create an account
        </Link>
        .
      </p>'''

if old_footer in content:
    content = content.replace(
        old_footer,
        new_footer,
        1,
    )

    print(
        "Added password-recovery link to the login form."
    )
elif new_footer in content:
    print(
        "Login password-recovery link already exists."
    )
else:
    raise RuntimeError(
        "Could not locate the login form footer."
    )

path.write_text(
    content,
    encoding="utf-8",
)
PY

echo
echo "=== ADD VERIFICATION RESEND FORM ==="

python - <<'PY'
from pathlib import Path

path = Path(
    "src/components/auth/verify-form.tsx"
)

content = path.read_text(
    encoding="utf-8",
)

styles_import = '''import styles from "./auth.module.css";'''

new_imports = '''import styles from "./auth.module.css";
import {
  ResendVerificationForm,
} from "./recovery-forms";'''

if styles_import in content:
    content = content.replace(
        styles_import,
        new_imports,
        1,
    )

    print(
        "Imported the verification resend form."
    )
elif new_imports in content:
    print(
        "Verification resend import already exists."
    )
else:
    raise RuntimeError(
        "Could not locate verification form imports."
    )

old_footer = '''      <p className={styles.formFooter}>
        Finished both steps?{" "}
        <Link
          href={storefront.loginHref}
          className={styles.inlineLink}
        >
          Sign in
        </Link>
        .
      </p>'''

new_footer = '''      <ResendVerificationForm
        storefront={storefront}
      />

      <p className={styles.formFooter}>
        Finished both steps?{" "}
        <Link
          href={storefront.loginHref}
          className={styles.inlineLink}
        >
          Sign in
        </Link>
        .
      </p>'''

if old_footer in content:
    content = content.replace(
        old_footer,
        new_footer,
        1,
    )

    print(
        "Added verification resend controls."
    )
elif new_footer in content:
    print(
        "Verification resend controls already exist."
    )
else:
    raise RuntimeError(
        "Could not locate the verification form footer."
    )

path.write_text(
    content,
    encoding="utf-8",
)
PY

echo
echo "=== EXTEND SHARED AUTHENTICATION PAGES ==="

python - <<'PY'
from pathlib import Path

path = Path(
    "src/components/auth/pages.tsx"
)

content = path.read_text(
    encoding="utf-8",
)

old_verify_import = '''import {
  VerificationForm,
} from "./verify-form";'''

new_verify_import = '''import {
  VerificationForm,
} from "./verify-form";
import {
  ForgotPasswordForm,
  ResetPasswordForm,
} from "./recovery-forms";'''

if old_verify_import in content:
    content = content.replace(
        old_verify_import,
        new_verify_import,
        1,
    )

    print(
        "Imported shared recovery forms."
    )
elif new_verify_import in content:
    print(
        "Shared recovery-form imports already exist."
    )
else:
    raise RuntimeError(
        "Could not locate the shared verification-form import."
    )

marker = '''export async function StorefrontAccountPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {'''

addition = '''export function StorefrontForgotPasswordPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  return (
    <AuthShell
      storefront={storefront}
      title="Recover access safely."
      description={
        "Request a single-use recovery link for the account registered with this storefront."
      }
    >
      <ForgotPasswordForm
        storefront={storefront}
      />
    </AuthShell>
  );
}

export function StorefrontResetPasswordPage({
  storefront,
  searchParams,
}: {
  storefront: StorefrontAuthConfig;
  searchParams: SearchParams;
}) {
  return (
    <AuthShell
      storefront={storefront}
      title="Choose a new password."
      description={
        "Replace your password securely. Existing sessions will be revoked after a successful reset."
      }
    >
      <ResetPasswordForm
        storefront={storefront}
        initialToken={
          firstSearchValue(
            searchParams.token,
          )
        }
      />
    </AuthShell>
  );
}

export async function StorefrontAccountPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {'''

if marker in content:
    content = content.replace(
        marker,
        addition,
        1,
    )

    print(
        "Added shared forgot-password and reset-password pages."
    )
elif (
    "StorefrontForgotPasswordPage"
    in content
    and
    "StorefrontResetPasswordPage"
    in content
):
    print(
        "Shared recovery pages already exist."
    )
else:
    raise RuntimeError(
        "Could not locate the protected account-page marker."
    )

path.write_text(
    content,
    encoding="utf-8",
)
PY

echo
echo "=== GENERATE STOREFRONT RECOVERY PAGE ROUTES ==="

python - <<'PY'
from pathlib import Path

storefronts = [
    (
        "src/app/ng/atiloszy/account",
        "ATI",
    ),
    (
        "src/app/ng/zee-beauty-fashion/account",
        "ZBF",
    ),
    (
        "src/app/ng/denald/account",
        "DEN",
    ),
    (
        "src/app/qa/zee-comfort-hub/account",
        "ZCH",
    ),
]

forgot_template = '''import {{
  StorefrontForgotPasswordPage,
}} from "../../../../../components/auth/pages";
import {{
  getStorefrontAuthConfig,
}} from "../../../../../lib/storefront-auth";

const storefront =
  getStorefrontAuthConfig("{code}");

export default function ForgotPasswordPage() {{
  return (
    <StorefrontForgotPasswordPage
      storefront={{storefront}}
    />
  );
}}
'''

reset_template = '''import {{
  StorefrontResetPasswordPage,
}} from "../../../../../components/auth/pages";
import {{
  getStorefrontAuthConfig,
}} from "../../../../../lib/storefront-auth";

type ResetPasswordPageProps = {{
  searchParams: Promise<
    Record<
      string,
      string |
      string[] |
      undefined
    >
  >;
}};

const storefront =
  getStorefrontAuthConfig("{code}");

export default async function ResetPasswordPage({{
  searchParams,
}}: ResetPasswordPageProps) {{
  return (
    <StorefrontResetPasswordPage
      storefront={{storefront}}
      searchParams={{
        await searchParams
      }}
    />
  );
}}
'''

for base_value, code in storefronts:
    base = Path(base_value)

    forgot_dir = (
        base /
        "forgot-password"
    )

    reset_dir = (
        base /
        "reset-password"
    )

    forgot_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    reset_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    (
        forgot_dir /
        "page.tsx"
    ).write_text(
        forgot_template.format(
            code=code,
        ),
        encoding="utf-8",
    )

    (
        reset_dir /
        "page.tsx"
    ).write_text(
        reset_template.format(
            code=code,
        ),
        encoding="utf-8",
    )

    print(
        f"Created recovery pages for {code}."
    )
PY

echo
echo "=== CREATE RECOVERY ROUTE AND PAGE AUDIT ==="

cat > scripts/audit-auth-recovery-routes-pages.ts <<'TS'
import {
  type ChildProcessByStdio,
  spawn,
} from "node:child_process";
import {
  randomBytes,
  randomInt,
} from "node:crypto";
import type {
  Readable,
} from "node:stream";

import { prisma } from "../src/lib/prisma";
import {
  type AuthDeliveryProvider,
  type EmailVerificationDelivery,
  type PasswordResetDelivery,
  type PhoneVerificationDelivery,
  normalizeEmail,
  registerCustomer,
  requestPasswordReset,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

type TestServer =
  ChildProcessByStdio<
    null,
    Readable,
    Readable
  >;

class CaptureDeliveryProvider
  implements AuthDeliveryProvider {
  readonly name = "recovery-http-audit";
  readonly enabled = true;

  readonly passwordResets:
    PasswordResetDelivery[] = [];

  async sendEmailVerification(
    _delivery:
      EmailVerificationDelivery,
  ): Promise<void> {}

  async sendPhoneVerification(
    _delivery:
      PhoneVerificationDelivery,
  ): Promise<void> {}

  async sendPasswordReset(
    delivery:
      PasswordResetDelivery,
  ): Promise<void> {
    this.passwordResets.push(
      delivery,
    );
  }
}

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
      responseContainsKey(
        item,
        key,
      ),
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
      responseContainsKey(
        item,
        key,
      ),
  );
}

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForExit(
  server: TestServer,
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
  server: TestServer,
): Promise<void> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return;
  }

  server.kill("SIGTERM");

  if (
    await waitForExit(
      server,
      5000,
    )
  ) {
    return;
  }

  server.kill("SIGKILL");

  await waitForExit(
    server,
    2000,
  );
}

async function main(): Promise<void> {
  console.log(
    "=== AUTHENTICATION RECOVERY ROUTE AND PAGE AUDIT ===",
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

  const email =
    `recovery-http-${suffix}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phoneSuffix =
    `${Date.now()}`.slice(-7);

  const phone =
    `+234705${phoneSuffix}`;

  const oldPassword =
    `Old-HTTP-Recovery-${suffix}`;

  const newPassword =
    `New-HTTP-Recovery-${suffix}`;

  const registration =
    await registerCustomer({
      storefrontCode: "ATI",
      email,
      phone,
      password: oldPassword,
      firstName: "Recovery",
      lastName: "HTTP Audit",
      marketingOptIn: false,
      termsAccepted: true,
      privacyAccepted: true,
      tokenSecret,
    });

  await verifyCustomerEmail({
    storefrontCode: "ATI",
    token:
      registration
        .emailVerificationToken,
    tokenSecret,
  });

  await verifyCustomerPhone({
    storefrontCode: "ATI",
    challengeId:
      registration.phoneChallengeId,
    code:
      registration
        .phoneVerificationCode,
    tokenSecret,
  });

  const capture =
    new CaptureDeliveryProvider();

  await requestPasswordReset(
    {
      storefrontCode: "ATI",
      email,
      tokenSecret,
    },
    capture,
  );

  assertCondition(
    capture.passwordResets.length === 1,
    "The audit password-reset token was not created.",
  );

  const resetToken =
    capture.passwordResets[0].token;

  const port = randomInt(
    45001,
    51000,
  );

  const baseUrl =
    `http://127.0.0.1:${port}`;

  const server = spawn(
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
        AUTH_DELIVERY_PROVIDER:
          "disabled",
      },
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  );

  let serverLogs = "";

  const captureLogs = (
    chunk: Buffer,
  ): void => {
    serverLogs = (
      serverLogs +
      chunk.toString("utf8")
    ).slice(-16000);
  };

  server.stdout.on(
    "data",
    captureLogs,
  );

  server.stderr.on(
    "data",
    captureLogs,
  );

  async function requestJson(
    method: string,
    path: string,
    body?: unknown,
    cookie?: string,
  ): Promise<HttpResult> {
    const headers:
      Record<string, string> = {
        Accept: "application/json",
      };

    if (body !== undefined) {
      headers["Content-Type"] =
        "application/json";

      headers.Origin = baseUrl;
    }

    if (cookie) {
      headers.Cookie = cookie;
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

    const text =
      await response.text();

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
  }

  try {
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
        const response =
          await fetch(baseUrl);

        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // The production server is still starting.
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

    const storefrontPages = [
      {
        code: "ATI",
        base:
          "/ng/atiloszy/account",
      },
      {
        code: "ZBF",
        base:
          "/ng/zee-beauty-fashion/account",
      },
      {
        code: "DEN",
        base:
          "/ng/denald/account",
      },
      {
        code: "ZCH",
        base:
          "/qa/zee-comfort-hub/account",
      },
    ];

    for (
      const storefront of storefrontPages
    ) {
      for (
        const suffixPath of [
          "/forgot-password",
          "/reset-password",
        ]
      ) {
        const response = await fetch(
          `${baseUrl}${storefront.base}${suffixPath}`,
          {
            redirect: "manual",
          },
        );

        const html =
          await response.text();

        assertCondition(
          response.status === 200,
          `${storefront.code} ${suffixPath} did not load.`,
        );

        assertCondition(
          html.includes(
            `data-auth-storefront="${storefront.code}"`,
          ),
          `${storefront.code} recovery branding was not rendered.`,
        );
      }
    }

    console.log(
      "PASS: All storefront recovery pages rendered.",
    );

    const disabledRecovery =
      await requestJson(
        "POST",
        "/api/auth/recovery/request",
        {
          storefrontCode: "ATI",
          email,
        },
      );

    assertCondition(
      disabledRecovery.status === 503,
      "Disabled recovery delivery did not return 503.",
    );

    assertCondition(
      responseContainsKey(
        disabledRecovery.json,
        "error",
      ),
      "Disabled recovery did not return a safe error response.",
    );

    assertCondition(
      !disabledRecovery.text.includes(
        email,
      ),
      "The recovery response exposed the submitted email.",
    );

    assertCondition(
      !disabledRecovery.text.includes(
        resetToken,
      ),
      "The recovery response exposed a reset token.",
    );

    console.log(
      "PASS: Provider-disabled recovery requests fail safely.",
    );

    const disabledResend =
      await requestJson(
        "POST",
        "/api/auth/verify/resend",
        {
          storefrontCode: "ATI",
          email,
        },
      );

    assertCondition(
      disabledResend.status === 503,
      "Disabled verification resend did not return 503.",
    );

    assertCondition(
      !disabledResend.text.includes(
        email,
      ),
      "The resend response exposed the submitted email.",
    );

    console.log(
      "PASS: Provider-disabled verification resend fails safely.",
    );

    const invalidReset =
      await requestJson(
        "POST",
        "/api/auth/recovery/reset",
        {
          storefrontCode: "ATI",
          token:
            `${resetToken}-invalid`,
          newPassword,
        },
      );

    assertCondition(
      invalidReset.status === 400,
      "An invalid password-reset token was not rejected.",
    );

    console.log(
      "PASS: Invalid recovery tokens are rejected safely.",
    );

    const login = await requestJson(
      "POST",
      "/api/auth/login",
      {
        storefrontCode: "ATI",
        email,
        password: oldPassword,
      },
    );

    assertCondition(
      login.status === 200,
      "The recovery audit customer could not sign in.",
    );

    assertCondition(
      login.setCookie,
      "Login did not set a session cookie.",
    );

    const cookiePair =
      login.setCookie.split(";")[0];

    const reset = await requestJson(
      "POST",
      "/api/auth/recovery/reset",
      {
        storefrontCode: "ATI",
        token: resetToken,
        newPassword,
      },
      cookiePair,
    );

    assertCondition(
      reset.status === 200,
      "The password-reset route failed.",
    );

    assertCondition(
      reset.setCookie,
      "Password reset did not clear the storefront cookie.",
    );

    assertCondition(
      !responseContainsKey(
        reset.json,
        "token",
      ),
      "The reset response exposed a token.",
    );

    assertCondition(
      !responseContainsKey(
        reset.json,
        "userId",
      ),
      "The reset response exposed an internal user ID.",
    );

    console.log(
      "PASS: Password-reset route completed without exposing secrets.",
    );

    const oldSession =
      await requestJson(
        "GET",
        "/api/auth/session?storefrontCode=ATI",
        undefined,
        cookiePair,
      );

    assertCondition(
      oldSession.status === 401,
      "A pre-reset session remained valid.",
    );

    const oldPasswordLogin =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email,
          password: oldPassword,
        },
      );

    assertCondition(
      oldPasswordLogin.status === 401,
      "The old password remained valid.",
    );

    const newPasswordLogin =
      await requestJson(
        "POST",
        "/api/auth/login",
        {
          storefrontCode: "ATI",
          email,
          password: newPassword,
        },
      );

    assertCondition(
      newPasswordLogin.status === 200,
      "The new password could not sign in.",
    );

    console.log(
      "PASS: Reset revokes sessions and replaces the password.",
    );

    const reusedReset =
      await requestJson(
        "POST",
        "/api/auth/recovery/reset",
        {
          storefrontCode: "ATI",
          token: resetToken,
          newPassword:
            `${newPassword}-again`,
        },
      );

    assertCondition(
      reusedReset.status === 400,
      "A reset token was accepted more than once.",
    );

    console.log(
      "PASS: HTTP password-reset tokens are single use.",
    );

    console.log(
      "PASS: Authentication recovery route and page audit completed.",
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
    await stopServer(server);

    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    console.log(
      "PASS: Temporary recovery HTTP audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
TS

echo
echo "=== REGISTER RECOVERY HTTP AUDIT ==="

npm pkg set \
  "scripts.db:audit:recovery-http=node --env-file=.env --conditions=react-server --import tsx scripts/audit-auth-recovery-routes-pages.ts"

echo
echo "=== VALIDATE DATABASE STATE ==="

npm run db:up
npm run db:validate
npm run db:generate
npx prisma migrate status

echo
echo "=== RUN RECOVERY SERVICE REGRESSION AUDIT ==="

npm run db:audit:recovery

echo
echo "=== RUN AUTHENTICATION REGRESSION AUDITS ==="

npm run db:audit:auth
npm run db:audit:auth-api
npm run db:audit:auth-ui
npm run db:audit:identity

echo
echo "=== RUN COMMERCE REGRESSION AUDITS ==="

npm run db:audit
npm run db:audit:catalog
npm run db:audit:services

echo
echo "=== RUN APPLICATION VALIDATION ==="

npm run lint
npm run build

echo
echo "=== RUN RECOVERY HTTP AND PAGE AUDIT ==="

npm run db:audit:recovery-http

echo
echo "=== VERIFY AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TS'
import { prisma } from "./src/lib/prisma";

const remainingUsers =
  await prisma.user.count({
    where: {
      normalizedEmail: {
        contains:
          "recovery-http-",
        endsWith:
          "@example.test",
      },
    },
  });

if (remainingUsers !== 0) {
  throw new Error(
    `${remainingUsers} temporary recovery HTTP audit user(s) remain.`,
  );
}

console.log(
  "PASS: No temporary recovery HTTP audit users remain.",
);

await prisma.$disconnect();
TS

echo
echo "=== VERIFY NO TEST SERVER REMAINS ==="

if ps -ef |
  grep -E \
    '[n]ode_modules/next/dist/bin/next start' \
  >/tmp/sorvyra-recovery-http-server-check.txt
then
  echo "A temporary recovery test server remains:"
  cat /tmp/sorvyra-recovery-http-server-check.txt
  exit 1
fi

echo "PASS: No recovery test server remains."

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "PHASE 2E-E-B RECOVERY ROUTES AND PAGES PASSED"
