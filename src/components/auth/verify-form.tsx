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
import {
  ResendVerificationForm,
} from "./recovery-forms";

interface ApiPayload {
  error?: {
    message?: string;
  };
}

interface ChannelNotice {
  kind: "error" | "success";
  message: string;
}

async function payloadFrom(
  response: Response,
): Promise<ApiPayload> {
  try {
    return await response.json() as ApiPayload;
  } catch {
    return {};
  }
}

export function VerificationForm({
  storefront,
  initialEmailToken,
  initialPhoneChallengeId,
}: {
  storefront: StorefrontAuthConfig;
  initialEmailToken?: string;
  initialPhoneChallengeId?: string;
}) {
  const [
    emailNotice,
    setEmailNotice,
  ] = useState<ChannelNotice | null>(
    null,
  );

  const [
    phoneNotice,
    setPhoneNotice,
  ] = useState<ChannelNotice | null>(
    null,
  );

  const [
    emailSubmitting,
    setEmailSubmitting,
  ] = useState(false);

  const [
    phoneSubmitting,
    setPhoneSubmitting,
  ] = useState(false);

  async function verifyEmail(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const formData = new FormData(
      event.currentTarget,
    );

    setEmailNotice(null);
    setEmailSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/verify/email",
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
              formData.get(
                "emailToken",
              ),
          }),
        },
      );

      const payload =
        await payloadFrom(response);

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
          "Email verification failed.",
        );
      }

      setEmailNotice({
        kind: "success",
        message:
          "Email verified successfully.",
      });
    } catch (error) {
      setEmailNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Email verification failed.",
      });
    } finally {
      setEmailSubmitting(false);
    }
  }

  async function verifyPhone(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const formData = new FormData(
      event.currentTarget,
    );

    setPhoneNotice(null);
    setPhoneSubmitting(true);

    try {
      const response = await fetch(
        "/api/auth/verify/phone",
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
            challengeId:
              formData.get(
                "challengeId",
              ),
            code:
              formData.get(
                "phoneCode",
              ),
          }),
        },
      );

      const payload =
        await payloadFrom(response);

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
          "Phone verification failed.",
        );
      }

      setPhoneNotice({
        kind: "success",
        message:
          "Phone verified successfully. You can now sign in after both verification steps are complete.",
      });
    } catch (error) {
      setPhoneNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Phone verification failed.",
      });
    } finally {
      setPhoneSubmitting(false);
    }
  }

  return (
    <>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Verify your account
        </h2>

        <p className={styles.panelText}>
          Both email and phone must be
          verified before you can place
          orders or reserve pickup.
        </p>
      </div>

      <div
        className={styles.verifyStack}
        data-auth-form="verify"
      >
        <section
          className={styles.verifyCard}
        >
          <h3
            className={styles.verifyTitle}
          >
            Email verification
          </h3>

          <p
            className={styles.verifyText}
          >
            Open the verification link
            sent to your registered email,
            or enter its secure token.
          </p>

          <form
            className={styles.form}
            onSubmit={verifyEmail}
          >
            <label
              className={styles.field}
            >
              <span
                className={styles.label}
              >
                Email verification token
              </span>

              <input
                className={styles.input}
                type="text"
                name="emailToken"
                defaultValue={
                  initialEmailToken
                }
                maxLength={256}
                required
                autoComplete="off"
              />
            </label>

            {emailNotice ? (
              <div
                className={
                  emailNotice.kind ===
                  "error"
                    ? styles.errorNotice
                    : styles.successNotice
                }
                role={
                  emailNotice.kind ===
                  "error"
                    ? "alert"
                    : "status"
                }
                aria-live="polite"
              >
                {emailNotice.message}
              </div>
            ) : null}

            <button
              className={
                styles.primaryButton
              }
              type="submit"
              disabled={emailSubmitting}
            >
              {emailSubmitting
                ? "Verifying email…"
                : "Verify email"}
            </button>
          </form>
        </section>

        <section
          className={styles.verifyCard}
        >
          <h3
            className={styles.verifyTitle}
          >
            Phone verification
          </h3>

          <p
            className={styles.verifyText}
          >
            Enter the challenge reference
            and one-time code delivered to
            your registered phone.
          </p>

          <form
            className={styles.form}
            onSubmit={verifyPhone}
          >
            <label
              className={styles.field}
            >
              <span
                className={styles.label}
              >
                Challenge reference
              </span>

              <input
                className={styles.input}
                type="text"
                name="challengeId"
                defaultValue={
                  initialPhoneChallengeId
                }
                maxLength={256}
                required
                autoComplete="off"
              />
            </label>

            <label
              className={styles.field}
            >
              <span
                className={styles.label}
              >
                Six-digit code
              </span>

              <input
                className={styles.input}
                type="text"
                name="phoneCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                minLength={6}
                maxLength={6}
                pattern="[0-9]{6}"
                required
                placeholder="000000"
              />
            </label>

            {phoneNotice ? (
              <div
                className={
                  phoneNotice.kind ===
                  "error"
                    ? styles.errorNotice
                    : styles.successNotice
                }
                role={
                  phoneNotice.kind ===
                  "error"
                    ? "alert"
                    : "status"
                }
                aria-live="polite"
              >
                {phoneNotice.message}
              </div>
            ) : null}

            <button
              className={
                styles.primaryButton
              }
              type="submit"
              disabled={phoneSubmitting}
            >
              {phoneSubmitting
                ? "Verifying phone…"
                : "Verify phone"}
            </button>
          </form>
        </section>
      </div>

      <ResendVerificationForm
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
      </p>
    </>
  );
}
