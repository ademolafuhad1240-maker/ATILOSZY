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
  CheckoutOrderView,
} from "@/server/checkout/types";

import styles from "./storefront-order.module.css";

interface OrderEnvelope {
  order?: CheckoutOrderView;
  error?: {
    code?: string;
    message?: string;
  };
}

async function readPayload(
  response: Response,
): Promise<OrderEnvelope> {
  try {
    return await response.json() as
      OrderEnvelope;
  } catch {
    return {};
  }
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

export default function StorefrontOrder({
  storefront,
  orderNumber,
}: {
  storefront:
    StorefrontCheckoutConfig;
  orderNumber: string;
}) {
  const [
    order,
    setOrder,
  ] = useState<
    CheckoutOrderView | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    cancelling,
    setCancelling,
  ] = useState(false);

  const [
    authRequired,
    setAuthRequired,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  useEffect(
    () => {
      let active = true;

      async function loadOrder() {
        setLoading(true);
        setError(null);
        setAuthRequired(false);

        try {
          const response =
            await fetch(
              `/api/orders/${encodeURIComponent(
                orderNumber,
              )}?storefrontCode=${encodeURIComponent(
                storefront.code,
              )}`,
              {
                method: "GET",
                credentials:
                  "same-origin",
                cache:
                  "no-store",
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
            !response.ok ||
            !payload.order
          ) {
            setError(
              payload.error
                ?.message ??
                "The order could not be loaded.",
            );

            return;
          }

          setOrder(
            payload.order,
          );
        } catch {
          if (active) {
            setError(
              "The order could not be loaded. Check your connection and try again.",
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadOrder();

      return () => {
        active = false;
      };
    },
    [
      orderNumber,
      storefront.code,
    ],
  );

  async function cancelOrder() {
    if (
      !order ||
      cancelling
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Cancel this unpaid order and release its reserved products?",
      );

    if (!confirmed) {
      return;
    }

    setCancelling(true);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/orders/${encodeURIComponent(
            order.orderNumber,
          )}/cancel`,
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
                reason:
                  "Cancelled by the customer from the order page.",
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
        setError(
          "Your session expired. Sign in again to manage this order.",
        );
        return;
      }

      if (
        !response.ok ||
        !payload.order
      ) {
        setError(
          payload.error
            ?.message ??
            "The order could not be cancelled.",
        );

        return;
      }

      setOrder(
        payload.order,
      );
    } catch {
      setError(
        "The order could not be cancelled. Check your connection and try again.",
      );
    } finally {
      setCancelling(false);
    }
  }

  const canCancel =
    order?.status ===
      "PENDING_PAYMENT" &&
    order.productPaymentStatus ===
      "PENDING";

  return (
    <main
      className={styles.page}
      data-order-page={
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
            Customer order
          </p>

          <h1>
            {order?.orderNumber ??
              orderNumber}
          </h1>

          <p>
            Private order details for{" "}
            <strong>
              {storefront.name}
            </strong>
            .
          </p>
        </div>

        <nav
          aria-label="Order navigation"
        >
          <Link
            href={
              storefront.shopHref
            }
          >
            Shop
          </Link>

          <Link
            href={
              storefront.cartHref
            }
          >
            Cart
          </Link>

          <Link
            href={
              storefront.accountHref
            }
          >
            Account
          </Link>
        </nav>
      </header>

      {loading ? (
        <section
          className={
            styles.state
          }
          aria-live="polite"
        >
          <h2>
            Loading order
          </h2>

          <p>
            Confirming your
            storefront session and
            order access.
          </p>
        </section>
      ) : authRequired ? (
        <section
          className={
            styles.state
          }
          role="alert"
        >
          <p
            className={
              styles.stateLabel
            }
          >
            Account required
          </p>

          <h2>
            Sign in to view this
            order
          </h2>

          <p>
            Orders are visible only
            through the verified
            account that created
            them.
          </p>

          <Link
            className={
              styles.primaryLink
            }
            href={
              storefront.loginHref
            }
          >
            Sign in
          </Link>
        </section>
      ) : !order ? (
        <section
          className={
            styles.state
          }
          role="alert"
        >
          <p
            className={
              styles.stateLabel
            }
          >
            Order unavailable
          </p>

          <h2>
            We could not open this
            order
          </h2>

          <p>
            {error ??
              "The order was not found for this storefront account."}
          </p>

          <Link
            className={
              styles.primaryLink
            }
            href={
              storefront.accountHref
            }
          >
            Return to account
          </Link>
        </section>
      ) : (
        <div
          className={
            styles.orderGrid
          }
        >
          <div
            className={
              styles.mainColumn
            }
          >
            <section
              className={
                styles.statusPanel
              }
            >
              <div>
                <p>
                  Order status
                </p>

                <strong
                  data-status={
                    order.status
                  }
                >
                  {humanize(
                    order.status,
                  )}
                </strong>
              </div>

              <div>
                <p>
                  Product payment
                </p>

                <strong>
                  {humanize(
                    order
                      .productPaymentStatus,
                  )}
                </strong>
              </div>

              <div>
                <p>
                  Fulfilment
                </p>

                <strong>
                  {humanize(
                    order
                      .fulfilmentMethod,
                  )}
                </strong>
              </div>

              <div>
                <p>
                  Placed
                </p>

                <strong>
                  {dateTime(
                    order.placedAt,
                  )}
                </strong>
              </div>
            </section>

            {order.status ===
              "PENDING_PAYMENT" ? (
              <section
                className={
                  styles.paymentNotice
                }
              >
                <p
                  className={
                    styles.stateLabel
                  }
                >
                  Payment not yet
                  connected
                </p>

                <h2>
                  No charge has been
                  made
                </h2>

                <p>
                  This order currently
                  reserves the listed
                  products. The secure
                  payment-provider
                  connection will be
                  introduced in the
                  next payment phase.
                </p>
              </section>
            ) : null}

            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.panelHeading
                }
              >
                <h2>
                  Products
                </h2>

                <span>
                  {order.items.reduce(
                    (
                      total,
                      item,
                    ) =>
                      total +
                      item.quantity,
                    0,
                  )}{" "}
                  items
                </span>
              </div>

              <div
                className={
                  styles.products
                }
              >
                {order.items.map(
                  (item) => (
                    <article
                      className={
                        styles.product
                      }
                      key={item.id}
                    >
                      <div>
                        <h3>
                          {
                            item.productName
                          }
                        </h3>

                        <p>
                          {
                            item.variantTitle
                          }
                        </p>

                        <small>
                          {item.sku} ·
                          Quantity{" "}
                          {item.quantity}
                        </small>
                      </div>

                      <div
                        className={
                          styles.productPrice
                        }
                      >
                        <span>
                          {money(
                            item.unitPrice,
                            order.currencyCode,
                          )}{" "}
                          each
                        </span>

                        <strong>
                          {money(
                            item.lineTotal,
                            order.currencyCode,
                          )}
                        </strong>
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>

            {order.addresses
              .length > 0 ? (
              <section
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.panelHeading
                  }
                >
                  <h2>
                    Addresses
                  </h2>
                </div>

                <div
                  className={
                    styles.addressGrid
                  }
                >
                  {order.addresses.map(
                    (address) => (
                      <article
                        className={
                          styles.address
                        }
                        key={
                          address.id
                        }
                      >
                        <p
                          className={
                            styles.stateLabel
                          }
                        >
                          {humanize(
                            address.type,
                          )}
                        </p>

                        <h3>
                          {
                            address.recipientName
                          }
                        </h3>

                        <p>
                          {
                            address.addressLine1
                          }
                          {address.addressLine2
                            ? `, ${address.addressLine2}`
                            : ""}
                        </p>

                        <p>
                          {address.city}
                          {address.state
                            ? `, ${address.state}`
                            : ""}
                          {address.postalCode
                            ? ` ${address.postalCode}`
                            : ""}
                        </p>

                        <p>
                          {
                            address.countryCode
                          }
                        </p>

                        <p>
                          {address.phone}
                        </p>

                        {address.email ? (
                          <p>
                            {
                              address.email
                            }
                          </p>
                        ) : null}

                        {address.deliveryNotes ? (
                          <small>
                            {
                              address.deliveryNotes
                            }
                          </small>
                        ) : null}
                      </article>
                    ),
                  )}
                </div>
              </section>
            ) : null}
          </div>

          <aside
            className={
              styles.summary
            }
          >
            <div
              className={
                styles.summaryHeading
              }
            >
              <p>
                Financial summary
              </p>

              <span>
                {
                  order.currencyCode
                }
              </span>
            </div>

            <div
              className={
                styles.totals
              }
            >
              <div>
                <span>
                  Product subtotal
                </span>

                <strong>
                  {money(
                    order.productSubtotal,
                    order.currencyCode,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Discount
                </span>

                <strong>
                  {money(
                    order.discountTotal,
                    order.currencyCode,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Product total
                </span>

                <strong>
                  {money(
                    order.productTotal,
                    order.currencyCode,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Delivery fee
                </span>

                <strong>
                  {money(
                    order.deliveryFeeTotal,
                    order.currencyCode,
                  )}
                </strong>
              </div>

              <div
                className={
                  styles.grandTotal
                }
              >
                <span>
                  Grand total
                </span>

                <strong>
                  {money(
                    order.grandTotal,
                    order.currencyCode,
                  )}
                </strong>
              </div>
            </div>

            <div
              className={
                styles.paymentRows
              }
            >
              <h2>
                Payment records
              </h2>

              {order.payments.map(
                (payment) => (
                  <article
                    key={
                      payment.id
                    }
                  >
                    <div>
                      <strong>
                        {humanize(
                          payment.purpose,
                        )}
                      </strong>

                      <span>
                        {humanize(
                          payment.status,
                        )}
                      </span>
                    </div>

                    <b>
                      {money(
                        payment.amount,
                        order.currencyCode,
                      )}
                    </b>
                  </article>
                ),
              )}
            </div>

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

            {canCancel ? (
              <button
                className={
                  styles.cancelButton
                }
                type="button"
                disabled={
                  cancelling
                }
                onClick={() => {
                  void cancelOrder();
                }}
              >
                {cancelling
                  ? "Cancelling…"
                  : "Cancel unpaid order"}
              </button>
            ) : null}

            {order
              .cancellationReason ? (
              <div
                className={
                  styles.cancelledNotice
                }
              >
                <strong>
                  Cancellation reason
                </strong>

                <p>
                  {
                    order.cancellationReason
                  }
                </p>

                <small>
                  {dateTime(
                    order.cancelledAt,
                  )}
                </small>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </main>
  );
}
