"use client";

import {
  type FormEvent,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import styles from "./auth.module.css";

interface ApiPayload {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
}

interface FormNotice {
  kind: "error" | "success";
  message: string;
}

async function readApiPayload(
  response: Response,
): Promise<ApiPayload> {
  try {
    return await response.json() as ApiPayload;
  } catch {
    return {};
  }
}

function errorMessage(
  payload: ApiPayload,
  fallback: string,
): string {
  return (
    payload.error?.message ??
    fallback
  );
}

export function LoginForm({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  const router = useRouter();

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

  async function handleSubmit(
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
        "/api/auth/login",
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
            password:
              formData.get("password"),
          }),
        },
      );

      const payload =
        await readApiPayload(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(
            payload,
            "Sign in could not be completed.",
          ),
        );
      }

      setNotice({
        kind: "success",
        message:
          "Sign in successful. Opening your account…",
      });

      router.replace(
        storefront.accountHref,
      );

      router.refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Sign in could not be completed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Welcome back
        </h2>

        <p className={styles.panelText}>
          Use the email and password
          registered specifically with{" "}
          {storefront.shortName}.
        </p>
      </div>

      <form
        className={styles.form}
        onSubmit={handleSubmit}
        data-auth-form="login"
      >
        <label className={styles.field}>
          <span className={styles.label}>
            Email address
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

        <label className={styles.field}>
          <span className={styles.label}>
            Password
          </span>

          <input
            className={styles.input}
            type="password"
            name="password"
            autoComplete="current-password"
            maxLength={128}
            required
            placeholder="Your password"
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
            ? "Signing in…"
            : `Sign in to ${storefront.shortName}`}
        </button>
      </form>

      <p className={styles.formFooter}>
        New to this storefront?{" "}
        <Link
          href={storefront.registerHref}
          className={styles.inlineLink}
        >
          Create an account
        </Link>
        .
      </p>
    </>
  );
}

export function RegistrationForm({
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

  async function handleSubmit(
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
        "/api/auth/register",
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
            firstName:
              formData.get(
                "firstName",
              ),
            lastName:
              formData.get(
                "lastName",
              ),
            displayName:
              formData.get(
                "displayName",
              ) || undefined,
            email:
              formData.get("email"),
            phone:
              formData.get("phone"),
            password:
              formData.get(
                "password",
              ),
            marketingOptIn:
              formData.get(
                "marketingOptIn",
              ) === "on",
            termsAccepted:
              formData.get(
                "termsAccepted",
              ) === "on",
            privacyAccepted:
              formData.get(
                "privacyAccepted",
              ) === "on",
          }),
        },
      );

      const payload =
        await readApiPayload(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(
            payload,
            "Registration could not be completed.",
          ),
        );
      }

      form.reset();

      setNotice({
        kind: "success",
        message:
          "Account created. Complete both verification steps when your email and phone messages arrive.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Registration could not be completed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Create your account
        </h2>

        <p className={styles.panelText}>
          This account belongs only to{" "}
          {storefront.name}. Accounts,
          carts and orders remain separate
          between SORVYRA storefronts.
        </p>
      </div>

      <div className={styles.notice}>
        Registration remains unavailable
        until verified email and SMS
        delivery providers are connected.
        This form is ready for activation
        afterward.
      </div>

      <form
        className={styles.form}
        onSubmit={handleSubmit}
        data-auth-form="register"
      >
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.label}>
              First name
            </span>

            <input
              className={styles.input}
              type="text"
              name="firstName"
              autoComplete="given-name"
              maxLength={100}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Last name
            </span>

            <input
              className={styles.input}
              type="text"
              name="lastName"
              autoComplete="family-name"
              maxLength={100}
              required
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>
            Display name{" "}
            <span aria-hidden="true">
              · optional
            </span>
          </span>

          <input
            className={styles.input}
            type="text"
            name="displayName"
            autoComplete="nickname"
            maxLength={100}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Email address
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

        <label className={styles.field}>
          <span className={styles.label}>
            Phone number
          </span>

          <input
            className={styles.input}
            type="tel"
            name="phone"
            autoComplete="tel"
            maxLength={32}
            required
            placeholder="+234… or +974…"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Password
          </span>

          <input
            className={styles.input}
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            placeholder="At least 12 characters"
          />
        </label>

        <label
          className={styles.checkboxRow}
        >
          <input
            className={styles.checkbox}
            type="checkbox"
            name="termsAccepted"
            required
          />

          <span>
            I accept this storefront’s
            customer terms.
          </span>
        </label>

        <label
          className={styles.checkboxRow}
        >
          <input
            className={styles.checkbox}
            type="checkbox"
            name="privacyAccepted"
            required
          />

          <span>
            I accept the privacy notice
            and account data processing.
          </span>
        </label>

        <label
          className={styles.checkboxRow}
        >
          <input
            className={styles.checkbox}
            type="checkbox"
            name="marketingOptIn"
          />

          <span>
            Send me optional product and
            offer updates. I can change
            this later.
          </span>
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
            ? "Creating account…"
            : "Create storefront account"}
        </button>
      </form>

      <p className={styles.formFooter}>
        Already registered here?{" "}
        <Link
          href={storefront.loginHref}
          className={styles.inlineLink}
        >
          Sign in
        </Link>
        .
      </p>
    </>
  );
}
