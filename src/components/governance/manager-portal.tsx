"use client";

import {
  type FormEvent,
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
import {
  findStorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";

import GovernanceShell from "./governance-shell";
import styles from "./governance.module.css";

interface ApplicationView {
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
}

interface StaffView {
  id: string;
  email: string;
  name: string;
  role:
    | "MANAGER"
    | "FULFILMENT"
    | "VIEWER";
  status:
    | "ACTIVE"
    | "SUSPENDED"
    | "REVOKED";
  grantedAt: string;
}

interface ManagerPortalData {
  account: {
    email: string;
    name: string;
  };
  storefront: {
    code: string;
    name: string;
  };
  membership: {
    role:
      | "MANAGER"
      | "FULFILMENT"
      | "VIEWER";
    status:
      | "ACTIVE"
      | "SUSPENDED"
      | "REVOKED";
  } | null;
  latestApplication:
    ApplicationView | null;
  staff: StaffView[];
}

interface ApiPayload {
  ok?: boolean;
  data?:
    | ManagerPortalData
    | {
        application:
          ApplicationView;
      }
    | {
        membership:
          StaffView;
      };
  error?: {
    code?: string;
    message?: string;
  };
}

function readableStatus(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(/_/gu, " ")
    .replace(
      /^\w/u,
      (letter: string) =>
        letter.toUpperCase(),
    );
}

export default function ManagerPortal({
  storefronts,
  initialStorefrontCode,
  applicationMode = false,
}: {
  storefronts:
    StorefrontAuthConfig[];
  initialStorefrontCode:
    StorefrontAuthCode;
  applicationMode?: boolean;
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
    useState<ManagerPortalData | null>(
      null,
    );
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    notice,
    setNotice,
  ] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const [
    sessionMissing,
    setSessionMissing,
  ] = useState(false);
  const [
    busyKey,
    setBusyKey,
  ] = useState<string | null>(
    null,
  );

  const loadPortal =
    useCallback(async () => {
      setLoading(true);
      setSessionMissing(false);

      try {
        const response = await fetch(
          `/api/governance/portal?storefrontCode=${encodeURIComponent(storefrontCode)}`,
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
          !payload.data ||
          !("storefront" in
            payload.data)
        ) {
          throw new Error(
            payload.error?.message ??
              "The manager portal could not be loaded.",
          );
        }

        setData(
          payload.data as
            ManagerPortalData,
        );
      } catch (error) {
        setNotice({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "The manager portal could not be loaded.",
        });
      } finally {
        setLoading(false);
      }
    }, [storefrontCode]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  function changeStorefront(
    value: StorefrontAuthCode,
  ) {
    setStorefrontCode(value);
    const path = applicationMode
      ? "/manager/apply"
      : "/manager";
    router.replace(
      `${path}?storefrontCode=${value}`,
    );
  }

  async function submitApplication(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form =
      event.currentTarget;
    const formData =
      new FormData(form);
    setBusyKey("application");
    setNotice(null);

    try {
      const response = await fetch(
        "/api/governance/applications",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode,
            statement:
              formData.get(
                "statement",
              ),
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
            "The application could not be submitted.",
        );
      }

      form.reset();
      setNotice({
        kind: "success",
        message:
          "Your manager application is now awaiting SORVYRA review.",
      });
      await loadPortal();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The application could not be submitted.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function withdrawApplication(
    applicationId: string,
  ) {
    if (
      !window.confirm(
        "Withdraw this pending manager application?",
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
        `/api/governance/applications/${encodeURIComponent(applicationId)}/withdraw`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            storefrontCode,
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
            "The application could not be withdrawn.",
        );
      }

      setNotice({
        kind: "success",
        message:
          "The application was withdrawn.",
      });
      await loadPortal();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The application could not be withdrawn.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function submitStaffGrant(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form =
      event.currentTarget;
    const formData =
      new FormData(form);
    setBusyKey("staff-grant");
    setNotice(null);

    try {
      await performStaffAction({
        targetEmail:
          String(
            formData.get(
              "targetEmail",
            ) ?? "",
          ),
        action: "GRANT",
        role: String(
          formData.get("role") ??
            "",
        ),
        note: String(
          formData.get("note") ??
            "",
        ),
      });
      form.reset();
      setNotice({
        kind: "success",
        message:
          "Staff access was granted.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Staff access could not be granted.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function performStaffAction(
    input: {
      targetEmail: string;
      action: string;
      role?: string;
      note?: string;
    },
  ) {
    const response = await fetch(
      "/api/governance/staff",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          storefrontCode,
          ...input,
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
          "The staff action could not be completed.",
      );
    }

    await loadPortal();
  }

  async function handleStaffAction(
    staff: StaffView,
    action:
      | "CHANGE_ROLE"
      | "SUSPEND"
      | "REACTIVATE"
      | "REVOKE",
  ) {
    const nextRole =
      action === "CHANGE_ROLE"
        ? staff.role ===
            "FULFILMENT"
          ? "VIEWER"
          : "FULFILMENT"
        : undefined;
    const label =
      action === "CHANGE_ROLE"
        ? `change ${staff.name}'s role to ${readableStatus(nextRole!)}`
        : `${readableStatus(action)} ${staff.name}'s access`;

    if (
      !window.confirm(
        `Confirm: ${label}?`,
      )
    ) {
      return;
    }

    setBusyKey(
      `staff:${staff.id}:${action}`,
    );
    setNotice(null);

    try {
      await performStaffAction({
        targetEmail:
          staff.email,
        action,
        role: nextRole,
      });
      setNotice({
        kind: "success",
        message:
          "Staff access was updated.",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Staff access could not be updated.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  const storefront =
    storefronts.find(
      (item) =>
        item.code ===
        storefrontCode,
    ) ?? storefronts[0]!;
  const checkoutConfig =
    findStorefrontCheckoutConfig(
      storefrontCode,
    );
  const isActiveManager =
    data?.membership?.role ===
      "MANAGER" &&
    data.membership.status ===
      "ACTIVE";

  return (
    <GovernanceShell
      eyebrow={
        applicationMode
          ? "Manager application"
          : "Store manager portal"
      }
      title={
        applicationMode
          ? "Apply to lead one SORVYRA storefront."
          : "Operate your approved storefront."
      }
      description={
        applicationMode
          ? "Applications are reviewed by the SORVYRA owner. Approval never grants access to any other storefront."
          : "Orders, staff and permissions remain scoped to the storefront selected below."
      }
    >
      <section
        className={styles.toolbar}
      >
        <label
          className={styles.compactField}
        >
          <span>
            Selected storefront
          </span>
          <select
            value={storefrontCode}
            onChange={(event) =>
              changeStorefront(
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

        {!applicationMode ? (
          <Link
            className={styles.textLink}
            href={`/manager/apply?storefrontCode=${storefrontCode}`}
          >
            Manager application
          </Link>
        ) : (
          <Link
            className={styles.textLink}
            href={`/manager?storefrontCode=${storefrontCode}`}
          >
            Manager dashboard
          </Link>
        )}
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
          <p>Loading secure access…</p>
        </section>
      ) : sessionMissing ? (
        <section
          className={styles.panel}
        >
          <h2>
            Sign in required
          </h2>
          <p>
            Use the verified account
            registered with{" "}
            {storefront.shortName}.
          </p>
          <div
            className={styles.actions}
          >
            <Link
              className={styles.primaryLink}
              href={`/manager/login?storefrontCode=${storefrontCode}&destination=${applicationMode ? "apply" : "portal"}`}
            >
              Sign in
            </Link>
            <Link
              className={styles.secondaryLink}
              href={
                storefront.registerHref
              }
            >
              Create verified account
            </Link>
          </div>
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
                Signed in
              </span>
              <h2>
                {data.account.name}
              </h2>
              <p>{data.account.email}</p>
              <p
                className={styles.muted}
              >
                {data.storefront.name}
              </p>
            </article>

            <article
              className={styles.panel}
            >
              <span
                className={styles.badge}
              >
                Access status
              </span>
              <h2>
                {data.membership
                  ? `${readableStatus(data.membership.role)} · ${readableStatus(data.membership.status)}`
                  : "No staff access"}
              </h2>
              <p>
                {isActiveManager
                  ? "You can operate orders and manage delegated staff for this storefront."
                  : "Manager controls remain locked until SORVYRA approves an application."}
              </p>
            </article>
          </section>

          {data.latestApplication ? (
            <section
              className={styles.panel}
              data-manager-application-status={
                data.latestApplication
                  .status
              }
            >
              <div
                className={styles.sectionHeading}
              >
                <div>
                  <span
                    className={styles.badge}
                  >
                    Latest application
                  </span>
                  <h2>
                    {readableStatus(
                      data
                        .latestApplication
                        .status,
                    )}
                  </h2>
                </div>
                <time>
                  {new Date(
                    data
                      .latestApplication
                      .submittedAt,
                  ).toLocaleDateString()}
                </time>
              </div>
              <p>
                {
                  data.latestApplication
                    .statement
                }
              </p>
              {data.latestApplication
                .reviewNote ? (
                <p
                  className={styles.note}
                >
                  SORVYRA note:{" "}
                  {
                    data
                      .latestApplication
                      .reviewNote
                  }
                </p>
              ) : null}
              {data.latestApplication
                .status ===
              "PENDING" ? (
                <button
                  className={
                    styles.dangerButton
                  }
                  type="button"
                  disabled={
                    busyKey !== null
                  }
                  onClick={() =>
                    void withdrawApplication(
                      data
                        .latestApplication!
                        .id,
                    )
                  }
                >
                  Withdraw application
                </button>
              ) : null}
            </section>
          ) : null}

          {!isActiveManager &&
          data.latestApplication
            ?.status !== "PENDING" ? (
            <form
              className={styles.panel}
              onSubmit={
                submitApplication
              }
              data-manager-application-form
            >
              <div
                className={styles.panelHeader}
              >
                <span
                  className={styles.badge}
                >
                  Apply securely
                </span>
                <h2>
                  Why should you manage{" "}
                  {storefront.shortName}?
                </h2>
                <p>
                  Explain your connection
                  to the storefront,
                  operational experience
                  and responsibilities.
                </p>
              </div>
              <label
                className={styles.field}
              >
                <span>
                  Application statement
                </span>
                <textarea
                  name="statement"
                  minLength={40}
                  maxLength={2000}
                  rows={8}
                  required
                />
              </label>
              <button
                className={
                  styles.primaryButton
                }
                type="submit"
                disabled={
                  busyKey !== null
                }
              >
                Submit for SORVYRA
                review
              </button>
            </form>
          ) : null}

          {isActiveManager &&
          !applicationMode ? (
            <>
              <section
                className={styles.panel}
              >
                <div
                  className={
                    styles.sectionHeading
                  }
                >
                  <div>
                    <span
                      className={
                        styles.badge
                      }
                    >
                      Store operations
                    </span>
                    <h2>
                      Orders and fulfilment
                    </h2>
                  </div>
                  {checkoutConfig ? (
                    <Link
                      className={
                        styles.primaryLink
                      }
                      href={
                        checkoutConfig
                          .operationsHref
                      }
                    >
                      Open order queue
                    </Link>
                  ) : null}
                </div>
              </section>

              <section
                className={styles.panel}
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <span
                    className={
                      styles.badge
                    }
                  >
                    Staff controls
                  </span>
                  <h2>
                    Grant delegated access
                  </h2>
                  <p>
                    The person must already
                    have a verified account
                    in this storefront.
                    Managers cannot grant
                    manager access.
                  </p>
                </div>
                <form
                  className={
                    styles.inlineForm
                  }
                  onSubmit={
                    submitStaffGrant
                  }
                >
                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      Account email
                    </span>
                    <input
                      name="targetEmail"
                      type="email"
                      required
                      maxLength={254}
                    />
                  </label>
                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>Role</span>
                    <select
                      name="role"
                      defaultValue="FULFILMENT"
                    >
                      <option value="FULFILMENT">
                        Fulfilment
                      </option>
                      <option value="VIEWER">
                        View only
                      </option>
                    </select>
                  </label>
                  <label
                    className={
                      styles.field
                    }
                  >
                    <span>
                      Internal note
                    </span>
                    <input
                      name="note"
                      maxLength={500}
                    />
                  </label>
                  <button
                    className={
                      styles.primaryButton
                    }
                    type="submit"
                    disabled={
                      busyKey !== null
                    }
                  >
                    Grant access
                  </button>
                </form>
              </section>

              <section
                className={styles.panel}
              >
                <div
                  className={
                    styles.panelHeader
                  }
                >
                  <span
                    className={
                      styles.badge
                    }
                  >
                    Team
                  </span>
                  <h2>
                    Storefront staff
                  </h2>
                </div>

                <div
                  className={
                    styles.list
                  }
                >
                  {data.staff.map(
                    (staff) => (
                      <article
                        key={staff.id}
                        className={
                          styles.listItem
                        }
                      >
                        <div>
                          <h3>
                            {staff.name}
                          </h3>
                          <p>
                            {staff.email}
                          </p>
                          <span
                            className={
                              styles.status
                            }
                          >
                            {readableStatus(
                              staff.role,
                            )}{" "}
                            ·{" "}
                            {readableStatus(
                              staff.status,
                            )}
                          </span>
                        </div>

                        {staff.role !==
                        "MANAGER" ? (
                          <div
                            className={
                              styles.actions
                            }
                          >
                            {staff.status ===
                            "ACTIVE" ? (
                              <>
                                <button
                                  className={
                                    styles.secondaryButton
                                  }
                                  type="button"
                                  disabled={
                                    busyKey !==
                                    null
                                  }
                                  onClick={() =>
                                    void handleStaffAction(
                                      staff,
                                      "CHANGE_ROLE",
                                    )
                                  }
                                >
                                  Change role
                                </button>
                                <button
                                  className={
                                    styles.secondaryButton
                                  }
                                  type="button"
                                  disabled={
                                    busyKey !==
                                    null
                                  }
                                  onClick={() =>
                                    void handleStaffAction(
                                      staff,
                                      "SUSPEND",
                                    )
                                  }
                                >
                                  Suspend
                                </button>
                              </>
                            ) : staff.status ===
                              "SUSPENDED" ? (
                              <button
                                className={
                                  styles.secondaryButton
                                }
                                type="button"
                                disabled={
                                  busyKey !==
                                  null
                                }
                                onClick={() =>
                                  void handleStaffAction(
                                    staff,
                                    "REACTIVATE",
                                  )
                                }
                              >
                                Reactivate
                              </button>
                            ) : null}
                            {staff.status !==
                            "REVOKED" ? (
                              <button
                                className={
                                  styles.dangerButton
                                }
                                type="button"
                                disabled={
                                  busyKey !==
                                  null
                                }
                                onClick={() =>
                                  void handleStaffAction(
                                    staff,
                                    "REVOKE",
                                  )
                                }
                              >
                                Revoke
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span
                            className={
                              styles.muted
                            }
                          >
                            SORVYRA-controlled
                          </span>
                        )}
                      </article>
                    ),
                  )}
                </div>
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </GovernanceShell>
  );
}
