"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";
import type {
  PublicCartValidationResult,
  PublicCartView,
} from "../../server/cart/types";

import styles from "./storefront-cart.module.css";

interface ApiError {
  message?: string;
}

interface CartEnvelope {
  data?: {
    cart?: PublicCartView;
  };
  error?: ApiError;
}

interface ValidationEnvelope {
  data?: {
    validation?:
      PublicCartValidationResult;
  };
  error?: ApiError;
}

function errorMessage(
  payload:
    | CartEnvelope
    | ValidationEnvelope,
  fallback: string,
): string {
  return (
    payload.error?.message ??
    fallback
  );
}

async function readPayload<T>(
  response: Response,
): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

export function StorefrontCart({
  storefront,
  initialCart,
}: {
  storefront: StorefrontAuthConfig;
  initialCart: PublicCartView;
}) {
  const [
    cart,
    setCart,
  ] = useState(initialCart);

  const [
    quantities,
    setQuantities,
  ] = useState<
    Record<string, string>
  >({});

  const [
    pending,
    setPending,
  ] = useState<string | null>(
    null,
  );

  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    validation,
    setValidation,
  ] = useState<
    PublicCartValidationResult |
    null
  >(null);

  useEffect(() => {
    setQuantities(
      Object.fromEntries(
        cart.items.map(
          (item) => [
            item.id,
            String(item.quantity),
          ],
        ),
      ),
    );
  }, [cart]);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(
        "en-US",
        {
          style: "currency",
          currency:
            cart.currencyCode,
        },
      ),
    [
      cart.currencyCode,
    ],
  );

  function formatMoney(
    value: string,
  ): string {
    return formatter.format(
      Number(value),
    );
  }

  async function requestCart(
    path: string,
    init: RequestInit,
    action: string,
  ): Promise<void> {
    setPending(action);
    setError(null);
    setNotice(null);
    setValidation(null);

    try {
      const response = await fetch(
        path,
        {
          ...init,
          credentials:
            "same-origin",
          headers: {
            "Content-Type":
              "application/json",
            ...(init.headers ?? {}),
          },
        },
      );

      const payload =
        await readPayload<
          CartEnvelope
        >(response);

      if (
        !response.ok ||
        !payload.data?.cart
      ) {
        throw new Error(
          errorMessage(
            payload,
            "The cart could not be updated.",
          ),
        );
      }

      setCart(
        payload.data.cart,
      );

      setNotice(
        "Your cart has been updated.",
      );
    } catch (
      requestError
    ) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The cart could not be updated.",
      );
    } finally {
      setPending(null);
    }
  }

  async function updateQuantity(
    itemId: string,
  ): Promise<void> {
    const quantity =
      Number(
        quantities[itemId],
      );

    await requestCart(
      `/api/cart/items/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          storefrontCode:
            storefront.code,
          quantity,
        }),
      },
      `quantity:${itemId}`,
    );
  }

  async function removeItem(
    itemId: string,
  ): Promise<void> {
    await requestCart(
      `/api/cart/items/${encodeURIComponent(itemId)}`,
      {
        method: "DELETE",
        body: JSON.stringify({
          storefrontCode:
            storefront.code,
        }),
      },
      `remove:${itemId}`,
    );
  }

  async function clearCart(): Promise<void> {
    await requestCart(
      "/api/cart",
      {
        method: "DELETE",
        body: JSON.stringify({
          storefrontCode:
            storefront.code,
        }),
      },
      "clear",
    );
  }

  async function refreshCart(): Promise<void> {
    await requestCart(
      "/api/cart/refresh",
      {
        method: "POST",
        body: JSON.stringify({
          storefrontCode:
            storefront.code,
        }),
      },
      "refresh",
    );
  }

  async function validateCart(): Promise<void> {
    setPending("validate");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/cart/validate?storefrontCode=${encodeURIComponent(storefront.code)}`,
        {
          credentials:
            "same-origin",
        },
      );

      const payload =
        await readPayload<
          ValidationEnvelope
        >(response);

      if (
        !response.ok ||
        !payload.data
          ?.validation
      ) {
        throw new Error(
          errorMessage(
            payload,
            "The cart could not be validated.",
          ),
        );
      }

      setValidation(
        payload.data.validation,
      );

      setCart(
        payload.data.validation
          .cart,
      );

      setNotice(
        payload.data.validation
          .valid
          ? "Your cart is currently valid."
          : "Some cart items require attention.",
      );
    } catch (
      requestError
    ) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The cart could not be validated.",
      );
    } finally {
      setPending(null);
    }
  }

  const storefrontBaseHref =
    storefront.accountHref.replace(
      /\/account$/,
      "",
    );

  const cartHref =
    `${storefrontBaseHref}/cart`;

  const shopHref =
    `${storefrontBaseHref}/shop`;

  return (
    <main
      className={styles.page}
      data-cart-storefront={
        storefront.code
      }
      data-cart-route={cartHref}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>
              {storefront.shortName}
            </p>

            <h1 className={styles.title}>
              Your cart
            </h1>

            <p className={styles.description}>
              This cart belongs only to
              your {storefront.shortName}{" "}
              account. Products, prices,
              currency and sessions remain
              isolated from every other
              SORVYRA storefront.
            </p>
          </div>

          <nav
            className={
              styles.headerLinks
            }
            aria-label="Cart navigation"
          >
            <Link
              className={
                styles.linkButton
              }
              href={shopHref}
            >
              Continue shopping
            </Link>

            <Link
              className={
                styles.linkButton
              }
              href={
                storefront.accountHref
              }
            >
              My account
            </Link>
          </nav>
        </header>

        {error ? (
          <div
            className={
              styles.errorNotice
            }
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            className={
              styles.successNotice
            }
            role="status"
          >
            {notice}
          </div>
        ) : null}

        {validation &&
        !validation.valid ? (
          <ul
            className={
              styles.issueList
            }
          >
            {validation.issues.map(
              (issue) => (
                <li
                  key={
                    issue.cartItemId
                  }
                >
                  {issue.message}
                </li>
              ),
            )}
          </ul>
        ) : null}

        <div className={styles.layout}>
          {cart.items.length === 0 ? (
            <section
              className={styles.empty}
            >
              <h2
                className={
                  styles.emptyTitle
                }
              >
                Your cart is empty.
              </h2>

              <p
                className={
                  styles.emptyText
                }
              >
                Browse this storefront
                and choose the exact
                product variant you need.
              </p>

              <Link
                className={
                  styles.primaryButton
                }
                href={shopHref}
              >
                Browse products
              </Link>
            </section>
          ) : (
            <>
              <section
                className={
                  styles.items
                }
                aria-label="Cart items"
              >
                {cart.items.map(
                  (item) => (
                    <article
                      className={
                        styles.item
                      }
                      key={item.id}
                    >
                      <div>
                        <h2
                          className={
                            styles.itemName
                          }
                        >
                          {
                            item.productName
                          }
                        </h2>

                        <p
                          className={
                            styles.itemMeta
                          }
                        >
                          {
                            item.variantTitle
                          }
                          {" · "}
                          SKU {item.sku}
                        </p>

                        <p
                          className={
                            styles.itemPrice
                          }
                        >
                          {formatMoney(
                            item.unitPrice,
                          )}
                          {` per ${item.sellingUnitLabel} · `}
                          {formatMoney(
                            item.lineTotal,
                          )}
                          {" total"}
                        </p>

                        <p className={styles.itemMeta}>
                          {item.unitsPerSellingUnit > 1
                            ? `${item.unitsPerSellingUnit} pieces in each ${item.sellingUnitLabel}`
                            : `Sold by ${item.sellingUnitLabel}`}
                          {item.appliedMinimumQuantity !== null &&
                          Number(item.quantityDiscountPerUnit) > 0
                            ? ` · Bulk price applied from ${item.appliedMinimumQuantity}`
                            : ""}
                        </p>
                      </div>

                      <div
                        className={
                          styles.itemActions
                        }
                      >
                        <input
                          className={
                            styles.quantityInput
                          }
                          type="number"
                          min={1}
                          max={999}
                          inputMode="numeric"
                          aria-label={`Quantity in ${item.sellingUnitLabel} for ${item.productName}`}
                          value={
                            quantities[
                              item.id
                            ] ??
                            String(
                              item.quantity,
                            )
                          }
                          onChange={(
                            event,
                          ) => {
                            setQuantities(
                              (
                                current,
                              ) => ({
                                ...current,
                                [item.id]:
                                  event
                                    .target
                                    .value,
                              }),
                            );
                          }}
                        />

                        <button
                          className={
                            styles.secondaryButton
                          }
                          type="button"
                          disabled={
                            pending !== null
                          }
                          onClick={() =>
                            void updateQuantity(
                              item.id,
                            )
                          }
                        >
                          {pending ===
                          `quantity:${item.id}`
                            ? "Updating…"
                            : "Update"}
                        </button>

                        <button
                          className={
                            styles.dangerButton
                          }
                          type="button"
                          disabled={
                            pending !== null
                          }
                          onClick={() =>
                            void removeItem(
                              item.id,
                            )
                          }
                        >
                          {pending ===
                          `remove:${item.id}`
                            ? "Removing…"
                            : "Remove"}
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </section>

              <aside
                className={
                  styles.summary
                }
              >
                <h2
                  className={
                    styles.summaryTitle
                  }
                >
                  Order summary
                </h2>

                <div
                  className={
                    styles.summaryRow
                  }
                >
                  <span>Items</span>
                  <strong>
                    {cart.itemCount}
                  </strong>
                </div>

                {cart.compareAtSubtotal ? (
                  <div
                    className={
                      styles.summaryRow
                    }
                  >
                    <span>
                      Original value
                    </span>
                    <strong>
                      {formatMoney(
                        cart.compareAtSubtotal,
                      )}
                    </strong>
                  </div>
                ) : null}

                {Number(
                  cart.savings,
                ) > 0 ? (
                  <div
                    className={
                      styles.summaryRow
                    }
                  >
                    <span>Savings</span>
                    <strong>
                      {formatMoney(
                        cart.savings,
                      )}
                    </strong>
                  </div>
                ) : null}

                <div
                  className={
                    styles.summaryTotal
                  }
                >
                  <span>Subtotal</span>
                  <span>
                    {formatMoney(
                      cart.subtotal,
                    )}
                  </span>
                </div>

                <div
                  className={
                    styles.summaryActions
                  }
                >
                  <button
                    className={
                      styles.secondaryButton
                    }
                    type="button"
                    disabled={
                      pending !== null
                    }
                    onClick={() =>
                      void refreshCart()
                    }
                  >
                    {pending ===
                    "refresh"
                      ? "Refreshing…"
                      : "Refresh prices"}
                  </button>

                  <button
                    className={
                      styles.secondaryButton
                    }
                    type="button"
                    disabled={
                      pending !== null
                    }
                    onClick={() =>
                      void validateCart()
                    }
                  >
                    {pending ===
                    "validate"
                      ? "Checking…"
                      : "Check availability"}
                  </button>

                  <button
                    className={
                      styles.dangerButton
                    }
                    type="button"
                    disabled={
                      pending !== null
                    }
                    onClick={() =>
                      void clearCart()
                    }
                  >
                    {pending === "clear"
                      ? "Clearing…"
                      : "Clear cart"}
                  </button>

                  <Link
                    className={
                      styles.checkoutLink
                    }
                    href={
                      cartHref.replace(
                        /\/cart$/,
                        "/checkout",
                      )
                    }
                    data-checkout-link
                  >
                    Proceed to secure checkout
                  </Link>
                </div>

                <p
                  className={
                    styles.checkoutNote
                  }
                >
                  Products and prices are revalidated before an unpaid order is created.
                </p>
              </aside>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
