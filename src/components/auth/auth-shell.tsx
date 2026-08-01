import type {
  CSSProperties,
  ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import styles from "./auth.module.css";

interface AuthShellProps {
  storefront: StorefrontAuthConfig;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({
  storefront,
  title,
  description,
  children,
}: AuthShellProps) {
  const themeStyle = {
    "--auth-accent":
      storefront.accent,
    "--auth-accent-strong":
      storefront.accentStrong,
    "--auth-surface":
      storefront.surface,
    "--auth-deep":
      storefront.deep,
  } as CSSProperties;

  return (
    <div
      className={styles.shell}
      style={themeStyle}
      data-auth-storefront={
        storefront.code
      }
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
          href={storefront.baseHref}
          className={styles.brand}
          aria-label={`Return to ${storefront.name}`}
        >
          <span
            className={styles.brandMark}
          >
            <Image
              src={storefront.logoPath}
              alt=""
              width={44}
              height={44}
              className={styles.brandLogo}
            />
          </span>

          <span
            className={styles.brandCopy}
          >
            <span
              className={styles.eyebrow}
            >
              SORVYRA STORE ·{" "}
              {storefront.countryName}
            </span>

            <span
              className={styles.brandName}
            >
              {storefront.name}
            </span>
          </span>
        </Link>

        <nav
          className={styles.headerNav}
          aria-label="Account navigation"
        >
          <Link
            href={storefront.baseHref}
            className={styles.headerLink}
          >
            Store
          </Link>

          <Link
            href={storefront.loginHref}
            className={styles.headerLink}
          >
            Sign in
          </Link>

          <Link
            href={storefront.registerHref}
            className={styles.headerLink}
          >
            Register
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.layout}>
          <section className={styles.intro}>
            <span className={styles.kicker}>
              Private storefront account
            </span>

            <h1 className={styles.title}>
              {title}
            </h1>

            <p
              className={styles.description}
            >
              {description}
            </p>

            <div className={styles.trustRow}>
              <span
                className={styles.trustItem}
              >
                Store-isolated account
              </span>

              <span
                className={styles.trustItem}
              >
                Verified email
              </span>

              <span
                className={styles.trustItem}
              >
                Protected session
              </span>
            </div>
          </section>

          <section className={styles.panel}>
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
