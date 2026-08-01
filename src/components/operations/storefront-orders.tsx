"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import type {
  StorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";
import type {
  StaffContextView,
  StaffOrderQueue,
  StaffOrderView,
} from "@/server/operations/types";

import styles from "./storefront-orders.module.css";

interface StaffOrdersEnvelope {
  staff?: StaffContextView;
  queue?: StaffOrderQueue;
  orders?: StaffOrderView[];
  order?: StaffOrderView;
  error?: {
    code?: string;
    message?: string;
  };
}

const queueOptions:
  Array<{
    value: StaffOrderQueue;
    label: string;
  }> = [
    {
      value: "ACTIONABLE",
      label: "Needs action",
    },
    {
      value: "COMPLETED",
      label: "Completed",
    },
    {
      value: "ALL",
      label: "All orders",
    },
  ];

const actionLabels:
  Record<
    StaffOrderView[
      "availableActions"
    ][number],
    string
  > = {
    CONFIRM: "Confirm paid order",
    START_PREPARING:
      "Start preparing",
    MARK_READY_FOR_PICKUP:
      "Mark ready for pickup",
    MARK_OUT_FOR_DELIVERY:
      "Mark out for delivery",
    START_INSTALLATION:
      "Start installation",
    COMPLETE: "Complete order",
  };

async function readPayload(
  response: Response,
): Promise<StaffOrdersEnvelope> {
  try {
    return await response.json() as
      StaffOrdersEnvelope;
  } catch {
    return {};
  }
}

function humanize(
  value: string,
): string {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (part) =>
        part.length === 0
          ? part
          : `${part[0]?.toUpperCase()}${part.slice(
              1,
            )}`,
    )
    .join(" ");
}

