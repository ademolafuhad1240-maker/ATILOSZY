"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import styles from "./auth.module.css";

export interface AccountPanelSummary {
  email: string;
  phone: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string | null;
    marketingOptIn: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    loginAlertsEnabled: boolean;
  };
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

export function AccountPanel({
  storefront,
  summary,
}: {
  storefront: StorefrontAuthConfig;
  summary: AccountPanelSummary;
}) {
  const router = useRouter();

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);

  const [
    logoutError,
    setLogoutError,
  ] = useState<string | null>(
    null,
  );

  const customerName =
    summary.profile.displayName ||
    [
      summary.profile.firstName,
      summary.profile.lastName,
    ].join(" ");

  async function logout(): Promise<void> {
    setLogoutError(null);
    setLoggingOut(true);

    try {
      const response = await fetch(
        "/api/auth/logout",
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
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          "Sign out could not be completed.",
        );
      }

      router.replace(
        storefront.loginHref,
      );

      router.refresh();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Sign out could not be completed.",
      );

      setLoggingOut(false);
    }
  }

  return (
    <div
      className={styles.accountPanel}
      data-account-storefront={
        storefront.code
      }
    >
      <div className={styles.accountTop}>
        <div
          className={styles.accountIdentity}
        >
          <h2
            className={styles.accountName}
          >
            {customerName}
          </h2>

          <p
            className={styles.accountEmail}
          >
            {summary.email}
          </p>

          <span
            className={styles.statusPill}
          >
            Verified account
          </span>
        </div>

        <button
          className={styles.secondaryButton}
          type="button"
          onClick={logout}
          disabled={loggingOut}
        >
          {loggingOut
            ? "Signing out…"
            : "Sign out"}
        </button>
      </div>

      <div className={styles.accountGrid}>
        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Storefront
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {storefront.name}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Phone
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {summary.phone}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Account created
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {formatDate(
              summary.createdAt,
            )}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Last sign in
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {formatDate(
              summary.lastLoginAt,
            )}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Login alerts
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {summary.security
              .loginAlertsEnabled
              ? "Enabled"
              : "Disabled"}
          </p>
        </section>

        <section
          className={styles.accountCard}
        >
          <p
            className={
              styles.accountCardLabel
            }
          >
            Two-factor authentication
          </p>

          <p
            className={
              styles.accountCardValue
            }
          >
            {summary.security
              .twoFactorEnabled
              ? "Enabled"
              : "Optional — not enabled"}
          </p>
        </section>
      </div>

      {logoutError ? (
        <div
          className={styles.errorNotice}
          role="alert"
          aria-live="polite"
        >
          {logoutError}
        </div>
      ) : null}

      <div className={styles.accountActions}>
        <Link
          href={storefront.baseHref}
          className={styles.headerLink}
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
