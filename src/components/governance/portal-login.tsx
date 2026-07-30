"use client";

import {
  type FormEvent,
  useState,
} from "react";
import Link from "next/link";
import {
  useRouter,
} from "next/navigation";

import type {
  StorefrontAuthCode,
  StorefrontAuthConfig,
} from "@/lib/storefront-auth";

import GovernanceShell from "./governance-shell";
import styles from "./governance.module.css";

interface ApiPayload {
  error?: {
    message?: string;
  };
}

export default function PortalLogin({
  mode,
  storefronts,
  initialStorefrontCode,
  destination,
}: {
  mode: "manager" | "admin";
  storefronts:
    StorefrontAuthConfig[];
  initialStorefrontCode:
    StorefrontAuthCode;
  destination:
    | "portal"
    | "apply"
    | "admin";
}) {
  const router = useRouter();
  const [
    storefrontCode,
    setStorefrontCode,
  ] = useState(
    initialStorefrontCode,
  );
  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null,
  );
  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formData =
      new FormData(
        event.currentTarget,
      );

    setSubmitting(true);
    setNotice(null);

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
            storefrontCode,
            email:
              formData.get("email"),
            password:
              formData.get(
                "password",
              ),
          }),
        },
      );
      const payload =
        await response
          .json()
          .catch(
            () =>
              ({}) as ApiPayload,
          ) as ApiPayload;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            "Sign in could not be completed.",
        );
      }

      const destinationPath =
        destination === "admin"
          ? "/admin"
          : destination === "apply"
            ? "/manager/apply"
            : "/manager";

      router.replace(
        `${destinationPath}?storefrontCode=${storefrontCode}`,
      );
      router.refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Sign in could not be completed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isAdmin =
    mode === "admin";

  return (
    <GovernanceShell
      eyebrow={
        isAdmin
          ? "SORVYRA owner access"
          : "Store manager access"
      }
      title={
        isAdmin
          ? "Review every storefront from one protected portal."
          : "Sign in to the storefront you manage."
      }
      description={
        isAdmin
          ? "Use the verified storefront account that has been provisioned as a SORVYRA administrator."
          : "Manager access is attached to a verified storefront account after SORVYRA approval."
      }
    >
      <section
        className={styles.authGrid}
      >
        <form
          className={styles.panel}
          onSubmit={handleSubmit}
          data-governance-login={
            mode
          }
        >
          <div
            className={styles.panelHeader}
          >
            <span
              className={styles.badge}
            >
              Protected sign in
            </span>
            <h2>
              {isAdmin
                ? "Owner account"
                : "Manager account"}
            </h2>
          </div>

          <label
            className={styles.field}
          >
            <span>
              Account storefront
            </span>
            <select
              value={storefrontCode}
              onChange={(event) =>
                setStorefrontCode(
                  event.target
                    .value as
                    StorefrontAuthCode,
                )
              }
            >
              {storefronts.map(
                (storefront) => (
                  <option
                    key={
                      storefront.code
                    }
                    value={
                      storefront.code
                    }
                  >
                    {
                      storefront.shortName
                    }{" "}
                    ·{" "}
                    {
                      storefront.countryName
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label
            className={styles.field}
          >
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>

          <label
            className={styles.field}
          >
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
          </label>

          {notice ? (
            <p
              className={styles.error}
              role="alert"
            >
              {notice}
            </p>
          ) : null}

          <button
            className={styles.primaryButton}
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Signing in…"
              : "Sign in securely"}
          </button>
        </form>

        <aside
          className={styles.infoPanel}
        >
          <h2>
            Access remains separated
          </h2>
          <p>
            Selecting a storefront does
            not grant access. The server
            verifies the account,
            approval and active role
            before returning protected
            information.
          </p>

          {!isAdmin ? (
            <Link
              className={styles.textLink}
              href={`/manager/apply?storefrontCode=${storefrontCode}`}
            >
              Apply to manage this
              storefront →
            </Link>
          ) : (
            <p
              className={styles.muted}
            >
              SORVYRA administrator
              access cannot be requested
              publicly.
            </p>
          )}
        </aside>
      </section>
    </GovernanceShell>
  );
}
