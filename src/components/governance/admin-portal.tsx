"use client";

import {
  useCallback,
  useEffect,
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

interface AdminApplication {
  id: string;
  status:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "WITHDRAWN";
  statement: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  storefront: {
    code: string;
    name: string;
  };
  applicant: {
    email: string;
    phone: string;
    name: string;
  };
}

interface AdminManager {
  membershipId: string;
  storefront: {
    code: string;
    name: string;
  };
  manager: {
    email: string;
    name: string;
  };
  status:
    | "ACTIVE"
    | "SUSPENDED"
    | "REVOKED";
  grantedAt: string;
}

interface AdminData {
  administrator: {
    role: "OWNER" | "ADMIN";
    email: string;
  };
  applications:
    AdminApplication[];
  managers: AdminManager[];
}

interface ApiPayload {
  data?: AdminData;
  error?: {
    code?: string;
    message?: string;
  };
}

function readable(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(/_/gu, " ")
    .replace(
      /^\w/u,
      (letter: string) =>
        letter.toUpperCase(),
    );
}

export default function AdminPortal({
  storefronts,
  initialStorefrontCode,
}: {
  storefronts:
    StorefrontAuthConfig[];
  initialStorefrontCode:
    StorefrontAuthCode;
}) {
  const router = useRouter();
  const [
    storefrontCode,
    setStorefrontCode,
  ] = useState(
    initialStorefrontCode,
  );
  const [
    data,
    setData,
  ] =
    useState<AdminData | null>(
      null,
    );
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    sessionMissing,
    setSessionMissing,
  ] = useState(false);
  const [
    notice,
    setNotice,
  ] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const [
    busyKey,
    setBusyKey,
  ] = useState<string | null>(
    null,
  );
  const [
    reviewNotes,
    setReviewNotes,
  ] = useState<
    Record<string, string>
  >({});

  const loadAdmin =
    useCallback(async () => {
      setLoading(true);
      setSessionMissing(false);

      try {
        const response = await fetch(
          `/api/governance/admin?storefrontCode=${encodeURIComponent(storefrontCode)}`,
          {
            credentials:
              "same-origin",
            cache: "no-store",
          },
        );
        const payload =
          await response
            .json()
            .catch(
              () => ({}),
            ) as ApiPayload;

        if (
          response.status === 401
        ) {
          setSessionMissing(true);
          setData(null);
          return;
        }

        if (
          !response.ok ||
          !payload.data
        ) {
          throw new Error(
            payload.error?.message ??
              "The owner portal could not be loaded.",
          );
        }

        setData(payload.data);
      } catch (error) {
        setData(null);
        setNotice({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "The owner portal could not be loaded.",
        });
      } finally {
        setLoading(false);
      }
    }, [storefrontCode]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  function changeAccountStorefront(
    value: StorefrontAuthCode,
  ) {
    setStorefrontCode(value);
    setNotice(null);
    router.replace(
      `/admin?storefrontCode=${value}`,
    );
  }

  async function reviewApplication(
    applicationId: string,
    decision:
      | "APPROVE"
      | "REJECT",
  ) {
    const action =
      decision === "APPROVE"
        ? "approve this application and grant manager access"
        : "reject this manager application";

    if (
      !window.confirm(
        `Confirm: ${action}?`,
      )
    ) {
      return;
    }

    setBusyKey(
      `application:${applicationId}`,
    );
    setNotice(null);

    try {
      const response = await fetch(
        `/api/governance/admin/applications/${encodeURIComponent(applicationId)}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode,
            decision,
            note:
              reviewNotes[
                applicationId
              ] ?? "",
          }),
        },
      );
      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          ) as ApiPayload;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            "The application decision could not be saved.",
        );
      }

      setNotice({
        kind: "success",
        message:
          decision === "APPROVE"
            ? "Manager access was approved."
            : "The application was rejected.",
      });
      await loadAdmin();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The application decision could not be saved.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function changeManagerStatus(
    manager: AdminManager,
    action:
      | "SUSPEND"
      | "REACTIVATE"
      | "REVOKE",
  ) {
    if (
      !window.confirm(
        `Confirm: ${readable(action)} ${manager.manager.name}'s manager access for ${manager.storefront.name}?`,
      )
    ) {
      return;
    }

    setBusyKey(
      `manager:${manager.membershipId}`,
    );
    setNotice(null);

    try {
      const response = await fetch(
        `/api/governance/admin/managers/${encodeURIComponent(manager.membershipId)}/status`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode,
            action,
          }),
        },
      );
      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          ) as ApiPayload;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            "Manager access could not be updated.",
        );
      }

      setNotice({
        kind: "success",
        message:
          "Manager access was updated.",
      });
      await loadAdmin();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Manager access could not be updated.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  const pending =
    data?.applications.filter(
      (application) =>
        application.status ===
        "PENDING",
    ) ?? [];
  const history =
    data?.applications.filter(
      (application) =>
        application.status !==
        "PENDING",
    ) ?? [];
  const accountStorefront =
    storefronts.find(
      (item) =>
        item.code ===
        storefrontCode,
    ) ?? storefronts[0]!;

  return (
    <GovernanceShell
      eyebrow="SORVYRA governance"
      title="Approve managers without weakening storefront boundaries."
      description="Your platform-level role can review every application. Approved managers receive access only to the storefront named in their application."
    >
      <section
        className={styles.toolbar}
      >
        <label
          className={styles.compactField}
        >
          <span>
            Administrator account
          </span>
          <select
            value={storefrontCode}
            onChange={(event) =>
              changeAccountStorefront(
                event.target.value as
                  StorefrontAuthCode,
              )
            }
          >
            {storefronts.map(
              (item) => (
                <option
                  key={item.code}
                  value={item.code}
                >
                  {item.shortName}
                </option>
              ),
            )}
          </select>
        </label>
        <span
          className={styles.muted}
        >
          This identifies your login
          account, not the scope of your
          platform role.
        </span>
      </section>

      {notice ? (
        <p
          className={
            notice.kind === "error"
              ? styles.error
              : styles.success
          }
          role="status"
        >
          {notice.message}
        </p>
      ) : null}

      {loading ? (
        <section
          className={styles.panel}
        >
          <p>
            Loading SORVYRA
            governance…
          </p>
        </section>
      ) : sessionMissing ? (
        <section
          className={styles.panel}
        >
          <h2>
            Administrator sign in
            required
          </h2>
          <p>
            Sign in with the verified{" "}
            {
              accountStorefront.shortName
            }{" "}
            account provisioned as a
            SORVYRA administrator.
          </p>
          <Link
            className={styles.primaryLink}
            href={`/admin/login?storefrontCode=${storefrontCode}`}
          >
            Sign in to owner portal
          </Link>
        </section>
      ) : data ? (
        <>
          <section
            className={styles.summaryGrid}
          >
            <article
              className={styles.panel}
            >
              <span
                className={styles.badge}
              >
                Administrator
              </span>
              <h2>
                {readable(
                  data.administrator
                    .role,
                )}
              </h2>
              <p>
                {
                  data.administrator
                    .email
                }
              </p>
            </article>
            <article
              className={styles.panel}
            >
              <span
                className={styles.badge}
              >
                Awaiting review
              </span>
              <h2>{pending.length}</h2>
              <p>
                Pending manager
                applications across all
                storefronts.
              </p>
            </article>
            <article
              className={styles.panel}
            >
              <span
                className={styles.badge}
              >
                Managers
              </span>
              <h2>
                {
                  data.managers.filter(
                    (manager) =>
                      manager.status ===
                      "ACTIVE",
                  ).length
                }
              </h2>
              <p>
                Active approved managers.
              </p>
            </article>
          </section>

          <section
            className={styles.panel}
            data-admin-applications
          >
            <div
              className={styles.panelHeader}
            >
              <span
                className={styles.badge}
              >
                Application queue
              </span>
              <h2>
                Pending manager
                applications
              </h2>
            </div>

            {pending.length === 0 ? (
              <p
                className={styles.muted}
              >
                No applications are
                awaiting review.
              </p>
            ) : (
              <div
                className={styles.list}
              >
                {pending.map(
                  (application) => (
                    <article
                      key={
                        application.id
                      }
                      className={
                        styles.applicationCard
                      }
                    >
                      <div
                        className={
                          styles.sectionHeading
                        }
                      >
                        <div>
                          <span
                            className={
                              styles.status
                            }
                          >
                            {
                              application
                                .storefront
                                .code
                            }{" "}
                            · Pending
                          </span>
                          <h3>
                            {
                              application
                                .applicant
                                .name
                            }
                          </h3>
                          <p>
                            {
                              application
                                .applicant
                                .email
                            }{" "}
                            ·{" "}
                            {
                              application
                                .applicant
                                .phone
                            }
                          </p>
                        </div>
                        <time>
                          {new Date(
                            application
                              .submittedAt,
                          ).toLocaleDateString()}
                        </time>
                      </div>

                      <p>
                        {
                          application
                            .statement
                        }
                      </p>

                      <label
                        className={
                          styles.field
                        }
                      >
                        <span>
                          Review note
                        </span>
                        <textarea
                          rows={3}
                          maxLength={500}
                          value={
                            reviewNotes[
                              application
                                .id
                            ] ?? ""
                          }
                          onChange={(
                            event,
                          ) =>
                            setReviewNotes(
                              (
                                current,
                              ) => ({
                                ...current,
                                [application.id]:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                        />
                      </label>

                      <div
                        className={
                          styles.actions
                        }
                      >
                        <button
                          className={
                            styles.primaryButton
                          }
                          type="button"
                          disabled={
                            busyKey !== null
                          }
                          onClick={() =>
                            void reviewApplication(
                              application.id,
                              "APPROVE",
                            )
                          }
                        >
                          Approve manager
                        </button>
                        <button
                          className={
                            styles.dangerButton
                          }
                          type="button"
                          disabled={
                            busyKey !== null
                          }
                          onClick={() =>
                            void reviewApplication(
                              application.id,
                              "REJECT",
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
          </section>

          <section
            className={styles.panel}
            data-admin-managers
          >
            <div
              className={styles.panelHeader}
            >
              <span
                className={styles.badge}
              >
                Manager directory
              </span>
              <h2>
                Approved storefront
                managers
              </h2>
            </div>
            <div
              className={styles.list}
            >
              {data.managers.map(
                (manager) => (
                  <article
                    key={
                      manager.membershipId
                    }
                    className={
                      styles.listItem
                    }
                  >
                    <div>
                      <h3>
                        {
                          manager.manager
                            .name
                        }
                      </h3>
                      <p>
                        {
                          manager.manager
                            .email
                        }
                      </p>
                      <span
                        className={
                          styles.status
                        }
                      >
                        {
                          manager.storefront
                            .code
                        }{" "}
                        ·{" "}
                        {readable(
                          manager.status,
                        )}
                      </span>
                    </div>
                    <div
                      className={
                        styles.actions
                      }
                    >
                      {manager.status ===
                      "ACTIVE" ? (
                        <button
                          className={
                            styles.secondaryButton
                          }
                          type="button"
                          disabled={
                            busyKey !== null
                          }
                          onClick={() =>
                            void changeManagerStatus(
                              manager,
                              "SUSPEND",
                            )
                          }
                        >
                          Suspend
                        </button>
                      ) : manager.status ===
                        "SUSPENDED" ? (
                        <button
                          className={
                            styles.secondaryButton
                          }
                          type="button"
                          disabled={
                            busyKey !== null
                          }
                          onClick={() =>
                            void changeManagerStatus(
                              manager,
                              "REACTIVATE",
                            )
                          }
                        >
                          Reactivate
                        </button>
                      ) : null}
                      {manager.status !==
                      "REVOKED" ? (
                        <button
                          className={
                            styles.dangerButton
                          }
                          type="button"
                          disabled={
                            busyKey !== null
                          }
                          onClick={() =>
                            void changeManagerStatus(
                              manager,
                              "REVOKE",
                            )
                          }
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>

          <section
            className={styles.panel}
          >
            <div
              className={styles.panelHeader}
            >
              <span
                className={styles.badge}
              >
                Review history
              </span>
              <h2>
                Resolved applications
              </h2>
            </div>
            <div
              className={styles.compactList}
            >
              {history.map(
                (application) => (
                  <div
                    key={
                      application.id
                    }
                    className={
                      styles.historyRow
                    }
                  >
                    <span>
                      {
                        application
                          .applicant.name
                      }{" "}
                      ·{" "}
                      {
                        application
                          .storefront.code
                      }
                    </span>
                    <strong>
                      {readable(
                        application.status,
                      )}
                    </strong>
                  </div>
                ),
              )}
            </div>
          </section>
        </>
      ) : null}
    </GovernanceShell>
  );
}
