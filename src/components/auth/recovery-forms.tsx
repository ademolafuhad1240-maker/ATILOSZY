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