function money(
  value: string,
  currencyCode: string,
): string {
  const amount =
    Number(value);

  if (
    !Number.isFinite(amount)
  ) {
    return `${currencyCode} ${value}`;
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency:
        currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

function dateTime(
  value: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

export default function StorefrontOrders({
  storefront,
}: {
  storefront:
    StorefrontCheckoutConfig;
}) {
  const [
    queue,
    setQueue,
  ] = useState<StaffOrderQueue>(
    "ACTIONABLE",
  );

  const [
    orders,
    setOrders,
  ] = useState<
    StaffOrderView[]
  >([]);

  const [
    staff,
    setStaff,
  ] = useState<
    StaffContextView | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    authRequired,
    setAuthRequired,
  ] = useState(false);

  const [
    accessDenied,
    setAccessDenied,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    transitioning,
    setTransitioning,
  ] = useState<string | null>(
    null,
  );

  useEffect(
    () => {
      let active = true;

      async function loadOrders() {
        setLoading(true);
        setError(null);
        setAuthRequired(false);
        setAccessDenied(false);

        try {
          const response =
            await fetch(
              `/api/staff/orders?storefrontCode=${encodeURIComponent(
                storefront.code,
              )}&queue=${encodeURIComponent(
                queue,
              )}`,
              {
                method: "GET",
                credentials:
                  "same-origin",
                cache: "no-store",
                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const payload =
            await readPayload(
              response,
            );

          if (!active) {
            return;
          }

          if (
            response.status === 401
          ) {
            setAuthRequired(true);
            return;
          }

          if (
            response.status === 403
          ) {
            setAccessDenied(true);
            return;
          }

          if (
            !response.ok ||
            !payload.staff ||
            !payload.orders
          ) {
            setError(
              payload.error
                ?.message ??
                "The staff order queue could not be loaded.",
            );
            return;
          }

          setStaff(payload.staff);
          setOrders(
            payload.orders,
          );
        } catch {
          if (active) {
            setError(
              "The staff order queue could not be loaded. Check your connection and try again.",
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadOrders();

      return () => {
        active = false;
      };
    },
    [
      queue,
      storefront.code,
    ],
  );

  async function transitionOrder(
    order: StaffOrderView,
    action:
      StaffOrderView[
        "availableActions"
      ][number],
  ) {
    if (transitioning) {
      return;
    }

    const confirmed =
      window.confirm(
        `${actionLabels[action]} for ${order.orderNumber}? This change is recorded in the fulfilment audit history.`,
      );

    if (!confirmed) {
      return;
    }

    setTransitioning(
      order.orderNumber,
    );
    setError(null);

    try {
      const response =
        await fetch(
          `/api/staff/orders/${encodeURIComponent(
            order.orderNumber,
          )}/transition`,
          {
            method: "POST",
            credentials:
              "same-origin",
            headers: {
              Accept:
                "application/json",
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                storefrontCode:
                  storefront.code,
                action,
              }),
          },
        );

      const payload =
        await readPayload(
          response,
        );

      if (
        response.status === 401
      ) {
        setAuthRequired(true);
        return;
      }

      if (
        response.status === 403
      ) {
        setAccessDenied(true);
        return;
      }

      if (
        !response.ok ||
        !payload.order
      ) {
        setError(
          payload.error
            ?.message ??
            "The order could not be updated.",
        );
        return;
      }

      setOrders(
        (current) =>
          current
            .map(
              (candidate) =>
                candidate
                  .orderNumber ===
                payload.order
                  ?.orderNumber
                  ? payload.order
                  : candidate,
            )
            .filter(
              (candidate) =>
                queue !==
                  "ACTIONABLE" ||
                candidate.status !==
                  "COMPLETED",
            ),
      );
    } catch {
      setError(
        "The order could not be updated. Check your connection and try again.",
      );
    } finally {
      setTransitioning(null);
    }
  }

  return (
    <main
      className={styles.page}
      data-staff-orders={
        storefront.code
      }
    >
      <header
        className={styles.header}
      >
        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            Storefront operations
          </p>

          <h1>
            {storefront.shortName}
            {" "}
            orders
          </h1>

          <p>
            A private,
            storefront-scoped queue
            for verified paid
            orders and fulfilment.
          </p>
        </div>

        <nav
          aria-label="Staff order navigation"
        >
          <Link
            href={
              storefront.shopHref
            }
          >
            Storefront
          </Link>

          <Link
            href={
              storefront.accountHref
            }
          >
            Account
          </Link>

          <Link
            href={`/manager?storefrontCode=${storefront.code}`}
          >
            Manager portal
          </Link>
        </nav>
      </header>

      {loading ? (
        <section
          className={styles.state}
          aria-live="polite"
        >
          <h2>
            Loading staff queue
          </h2>

          <p>
            Verifying the
            storefront session and
            staff membership.
          </p>
        </section>
      ) : authRequired ? (
        <section
          className={styles.state}
          role="alert"
        >
          <p
            className={
              styles.eyebrow
            }
          >
            Sign-in required
          </p>

          <h2>
            Sign in to the
            storefront account
          </h2>

          <p>
            Staff operations use a
            verified storefront
            session plus an active
            staff membership.
          </p>

          <Link
            className={
              styles.primaryLink
            }
            href={
              `/manager/login?storefrontCode=${storefront.code}`
            }
          >
            Sign in
          </Link>
        </section>
      ) : accessDenied ? (
        <section
          className={styles.state}
          role="alert"
        >
          <p
            className={
              styles.eyebrow
            }
          >
            Staff access required
          </p>

          <h2>
            This account is not an
            active staff member
          </h2>

          <p>
            Public registration cannot
            grant staff access. Apply
            for manager access or ask
            the approved manager for
            this storefront to add your
            verified account.
          </p>

          <Link
            className={
              styles.primaryLink
            }
            href={`/manager/apply?storefrontCode=${storefront.code}`}
          >
            Open manager portal
          </Link>
        </section>
      ) : error && !staff ? (
        <section
          className={styles.state}
          role="alert"
        >
          <h2>
            Staff queue
            unavailable
          </h2>

          <p>{error}</p>
        </section>
      ) : (
        <div
          className={
            styles.workspace
          }
        >
          <section
            className={
              styles.toolbar
            }
          >
            <div>
              <p>
                Staff role
              </p>

              <strong>
                {humanize(
                  staff?.role ??
                    "VIEWER",
                )}
              </strong>
            </div>

            <div
              className={
                styles.filters
              }
              aria-label="Order queue"
            >
              {queueOptions.map(
                (option) => (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    aria-pressed={
                      queue ===
                      option.value
                    }
                    onClick={() => {
                      setQueue(
                        option.value,
                      );
                    }}
                  >
                    {option.label}
                  </button>
                ),
              )}
            </div>
          </section>

          {error ? (
            <p
              className={
                styles.error
              }
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {orders.length === 0 ? (
            <section
              className={
                styles.state
              }
            >
              <h2>
                No orders in this
                queue
              </h2>

              <p>
                Orders remain
                isolated to{" "}
                {storefront.shortName}.
              </p>
            </section>
          ) : (
            <div
              className={
                styles.orders
              }
            >
              {orders.map(
                (order) => (
                  <article
                    className={
                      styles.order
                    }
                    key={
                      order.orderNumber
                    }
                  >
                    <div
                      className={
                        styles
                          .orderHeading
                      }
                    >
                      <div>
                        <p>
                          {
                            order.orderNumber
                          }
                        </p>

                        <h2>
                          {
                            order.customerName
                          }
                        </h2>

                        <span>
                          Placed{" "}
                          {dateTime(
                            order.placedAt,
                          )}
                        </span>
                      </div>

                      <div
                        className={
                          styles.statuses
                        }
                      >
                        <strong>
                          {humanize(
                            order.status,
                          )}
                        </strong>

                        <span>
                          {humanize(
                            order.fulfilmentStatus,
                          )}
                        </span>
                      </div>
                    </div>

                    <div
                      className={
                        styles
                          .orderGrid
                      }
                    >
                      <section>
                        <h3>
                          Customer
                        </h3>

                        <p>
                          {
                            order.customerEmail
                          }
                        </p>

                        <p>
                          {
                            order.customerPhone
                          }
                        </p>

                        <small>
                          {humanize(
                            order.fulfilmentMethod,
                          )}
                        </small>
                      </section>

                      <section>
                        <h3>
                          Products
                        </h3>

                        {order.items.map(
                          (item) => (
                            <p
                              key={
                                item.id
                              }
                            >
                              {item.quantity}
                              {` ${item.sellingUnitLabel} × `}
                              {
                                item.productName
                              }
                              {" · "}
                              {
                                item.variantTitle
                              }
                              {item.unitsPerSellingUnit > 1
                                ? ` · ${item.unitsPerSellingUnit} pieces per ${item.sellingUnitLabel}`
                                : ""}
                            </p>
                          ),
                        )}

                        <strong>
                          {money(
                            order.grandTotal,
                            order.currencyCode,
                          )}
                        </strong>
                      </section>

                      <section>
                        <h3>
                          Address
                        </h3>

                        {order.addresses
                          .length ===
                        0 ? (
                          <p>
                            Storefront
                            pickup
                          </p>
                        ) : (
                          order.addresses.map(
                            (
                              address,
                            ) => (
                              <div
                                key={
                                  address.id
                                }
                              >
                                <p>
                                  {
                                    address.recipientName
                                  }
                                </p>

                                <p>
                                  {
                                    address.addressLine1
                                  }
                                  {address.addressLine2
                                    ? `, ${address.addressLine2}`
                                    : ""}
                                </p>

                                <p>
                                  {
                                    address.city
                                  }
                                  {address.state
                                    ? `, ${address.state}`
                                    : ""}
                                </p>
                              </div>
                            ),
                          )
                        )}
                      </section>
                    </div>

                    {order.holdReason ===
                    "DELIVERY_PAYMENT_REQUIRED" ? (
                      <p
                        className={
                          styles.hold
                        }
                      >
                        Awaiting a
                        delivery quote
                        and verified
                        delivery-fee
                        payment. This
                        order cannot
                        enter
                        fulfilment yet.
                      </p>
                    ) : null}

                    {order.holdReason ===
                    "VIEW_ONLY" ? (
                      <p
                        className={
                          styles.hold
                        }
                      >
                        Viewer access
                        is read-only.
                      </p>
                    ) : null}

                    {order
                      .availableActions
                      .length > 0 ? (
                      <div
                        className={
                          styles.actions
                        }
                      >
                        {order
                          .availableActions
                          .map(
                            (
                              action,
                            ) => (
                              <button
                                key={
                                  action
                                }
                                type="button"
                                disabled={
                                  transitioning !==
                                  null
                                }
                                onClick={() => {
                                  void transitionOrder(
                                    order,
                                    action,
                                  );
                                }}
                              >
                                {transitioning ===
                                order.orderNumber
                                  ? "Updating…"
                                  : actionLabels[
                                      action
                                    ]}
                              </button>
                            ),
                          )}
                      </div>
                    ) : null}

                    {order.events
                      .length > 0 ? (
                      <details
                        className={
                          styles.history
                        }
                      >
                        <summary>
                          Fulfilment
                          history (
                          {
                            order
                              .events
                              .length
                          }
                          )
                        </summary>

                        {order.events.map(
                          (event) => (
                            <p
                              key={
                                event.id
                              }
                            >
                              {dateTime(
                                event.createdAt,
                              )}
                              {" · "}
                              {humanize(
                                event.action,
                              )}
                              {" · "}
                              {humanize(
                                event.actorRole,
                              )}
                            </p>
                          ),
                        )}
                      </details>
                    ) : null}
                  </article>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
