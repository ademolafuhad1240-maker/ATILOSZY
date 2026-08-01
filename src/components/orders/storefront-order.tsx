"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
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

type CustomerPaymentMethod =
  | "CARD"
  | "BANK_TRANSFER"
  | "USSD"
  | "PAY_BY_BANK";

interface PaymentEnvelope {
  ok?: boolean;
  payment?: {
    paymentStatus?: string;
    orderStatus?: string;
    productPaymentStatus?:
      string;
  };
  nextAction?:
    | {
        type: "REDIRECT";
        url: string;
        expiresAt?:
          | string
          | null;
      }
    | {
        type: "PENDING";
        message: string;
      };
  reconciliation?: {
    disposition?: string;
    checkedAt?:
      | string
      | null;
    retryAfterSeconds?:
      number;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

const paymentMethods:
  Array<{
    value:
      CustomerPaymentMethod;
    label: string;
    description: string;
  }> = [
    {
      value: "CARD",
      label: "Card",
      description:
        "Complete payment on the provider's secure card page.",
    },
    {
      value:
        "BANK_TRANSFER",
      label: "Bank transfer",
      description:
        "Receive provider-controlled transfer instructions.",
    },
    {
      value: "USSD",
      label: "USSD",
      description:
        "Use an available provider USSD flow.",
    },
    {
      value: "PAY_BY_BANK",
      label: "Pay by bank",
      description:
        "Continue through a supported bank authorization flow.",
    },
  ];

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

async function readPaymentPayload(
  response: Response,
): Promise<PaymentEnvelope> {
  try {
    return await response.json() as
      PaymentEnvelope;
  } catch {
    return {};
  }
}

async function requestOrder(
  storefrontCode: string,
  orderNumber: string,
) {
  const response =
    await fetch(
      `/api/orders/${encodeURIComponent(
        orderNumber,
      )}?storefrontCode=${encodeURIComponent(
        storefrontCode,
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

  return {
    response,
    payload:
      await readPayload(
        response,
      ),
  };
}

function newPaymentRequestToken(): string {
  const bytes =
    new Uint8Array(24);

  window.crypto
    .getRandomValues(bytes);

  return Array.from(
    bytes,
    (value) =>
      value
        .toString(16)
        .padStart(2, "0"),
  ).join("");
}

function paymentRequestTokenKey(
  storefrontCode: string,
  orderNumber: string,
  method:
    CustomerPaymentMethod,
): string {
  return [
    "sorvyra",
    "payment-attempt",
    storefrontCode,
    orderNumber,
    method,
  ].join(":");
}

function paymentRequestToken(
  storefrontCode: string,
  orderNumber: string,
  method:
    CustomerPaymentMethod,
): string {
  const key =
    paymentRequestTokenKey(
      storefrontCode,
      orderNumber,
      method,
    );

  try {
    const existing =
      window.sessionStorage
        .getItem(key);

    if (
      existing &&
      /^[a-f0-9]{48}$/u.test(
        existing,
      )
    ) {
      return existing;
    }

    const created =
      newPaymentRequestToken();

    window.sessionStorage
      .setItem(
        key,
        created,
      );

    return created;
  } catch {
    return newPaymentRequestToken();
  }
}

function clearPaymentRequestTokens(
  storefrontCode: string,
  orderNumber: string,
): void {
  try {
    for (
      const method of paymentMethods
    ) {
      window.sessionStorage
        .removeItem(
          paymentRequestTokenKey(
            storefrontCode,
            orderNumber,
            method.value,
          ),
        );
    }
  } catch {
    // Storage can be unavailable without blocking payment state handling.
  }
}

function safeRedirectUrl(
  value: string,
): string | null {
  try {
    const parsed =
      new URL(value);

    if (
      parsed.protocol ===
        "https:" ||
      (
        parsed.protocol ===
          "http:" &&
        [
          "localhost",
          "127.0.0.1",
          "[::1]",
        ].includes(
          parsed.hostname,
        )
      )
    ) {
      return parsed.toString();
    }
  } catch {
    // The server response did not contain a usable redirect.
  }

  return null;
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
    initiatingPayment,
    setInitiatingPayment,
  ] = useState(false);

  const [
    reconcilingPayment,
    setReconcilingPayment,
  ] = useState(false);

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<
    CustomerPaymentMethod
  >("CARD");

  const [
    paymentMessage,
    setPaymentMessage,
  ] = useState<string | null>(
    null,
  );

  const paymentAttemptInFlight =
    useRef(false);

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
          const {
            response,
            payload,
          } =
            await requestOrder(
              storefront.code,
              orderNumber,
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

          if (
            [
              "PAID",
              "FAILED",
              "CANCELLED",
            ].includes(
              payload.order
                .productPaymentStatus,
            )
          ) {
            clearPaymentRequestTokens(
              storefront.code,
              orderNumber,
            );
          }
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

  async function refreshOrder(): Promise<
    CheckoutOrderView | null
  > {
    try {
      const {
        response,
        payload,
      } =
        await requestOrder(
          storefront.code,
          orderNumber,
        );

      if (
        response.status === 401
      ) {
        setAuthRequired(true);
        setError(
          "Your session expired. Sign in again to manage this order.",
        );
        return null;
      }

      if (
        !response.ok ||
        !payload.order
      ) {
        setError(
          payload.error
            ?.message ??
            "The order could not be refreshed.",
        );
        return null;
      }

      setOrder(payload.order);

      if (
        [
          "PAID",
          "FAILED",
          "CANCELLED",
        ].includes(
          payload.order
            .productPaymentStatus,
        )
      ) {
        clearPaymentRequestTokens(
          storefront.code,
          orderNumber,
        );
      }

      return payload.order;
    } catch {
      setError(
        "The order could not be refreshed. Check your connection and try again.",
      );
      return null;
    }
  }

  async function beginPayment() {
    if (
      !order ||
      initiatingPayment ||
      reconcilingPayment ||
      paymentAttemptInFlight
        .current
    ) {
      return;
    }

    paymentAttemptInFlight.current =
      true;
    setInitiatingPayment(true);
    setError(null);
    setPaymentMessage(null);

    try {
      const response =
        await fetch(
          `/api/orders/${encodeURIComponent(
            order.orderNumber,
          )}/payment/initiate`,
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
                method:
                  paymentMethod,
                requestToken:
                  paymentRequestToken(
                    storefront.code,
                    order.orderNumber,
                    paymentMethod,
                  ),
              }),
          },
        );

      const payload =
        await readPaymentPayload(
          response,
        );

      if (
        response.status === 401
      ) {
        setAuthRequired(true);
        setError(
          "Your session expired. Sign in again before starting payment.",
        );
        return;
      }

      if (
        !response.ok ||
        !payload.payment ||
        !payload.nextAction
      ) {
        setError(
          payload.error
            ?.message ??
            "The secure payment could not be started.",
        );
        return;
      }

      if (
        payload.nextAction
          .type ===
        "REDIRECT"
      ) {
        const redirectUrl =
          safeRedirectUrl(
            payload
              .nextAction.url,
          );

        if (!redirectUrl) {
          setError(
            "The payment provider returned an unsafe redirect.",
          );
          return;
        }

        setPaymentMessage(
          "Opening the secure payment provider. Returning to this page does not by itself confirm payment.",
        );

        window.location.assign(
          redirectUrl,
        );
        return;
      }

      setPaymentMessage(
        payload.nextAction
          .message,
      );

      await refreshOrder();
    } catch {
      setError(
        "The secure payment could not be started. Check your connection and try again.",
      );
    } finally {
      paymentAttemptInFlight.current =
        false;
      setInitiatingPayment(
        false,
      );
    }
  }

  async function reconcilePayment() {
    if (
      !order ||
      reconcilingPayment ||
      initiatingPayment
    ) {
      return;
    }

    setReconcilingPayment(true);
    setError(null);
    setPaymentMessage(null);

    try {
      const response =
        await fetch(
          `/api/orders/${encodeURIComponent(
            order.orderNumber,
          )}/payment/reconcile`,
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
              }),
          },
        );

      const payload =
        await readPaymentPayload(
          response,
        );

      if (
        response.status === 401
      ) {
        setAuthRequired(true);
        setError(
          "Your session expired. Sign in again to verify this payment.",
        );
        return;
      }

      if (
        response.status === 429
      ) {
        const retryAfter =
          payload
            .reconciliation
            ?.retryAfterSeconds ??
          Number(
            response.headers.get(
              "Retry-After",
            ) ?? "0",
          );

        setError(
          retryAfter > 0
            ? `Payment verification was checked recently. Try again in ${retryAfter} seconds.`
            : "Payment verification was checked recently. Try again shortly.",
        );
        return;
      }

      if (
        !response.ok ||
        !payload.payment
      ) {
        setError(
          payload.error
            ?.message ??
            "The payment status could not be verified.",
        );
        return;
      }

      const refreshed =
        await refreshOrder();

      const disposition =
        payload
          .reconciliation
          ?.disposition;

      if (
        disposition === "PAID" ||
        refreshed
          ?.productPaymentStatus ===
          "PAID"
      ) {
        setPaymentMessage(
          "Payment verified successfully.",
        );
      } else if (
        disposition ===
          "FAILED" ||
        refreshed
          ?.productPaymentStatus ===
          "FAILED"
      ) {
        clearPaymentRequestTokens(
          storefront.code,
          order.orderNumber,
        );

        setPaymentMessage(
          "The provider reported that this payment was not completed. You can safely try again or cancel the order.",
        );
      } else {
        setPaymentMessage(
          "The provider has not confirmed payment yet. No paid status has been applied.",
        );
      }
    } catch {
      setError(
        "The payment status could not be verified. Check your connection and try again.",
      );
    } finally {
      setReconcilingPayment(
        false,
      );
    }
  }

  async function cancelOrder() {
    if (
      !order ||
      cancelling ||
      initiatingPayment ||
      reconcilingPayment ||
      paymentAttemptInFlight
        .current
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

      clearPaymentRequestTokens(
        storefront.code,
        order.orderNumber,
      );
    } catch {
      setError(
        "The order could not be cancelled. Check your connection and try again.",
      );
    } finally {
      setCancelling(false);
    }
  }

  const canStartPayment =
    order?.status ===
      "PENDING_PAYMENT" &&
    [
      "PENDING",
      "FAILED",
    ].includes(
      order
        .productPaymentStatus,
    );

  const canReconcile =
    order?.status ===
      "PAYMENT_PROCESSING" ||
    order
      ?.productPaymentStatus ===
      "PROCESSING";

  const canCancel =
    canStartPayment;

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

            {canStartPayment ? (
              <section
                className={
                  styles.paymentNotice
                }
                data-payment-actions
              >
                <p
                  className={
                    styles.stateLabel
                  }
                >
                  Secure product
                  payment
                </p>

                <h2>
                  Pay{" "}
                  {money(
                    order.productTotal,
                    order.currencyCode,
                  )}
                </h2>

                <p>
                  The server controls
                  the provider,
                  amount, currency and
                  payment reference.
                  You will continue on
                  the configured
                  provider&apos;s
                  secure page.
                </p>

                {order
                  .productPaymentStatus ===
                "FAILED" ? (
                  <p
                    className={
                      styles
                        .paymentWarning
                    }
                  >
                    The previous
                    payment was not
                    completed. No paid
                    status was applied.
                    You may retry or
                    cancel this order.
                  </p>
                ) : null}

                <div
                  className={
                    styles
                      .paymentControls
                  }
                >
                  <label>
                    <span>
                      Payment method
                    </span>

                    <select
                      value={
                        paymentMethod
                      }
                      disabled={
                        initiatingPayment ||
                        reconcilingPayment
                      }
                      onChange={(
                        event,
                      ) => {
                        setPaymentMethod(
                          event.target
                            .value as
                            CustomerPaymentMethod,
                        );
                      }}
                    >
                      {paymentMethods.map(
                        (method) => (
                          <option
                            key={
                              method.value
                            }
                            value={
                              method.value
                            }
                          >
                            {
                              method.label
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <p>
                    {
                      paymentMethods.find(
                        (method) =>
                          method.value ===
                          paymentMethod,
                      )
                        ?.description
                    }
                  </p>

                  <button
                    className={
                      styles
                        .paymentButton
                    }
                    type="button"
                    disabled={
                      initiatingPayment ||
                      reconcilingPayment
                    }
                    onClick={() => {
                      void beginPayment();
                    }}
                  >
                    {initiatingPayment
                      ? "Opening secure payment…"
                      : "Continue to secure payment"}
                  </button>
                </div>
              </section>
            ) : null}

            {canReconcile ? (
              <section
                className={
                  styles.paymentNotice
                }
                data-payment-reconciliation
              >
                <p
                  className={
                    styles.stateLabel
                  }
                >
                  Payment verification
                </p>

                <h2>
                  Waiting for provider
                  confirmation
                </h2>

                <p>
                  Returning from a
                  payment page is not
                  proof of payment.
                  This check asks the
                  server to verify the
                  stored provider
                  reference and exact
                  order amount.
                </p>

                <button
                  className={
                    styles
                      .paymentButton
                  }
                  type="button"
                  disabled={
                    reconcilingPayment ||
                    initiatingPayment
                  }
                  onClick={() => {
                    void reconcilePayment();
                  }}
                >
                  {reconcilingPayment
                    ? "Verifying payment…"
                    : "Check payment status"}
                </button>
              </section>
            ) : null}

            {order
              .productPaymentStatus ===
            "PAID" ? (
              <section
                className={
                  styles
                    .paymentSuccess
                }
              >
                <p
                  className={
                    styles.stateLabel
                  }
                >
                  Payment confirmed
                </p>

                <h2>
                  Product payment
                  received
                </h2>

                <p>
                  This order was
                  marked paid only
                  after server-side
                  provider
                  verification.
                </p>
              </section>
            ) : null}

            {paymentMessage ? (
              <p
                className={
                  styles
                    .paymentMessage
                }
                role="status"
              >
                {paymentMessage}
              </p>
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
                          {" "}{item.quantity} {item.sellingUnitLabel}
                          {item.unitsPerSellingUnit > 1
                            ? ` (${item.unitsPerSellingUnit} pieces each)`
                            : ""}
                        </small>

                        {item.quantityDiscountMinimum !== null ? (
                          <small>
                            Quantity discount applied from {item.quantityDiscountMinimum}
                          </small>
                        ) : null}
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
                          per {item.sellingUnitLabel}
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
                  cancelling ||
                  initiatingPayment ||
                  reconcilingPayment
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
