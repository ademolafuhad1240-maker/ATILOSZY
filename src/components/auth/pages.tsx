import type {
  CSSProperties,
} from "react";
import Link from "next/link";

import SorvyraLogo from "@/components/brand/sorvyra-logo";

import {
  getAllStorefrontAuthConfigs,
  type StorefrontAuthConfig,
} from "../../lib/storefront-auth";
import {
  getCustomerAccountSummary,
} from "../../server/auth/account";
import {
  requireStorefrontSession,
} from "../../server/auth/page-session";

import {
  AccountPanel,
} from "./account-panel";
import {
  AuthShell,
} from "./auth-shell";
import {
  LoginForm,
  RegistrationForm,
} from "./auth-forms";
import {
  VerificationForm,
} from "./verify-form";
import {
  ForgotPasswordForm,
  ResetPasswordForm,
} from "./recovery-forms";

import styles from "./auth.module.css";

type SearchParams =
  Record<
    string,
    string |
    string[] |
    undefined
  >;

function firstSearchValue(
  value:
    | string
    | string[]
    | undefined,
): string | undefined {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export function StorefrontLoginPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  return (
    <AuthShell
      storefront={storefront}
      title="Your store, remembered."
      description={
        storefront.description
      }
    >
      <LoginForm
        storefront={storefront}
      />
    </AuthShell>
  );
}

export function StorefrontRegisterPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  return (
    <AuthShell
      storefront={storefront}
      title="One account for every storefront."
      description={
        "Create one verified SORVYRA STORE account for every storefront. Carts, checkout and orders remain separated by storefront."
      }
    >
      <RegistrationForm
        storefront={storefront}
      />
    </AuthShell>
  );
}

export function StorefrontVerifyPage({
  storefront,
  searchParams,
}: {
  storefront: StorefrontAuthConfig;
  searchParams: SearchParams;
}) {
  return (
    <AuthShell
      storefront={storefront}
      title="Confirm it is really you."
      description={
        "Verify your email to protect your account and unlock checkout, pickup reservations and order tracking."
      }
    >
      <VerificationForm
        storefront={storefront}
        initialEmailToken={
          firstSearchValue(
            searchParams.token,
          )
        }
      />
    </AuthShell>
  );
}

export function StorefrontForgotPasswordPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  return (
    <AuthShell
      storefront={storefront}
      title="Recover access safely."
      description={
        "Request a single-use recovery link for your SORVYRA STORE account."
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
}) {
  const session =
    await requireStorefrontSession(
      storefront.code,
      storefront.loginHref,
    );

  const summary =
    await getCustomerAccountSummary({
      userId: session.userId,
      storefrontId:
        session.storefrontId,
    });

  return (
    <AuthShell
      storefront={storefront}
      title="Your account, secured."
      description={
        "Review your verified SORVYRA identity and continue shopping across every storefront from one protected account."
      }
    >
      <AccountPanel
        storefront={storefront}
        summary={{
          email: summary.email,
          phone: summary.phone,
          phoneVerified:
            summary.phoneVerified,
          status: summary.status,
          createdAt:
            summary.createdAt
              .toISOString(),
          lastLoginAt:
            summary.lastLoginAt
              ?.toISOString() ??
            null,
          profile: summary.profile,
          security: summary.security,
        }}
      />
    </AuthShell>
  );
}

export function GlobalAccountPortalPage() {
  const storefronts =
    getAllStorefrontAuthConfigs();

  return (
    <div
      className={styles.shell}
      data-auth-portal="global"
    >
      <div
        className={styles.ambientOne}
        aria-hidden="true"
      />
      <div
        className={styles.ambientTwo}
        aria-hidden="true"
      />

      <header className={styles.header}>
        <Link
          href="/"
          className={styles.brand}
          aria-label="SORVYRA STORE home"
        >
          <SorvyraLogo
            size="compact"
            subtitle="Owned storefront network"
            tone="dark"
          />
        </Link>

        <nav
          className={styles.headerNav}
          aria-label="Store navigation"
        >
          <Link
            href="/"
            className={styles.headerLink}
          >
            Home
          </Link>

          <Link
            href="/shop"
            className={styles.headerLink}
          >
            Shop
          </Link>

          <Link
            href="/manager/login"
            className={styles.headerLink}
          >
            Manager sign in
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section
          className={styles.portalIntro}
        >
          <span className={styles.kicker}>
            Storefront accounts
          </span>

          <h1
            className={styles.portalTitle}
          >
            Choose the store you joined.
          </h1>

          <p
            className={styles.portalText}
          >
            Each SORVYRA storefront keeps
            its customer accounts, carts
            and orders separate. Select
            the exact store where you
            registered.
          </p>
        </section>

        <section
          className={styles.portalGrid}
        >
          {storefronts.map(
            (storefront) => {
              const cardStyle = {
                "--card-accent":
                  storefront.accent,
              } as CSSProperties;

              return (
                <Link
                  key={storefront.code}
                  href={
                    storefront.loginHref
                  }
                  className={
                    styles.portalCard
                  }
                  style={cardStyle}
                  data-portal-storefront={
                    storefront.code
                  }
                >
                  <span
                    className={
                      styles.portalCountry
                    }
                  >
                    {storefront.countryName}
                    {" · "}
                    {storefront.currencyCode}
                  </span>

                  <h2
                    className={
                      styles.portalName
                    }
                  >
                    {storefront.name}
                  </h2>

                  <span
                    className={
                      styles.portalAction
                    }
                  >
                    Open storefront account
                    →
                  </span>
                </Link>
              );
            },
          )}
        </section>
      </main>
    </div>
  );
}
