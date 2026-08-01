"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  useRouter,
} from "next/navigation";

import type {
  StorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";
import type {
  PublicCartView,
} from "@/server/cart/types";

import styles from "./storefront-checkout.module.css";

type FulfilmentMethod =
  | "PICKUP"
  | "DELIVERY"
  | "INSTALLATION"
  | "DELIVERY_AND_INSTALLATION";

interface ApiError {
  error?: {
    code?: string;
    message?: string;
  };
}

interface CartEnvelope
  extends ApiError {
  data?: {
    cart?: PublicCartView;
  };
}

interface CheckoutEnvelope
  extends ApiError {
  order?: {
    id?: string;
    orderNumber?: string;
  };
}

interface AddressState {
  recipientName: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  postalCode: string;
  addressLine1: string;
  addressLine2: string;
  deliveryNotes: string;
}

const emptyAddress:
  AddressState = {
    recipientName: "",
    phone: "",
    email: "",
    state: "",
    city: "",
    postalCode: "",
    addressLine1: "",
    addressLine2: "",
    deliveryNotes: "",
  };

async function readPayload<T>(
  response: Response,
): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

function apiMessage(
  payload: ApiError,
  fallback: string,
): string {
  return (
    payload.error?.message ??
    fallback
  );
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

export default function StorefrontCheckout({
  storefront,
}: {
  storefront:
    StorefrontCheckoutConfig;
}) {
  const router =
    useRouter();

  const [
    cart,
    setCart,
  ] = useState<
    PublicCartView | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
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

  const [
    fulfilmentMethod,
    setFulfilmentMethod,
  ] = useState<
    FulfilmentMethod
  >(
    storefront.pickupEnabled
      ? "PICKUP"
      : "DELIVERY",
  );

  const [
    address,
    setAddress,
  ] = useState<AddressState>(
    emptyAddress,
  );

  const [
    customerNote,
    setCustomerNote,
  ] = useState("");

  const needsAddress =
    fulfilmentMethod !==
    "PICKUP";

  useEffect(
    () => {
      let active = true;

      async function loadCart() {
        setLoading(true);
        setError(null);
        setAuthRequired(false);

        try {
          const response =
            await fetch(
              `/api/cart?storefrontCode=${encodeURIComponent(
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
            await readPayload<
              CartEnvelope
            >(response);

          if (
            !active
          ) {
            return;
          }

          if (
            response.status === 401
          ) {
            setAuthRequired(true);
            setCart(null);
            return;
          }

          if (
            !response.ok ||
            !payload.data?.cart
          ) {
            setError(
              apiMessage(
                payload,
                "Your cart could not be loaded.",
              ),
            );

            setCart(null);
            return;
          }

          setCart(
            payload.data.cart,
          );
        } catch {
          if (active) {
            setError(
              "Your cart could not be loaded. Check your connection and try again.",
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadCart();

      return () => {
        active = false;
      };
    },
    [
      storefront.code,
    ],
  );

  function updateAddress(
    field: keyof AddressState,
    value: string,
  ) {
    setAddress(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );
  }

  async function submitCheckout(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !cart ||
      cart.items.length === 0 ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const deliveryAddress =
        needsAddress
          ? {
              recipientName:
                address.recipientName,
              phone:
                address.phone,
              email:
                address.email ||
                null,
              countryCode:
                storefront
                  .countryCode,
              state:
                address.state ||
                null,
              city:
                address.city,
              postalCode:
                address.postalCode ||
                null,
              addressLine1:
                address.addressLine1,
              addressLine2:
                address.addressLine2 ||
                null,
              deliveryNotes:
                address.deliveryNotes ||
                null,
            }
          : null;

      const response =
        await fetch(
          "/api/checkout",
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
                cartId:
                  cart.id,
                fulfilmentMethod,
                deliveryAddress,
                customerNote:
                  customerNote ||
                  null,
              }),
          },
        );

      const payload =
        await readPayload<
          CheckoutEnvelope
        >(response);

      if (
        response.status === 401
      ) {
        setAuthRequired(true);
        setError(
          "Your session expired. Sign in again to continue.",
        );
        return;
      }

      if (
        !response.ok ||
        !payload.order
          ?.orderNumber
      ) {
        setError(
          apiMessage(
            payload,
            "The order could not be prepared.",
          ),
        );

        return;
      }

      router.push(
        `${
          storefront.ordersHref
        }/${encodeURIComponent(
          payload.order
            .orderNumber,
        )}?created=1`,
      );

      router.refresh();
    } catch {
      setError(
        "The order could not be prepared. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const options:
    Array<{
      value:
        FulfilmentMethod;
      label: string;
      description: string;
    }> = [];

  if (
    storefront.pickupEnabled
  ) {
    options.push({
      value: "PICKUP",
      label:
        "Store pickup",
      description:
        "Reserve the order for collection after product payment is completed.",
    });
  }

  if (
    storefront.deliveryEnabled
  ) {
    options.push({
      value: "DELIVERY",
      label:
        storefront.deliveryLabel,
      description:
        "The delivery fee will be quoted separately after product payment.",
    });
  }

  if (
    storefront
      .installationEnabled
  ) {
    options.push(
      {
        value:
          "INSTALLATION",
        label:
          "Professional installation",
        description:
          "Installation details will be coordinated after product payment.",
      },
      {
        value:
          "DELIVERY_AND_INSTALLATION",
        label:
          "Delivery and installation",
        description:
          "Delivery and installation will be coordinated as one fulfilment request.",
      },
    );
  }

  return (
    <main
      className={styles.page}
      data-checkout-page={
        storefront.code
      }
    >
      <section
        className={styles.hero}
      >
        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            Secure storefront
            checkout
          </p>

          <h1>
            Review and prepare
            your order
          </h1>

          <p
            className={
              styles.heroCopy
            }
          >
            Your cart belongs only
            to{" "}
            <strong>
              {storefront.name}
            </strong>
            . Products, currency,
            account data and orders
            remain isolated from
            every other SORVYRA
            storefront.
          </p>
        </div>

        <nav
          className={
            styles.heroLinks
          }
          aria-label="Checkout navigation"
        >
          <Link
            href={
              storefront.cartHref
            }
          >
            Back to cart
          </Link>

          <Link
            href={
              storefront.shopHref
            }
          >
            Continue shopping
          </Link>

          <Link
            href={
              storefront.accountHref
            }
          >
            My account
          </Link>
        </nav>
      </section>

      {loading ? (
        <section
          className={
            styles.stateCard
          }
          aria-live="polite"
        >
          <span
            className={
              styles.loader
            }
            aria-hidden="true"
          />

          <div>
            <h2>
              Loading your secure
              cart
            </h2>

            <p>
              Confirming current
              products, prices and
              storefront session.
            </p>
          </div>
        </section>
      ) : authRequired ? (
        <section
          className={
            styles.stateCard
          }
          role="alert"
        >
          <div>
            <p
              className={
                styles.stateLabel
              }
            >
              Account required
            </p>

            <h2>
              Sign in to continue
              checkout
            </h2>

            <p>
              Checkout requires the
              verified account linked
              to this storefront.
            </p>

            <Link
              className={
                styles.primaryLink
              }
              href={
                storefront.loginHref
              }
            >
              Sign in to{" "}
              {storefront.shortName}
            </Link>
          </div>
        </section>
      ) : !cart ? (
        <section
          className={
            styles.stateCard
          }
          role="alert"
        >
          <div>
            <h2>
              Cart unavailable
            </h2>

            <p>
              {error ??
                "Your storefront cart could not be loaded."}
            </p>

            <Link
              className={
                styles.primaryLink
              }
              href={
                storefront.cartHref
              }
            >
              Return to cart
            </Link>
          </div>
        </section>
      ) : cart.items.length ===
        0 ? (
        <section
          className={
            styles.stateCard
          }
        >
          <div>
            <p
              className={
                styles.stateLabel
              }
            >
              Cart empty
            </p>

            <h2>
              Add a product before
              checking out
            </h2>

            <p>
              Your checkout will
              appear here after you
              add an available
              product.
            </p>

            <Link
              className={
                styles.primaryLink
              }
              href={
                storefront.shopHref
              }
            >
              Browse products
            </Link>
          </div>
        </section>
      ) : (
        <form
          className={
            styles.checkoutGrid
          }
          onSubmit={
            submitCheckout
          }
        >
          <div
            className={
              styles.formColumn
            }
          >
            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.sectionHeading
                }
              >
                <span>01</span>

                <div>
                  <h2>
                    Fulfilment
                  </h2>

                  <p>
                    Choose how this
                    storefront should
                    complete the order.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles.methodGrid
                }
              >
                {options.map(
                  (option) => (
                    <label
                      className={
                        styles.method
                      }
                      data-selected={
                        fulfilmentMethod ===
                        option.value
                      }
                      key={
                        option.value
                      }
                    >
                      <input
                        type="radio"
                        name="fulfilmentMethod"
                        value={
                          option.value
                        }
                        checked={
                          fulfilmentMethod ===
                          option.value
                        }
                        onChange={() =>
                          setFulfilmentMethod(
                            option.value,
                          )
                        }
                      />

                      <span>
                        <strong>
                          {
                            option.label
                          }
                        </strong>

                        <small>
                          {
                            option.description
                          }
                        </small>
                      </span>
                    </label>
                  ),
                )}
              </div>
            </section>

            {needsAddress ? (
              <section
                className={
                  styles.panel
                }
              >
                <div
                  className={
                    styles.sectionHeading
                  }
                >
                  <span>02</span>

                  <div>
                    <h2>
                      Fulfilment
                      address
                    </h2>

                    <p>
                      This address must
                      be inside{" "}
                      {
                        storefront.countryName
                      }
                      .
                    </p>
                  </div>
                </div>

                <div
                  className={
                    styles.fieldGrid
                  }
                >
                  <label
                    className={
                      styles.fullField
                    }
                  >
                    Recipient name

                    <input
                      required
                      value={
                        address.recipientName
                      }
                      onChange={(
                        event,
                      ) =>
                        updateAddress(
                          "recipientName",
                          event.target
                            .value,
                        )
                      }
                      autoComplete="name"
                    />
                  </label>

                  <label>
                    Phone number

                    <input
                      required
                      value={
                        address.phone
                      }
                      onChange={(
                        event,
                      ) =>
                        updateAddress(
                          "phone",
                          event.target
                            .value,
                        )
                      }
                      autoComplete="tel"
                    />
                  </label>

                  <label>
                    Email address

                    <input
                      type="email"
                      value={
                        address.email
                      }
                      onChange={(
                        event,
                      ) =>
                        updateAddress(
                          "email",
                          event.target
                            .value,
                        )
                      }
                      autoComplete="email"
                    />
                  </label>

                  <label
                    className={
                      styles.fullField
                    }
                  >
                    Address line 1

                    <input
                      required
                      value={
                        address.addressLine1
                      }
                      onChange={(
                        event,
                      ) =>
                        updateAddress(
                          "addressLine1",
                          event.target
                            .value,
                        )
                      }
                      autoComplete="address-line1"
                    />
                  </label>

                  <label
                    className={
                      styles.fullField
                    }
                  >
                    Address line 2

                    <input
                      value={
                        address.addressLine2
                      }
                      onChange={(
                        event,
                      ) =>
                        updateAddress(
                          "addressLine2",
                          event.target
                            .value,
                        )
                      }
                      autoComplete="address-line2"
                    />
                  </label>

                  <label>
                    City

                    <input
                      required
                      value={
                        address.city
                      }
                      onChange={(
                        event,
                      ) =>
                        updateAddress(
                          "city",
                          event.target
                            .value,
                        )
                      }
                      autoComplete="address-level2"
                    />
                  </label>

                  <label>
                    State or region

                    <input
                      value={
                        address.state
                      }
                      onChange={(
                        event,
                      ) =>
                        updateAddress(
                          "state",
                          event.target
                            .value,
                        )
                      }
                      autoComplete="address-level1"
                    />
                  </label>

                  <label>
                    Postal code

                    <input
                      value={
                        address.postalCode
                      }
                      onChange={(
                        event,
                      ) =>
                        updateAddress(
                          "postalCode",
                          event.target
                            .value,
                        )
                      }
                      autoComplete="postal-code"
                    />
                  </label>

                  <label>
                    Country

                    <input
                      value={
                        storefront.countryName
                      }
                      readOnly
                      aria-readonly="true"
                    />
                  </label>

                  <label
                    className={
                      styles.fullField
                    }
                  >
                    Delivery or
                    installation notes

                    <textarea
                      rows={4}
                      value={
                        address.deliveryNotes
                      }
                      onChange={(
                        event,
                      ) =>
                        updateAddress(
                          "deliveryNotes",
                          event.target
                            .value,
                        )
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            <section
              className={
                styles.panel
              }
            >
              <div
                className={
                  styles.sectionHeading
                }
              >
                <span>
                  {needsAddress
                    ? "03"
                    : "02"}
                </span>

                <div>
                  <h2>
                    Order note
                  </h2>

                  <p>
                    Add optional
                    information for
                    the storefront
                    team.
                  </p>
                </div>
              </div>

              <label
                className={
                  styles.fullField
                }
              >
                Customer note

                <textarea
                  rows={5}
                  maxLength={1000}
                  value={
                    customerNote
                  }
                  onChange={(
                    event,
                  ) =>
                    setCustomerNote(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Optional order instructions"
                />
              </label>
            </section>
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
                Order summary
              </p>

              <span>
                {cart.itemCount}{" "}
                {cart.itemCount === 1
                  ? "item"
                  : "items"}
              </span>
            </div>

            <div
              className={
                styles.items
              }
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
                      <strong>
                        {
                          item.productName
                        }
                      </strong>

                      <span>
                        {
                          item.variantTitle
                        }
                      </span>

                      <small>
                        {item.sku} · {item.quantity} {item.sellingUnitLabel}
                        {item.unitsPerSellingUnit > 1
                          ? ` (${item.unitsPerSellingUnit} pieces each)`
                          : ""}
                      </small>

                      {item.appliedMinimumQuantity !== null &&
                      Number(item.quantityDiscountPerUnit) > 0 ? (
                        <small>
                          Quantity discount applied from {item.appliedMinimumQuantity}
                        </small>
                      ) : null}
                    </div>

                    <b>
                      {money(
                        item.lineTotal,
                        cart.currencyCode,
                      )}
                    </b>
                  </article>
                ),
              )}
            </div>

            <div
              className={
                styles.totals
              }
            >
              <div>
                <span>
                  Products
                </span>

                <strong>
                  {money(
                    cart.subtotal,
                    cart.currencyCode,
                  )}
                </strong>
              </div>

              {Number(cart.savings) > 0 ? (
                <div>
                  <span>Savings</span>
                  <strong>
                    {money(cart.savings, cart.currencyCode)}
                  </strong>
                </div>
              ) : null}

              <div>
                <span>
                  Delivery fee
                </span>

                <strong>
                  {fulfilmentMethod ===
                  "PICKUP"
                    ? money(
                        "0.00",
                        cart.currencyCode,
                      )
                    : "Quoted later"}
                </strong>
              </div>

              <div
                className={
                  styles.grandTotal
                }
              >
                <span>
                  Product total
                </span>

                <strong>
                  {money(
                    cart.subtotal,
                    cart.currencyCode,
                  )}
                </strong>
              </div>
            </div>

            <div
              className={
                styles.paymentNotice
              }
            >
              <strong>
                No payment will be
                taken yet
              </strong>

              <p>
                This step creates an
                unpaid order and
                reserves available
                inventory. The secure
                product-payment
                connection will be
                added in the next
                payment phase.
              </p>

              {fulfilmentMethod !==
              "PICKUP" ? (
                <p>
                  The delivery fee is
                  calculated and
                  quoted separately
                  after product
                  payment.
                </p>
              ) : null}
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

            <button
              className={
                styles.submit
              }
              type="submit"
              disabled={
                submitting
              }
            >
              {submitting
                ? "Preparing order…"
                : "Prepare unpaid order"}
            </button>

            <p
              className={
                styles.submitNote
              }
            >
              Products and prices are
              checked again before the
              order is created.
            </p>
          </aside>
        </form>
      )}
    </main>
  );
}
