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
import type {
  ManagerCatalogProduct,
  ManagerCatalogView,
} from "@/server/catalog/types";

import GovernanceShell from "../governance/governance-shell";
import styles from "./catalogue-manager.module.css";

interface ApiPayload {
  ok?: boolean;
  data?: ManagerCatalogView;
  error?: {
    message?: string;
  };
}

function stringValue(
  data: FormData,
  name: string,
): string {
  return String(
    data.get(name) ?? "",
  ).trim();
}

function integerValue(
  data: FormData,
  name: string,
  fallback = 0,
): number {
  const raw = stringValue(
    data,
    name,
  );

  return raw === ""
    ? fallback
    : Number.parseInt(raw, 10);
}

function optionalIntegerValue(
  data: FormData,
  name: string,
): number | null {
  const raw = stringValue(
    data,
    name,
  );

  return raw === ""
    ? null
    : Number.parseInt(raw, 10);
}

function productPayload(
  data: FormData,
  storefrontCode:
    StorefrontAuthCode,
) {
  return {
    storefrontCode,
    categorySlug: stringValue(
      data,
      "categorySlug",
    ),
    name: stringValue(
      data,
      "name",
    ),
    shortDescription:
      stringValue(
        data,
        "shortDescription",
      ),
    description: stringValue(
      data,
      "description",
    ),
    brand: stringValue(
      data,
      "brand",
    ),
    listingStatus: stringValue(
      data,
      "listingStatus",
    ),
    isFeatured:
      data.get("isFeatured") ===
      "on",
    maxPerOrder:
      optionalIntegerValue(
        data,
        "maxPerOrder",
      ),
    imageUrl: stringValue(
      data,
      "imageUrl",
    ),
    imageAltText:
      stringValue(
        data,
        "imageAltText",
      ),
    variantTitle: stringValue(
      data,
      "variantTitle",
    ),
    priceAmount: stringValue(
      data,
      "priceAmount",
    ),
    compareAtAmount:
      stringValue(
        data,
        "compareAtAmount",
      ),
    costAmount: stringValue(
      data,
      "costAmount",
    ),
    reorderLevel:
      integerValue(
        data,
        "reorderLevel",
      ),
    isTracked:
      data.get("isTracked") ===
      "on",
    allowBackorder:
      data.get(
        "allowBackorder",
      ) === "on",
  };
}

function formatMoney(
  amount: string,
  currency: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency,
    },
  ).format(Number(amount));
}

function readable(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(/_/gu, " ")
    .replace(
      /^\w/u,
      (letter) =>
        letter.toUpperCase(),
    );
}

function ProductFields({
  catalog,
  product,
}: {
  catalog: ManagerCatalogView;
  product?:
    ManagerCatalogProduct;
}) {
  return (
    <div
      className={styles.formGrid}
    >
      <label className={styles.field}>
        <span>Product name</span>
        <input
          name="name"
          defaultValue={
            product?.name ?? ""
          }
          maxLength={240}
          required
        />
      </label>

      <label className={styles.field}>
        <span>Category</span>
        <select
          name="categorySlug"
          defaultValue={
            product?.categorySlug ??
            catalog.categories[0]
              ?.slug
          }
          required
        >
          {catalog.categories.map(
            (category) => (
              <option
                key={category.id}
                value={category.slug}
              >
                {category.name}
              </option>
            ),
          )}
        </select>
      </label>

      <label className={styles.field}>
        <span>Brand</span>
        <input
          name="brand"
          defaultValue={
            product?.brand ?? ""
          }
          maxLength={160}
        />
      </label>

      <label className={styles.field}>
        <span>
          Storefront visibility
        </span>
        <select
          name="listingStatus"
          defaultValue={
            product?.listingStatus ??
            "DRAFT"
          }
        >
          <option value="DRAFT">
            Draft — managers only
          </option>
          <option value="ACTIVE">
            Active — visible in shop
          </option>
          <option value="HIDDEN">
            Hidden — not in shop
          </option>
          {product ? (
            <option value="ARCHIVED">
              Archived
            </option>
          ) : null}
        </select>
      </label>

      <label
        className={
          styles.wideField
        }
      >
        <span>Short description</span>
        <input
          name="shortDescription"
          defaultValue={
            product
              ?.shortDescription ?? ""
          }
          maxLength={500}
        />
      </label>

      <label
        className={
          styles.wideField
        }
      >
        <span>Full description</span>
        <textarea
          name="description"
          defaultValue={
            product?.description ?? ""
          }
          maxLength={10_000}
          rows={4}
        />
      </label>

      <label className={styles.field}>
        <span>Variant name</span>
        <input
          name="variantTitle"
          defaultValue={
            product?.variant.title ??
            "Default"
          }
          maxLength={240}
          required
        />
      </label>

      <label className={styles.field}>
        <span>
          Selling price (
          {
            catalog.storefront
              .currencyCode
          }
          )
        </span>
        <input
          name="priceAmount"
          defaultValue={
            product?.variant.price
              .amount ?? ""
          }
          inputMode="decimal"
          placeholder="1000.00"
          required
        />
      </label>

      <label className={styles.field}>
        <span>
          Compare-at price
        </span>
        <input
          name="compareAtAmount"
          defaultValue={
            product?.variant.price
              .compareAtAmount ?? ""
          }
          inputMode="decimal"
          placeholder="Optional"
        />
      </label>

      <label className={styles.field}>
        <span>
          Internal cost price
        </span>
        <input
          name="costAmount"
          defaultValue={
            product?.variant.price
              .costAmount ?? ""
          }
          inputMode="decimal"
          placeholder="Optional"
        />
      </label>

      <label className={styles.field}>
        <span>Reorder alert level</span>
        <input
          name="reorderLevel"
          type="number"
          min={0}
          step={1}
          defaultValue={
            product?.variant
              .inventory
              .reorderLevel ?? 0
          }
          required
        />
      </label>

      <label className={styles.field}>
        <span>
          Maximum per order
        </span>
        <input
          name="maxPerOrder"
          type="number"
          min={1}
          step={1}
          defaultValue={
            product?.maxPerOrder ??
            ""
          }
          placeholder="No limit"
        />
      </label>

      <label
        className={
          styles.wideField
        }
      >
        <span>Product image</span>
        <input
          name="imageUrl"
          defaultValue={
            product?.image?.url ?? ""
          }
          maxLength={2048}
          placeholder="https://… or /brand/image.png"
        />
        <small>
          Use an HTTPS image URL or a
          safe image path already in
          this app.
        </small>
      </label>

      <label
        className={
          styles.wideField
        }
      >
        <span>Image description</span>
        <input
          name="imageAltText"
          defaultValue={
            product?.image?.altText ??
            ""
          }
          maxLength={300}
          placeholder="Describe the product for accessibility"
        />
      </label>

      <label
        className={styles.check}
      >
        <input
          name="isFeatured"
          type="checkbox"
          defaultChecked={
            product?.isFeatured ??
            false
          }
        />
        Featured product
      </label>

      <label
        className={styles.check}
      >
        <input
          name="isTracked"
          type="checkbox"
          defaultChecked={
            product?.variant
              .inventory.isTracked ??
            true
          }
        />
        Track inventory
      </label>

      <label
        className={styles.check}
      >
        <input
          name="allowBackorder"
          type="checkbox"
          defaultChecked={
            product?.variant
              .inventory
              .allowBackorder ??
            false
          }
        />
        Allow orders when out of
        stock
      </label>
    </div>
  );
}

export default function CatalogueManager({
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
    catalog,
    setCatalog,
  ] =
    useState<ManagerCatalogView | null>(
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
    busyKey,
    setBusyKey,
  ] = useState<string | null>(
    null,
  );
  const [
    notice,
    setNotice,
  ] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);

  const loadCatalog =
    useCallback(async () => {
      setLoading(true);
      setSessionMissing(false);

      try {
        const response = await fetch(
          `/api/catalog/management?storefrontCode=${encodeURIComponent(storefrontCode)}`,
          {
            cache: "no-store",
            credentials:
              "same-origin",
          },
        );
        const payload =
          await response
            .json()
            .catch(
              () => ({}),
            ) as ApiPayload;

        if (response.status === 401) {
          setSessionMissing(true);
          setCatalog(null);
          return;
        }

        if (
          !response.ok ||
          !payload.data
        ) {
          throw new Error(
            payload.error?.message ??
              "The catalogue could not be loaded.",
          );
        }

        setCatalog(payload.data);
      } catch (error) {
        setCatalog(null);
        setNotice({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "The catalogue could not be loaded.",
        });
      } finally {
        setLoading(false);
      }
    }, [storefrontCode]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  function changeStorefront(
    value: StorefrontAuthCode,
  ) {
    setStorefrontCode(value);
    setNotice(null);
    router.replace(
      `/manager/catalogue?storefrontCode=${value}`,
    );
  }

  async function signOut() {
    setBusyKey("sign-out");
    setNotice(null);

    try {
      const response = await fetch(
        "/api/auth/logout",
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

      if (!response.ok) {
        const payload =
          await response
            .json()
            .catch(
              () => ({}),
            ) as ApiPayload;

        throw new Error(
          payload.error?.message ??
            "Sign out could not be completed.",
        );
      }

      setCatalog(null);
      router.replace(
        `/manager/login?storefrontCode=${storefrontCode}&destination=catalogue`,
      );
      router.refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Sign out could not be completed.",
      });
      setBusyKey(null);
    }
  }

  async function request(
    url: string,
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
  ) {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type":
          "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const payload =
      await response
        .json()
        .catch(
          () => ({}),
        ) as ApiPayload;

    if (!response.ok) {
      throw new Error(
        payload.error?.message ??
          "The catalogue change could not be saved.",
      );
    }
  }

  async function createProduct(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form =
      event.currentTarget;
    const data = new FormData(form);
    setBusyKey("create");
    setNotice(null);

    try {
      await request(
        "/api/catalog/management/products",
        "POST",
        {
          ...productPayload(
            data,
            storefrontCode,
          ),
          listingSlug:
            stringValue(
              data,
              "listingSlug",
            ),
          sku: stringValue(
            data,
            "sku",
          ),
          initialStock:
            integerValue(
              data,
              "initialStock",
            ),
        },
      );
      form.reset();
      setNotice({
        kind: "success",
        message:
          "The product was created with server-controlled pricing and inventory.",
      });
      await loadCatalog();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The product could not be created.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function updateProduct(
    event:
      FormEvent<HTMLFormElement>,
    productId: string,
  ) {
    event.preventDefault();
    setBusyKey(
      `update:${productId}`,
    );
    setNotice(null);

    try {
      await request(
        `/api/catalog/management/products/${encodeURIComponent(productId)}`,
        "PATCH",
        productPayload(
          new FormData(
            event.currentTarget,
          ),
          storefrontCode,
        ),
      );
      setNotice({
        kind: "success",
        message:
          "The catalogue product was updated.",
      });
      await loadCatalog();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The product could not be updated.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function adjustStock(
    event:
      FormEvent<HTMLFormElement>,
    productId: string,
  ) {
    event.preventDefault();
    const form =
      event.currentTarget;
    const data = new FormData(form);
    setBusyKey(
      `stock:${productId}`,
    );
    setNotice(null);

    try {
      await request(
        `/api/catalog/management/products/${encodeURIComponent(productId)}/stock`,
        "POST",
        {
          storefrontCode,
          quantityDelta:
            integerValue(
              data,
              "quantityDelta",
            ),
          type: stringValue(
            data,
            "type",
          ),
          reason: stringValue(
            data,
            "reason",
          ),
        },
      );
      form.reset();
      setNotice({
        kind: "success",
        message:
          "Stock was updated and the movement was recorded.",
      });
      await loadCatalog();
    } catch (error) {
      setNotice({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Stock could not be updated.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  const selectedStorefront =
    storefronts.find(
      (storefront) =>
        storefront.code ===
        storefrontCode,
    ) ?? storefronts[0]!;
  const activeCount =
    catalog?.products.filter(
      (product) =>
        product.listingStatus ===
        "ACTIVE",
    ).length ?? 0;
  const lowStockCount =
    catalog?.products.filter(
      (product) =>
        product.variant.inventory
          .isTracked &&
        product.variant.inventory
          .availableQuantity <=
          product.variant.inventory
            .reorderLevel,
    ).length ?? 0;

  return (
    <GovernanceShell
      eyebrow="Storefront catalogue"
      title="Publish products with inventory you can trust."
      description="Your approved access applies only to the selected storefront. SORVYRA controls currency, account identity, reservations and audit references on the server."
    >
      <section
        className={styles.toolbar}
      >
        <label className={styles.field}>
          <span>Selected storefront</span>
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
              (storefront) => (
                <option
                  key={storefront.code}
                  value={
                    storefront.code
                  }
                >
                  {
                    storefront.shortName
                  }
                </option>
              ),
            )}
          </select>
        </label>
        <div
          className={styles.actions}
        >
          <Link
            className={
              styles.secondaryLink
            }
            href={`/manager?storefrontCode=${storefrontCode}`}
          >
            Manager dashboard
          </Link>
          <Link
            className={
              styles.primaryLink
            }
            href={`${selectedStorefront.baseHref}/shop`}
          >
            View storefront
          </Link>
          {catalog ? (
            <button
              className={
                styles.secondaryButton
              }
              type="button"
              disabled={
                busyKey !== null
              }
              onClick={() =>
                void signOut()
              }
            >
              {busyKey === "sign-out"
                ? "Signing out…"
                : "Sign out"}
            </button>
          ) : null}
        </div>
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
          Loading the secure
          catalogue…
        </section>
      ) : sessionMissing ? (
        <section
          className={styles.panel}
        >
          <h2>Sign in required</h2>
          <p>
            Sign in with the verified
            account approved to manage{" "}
            {
              selectedStorefront.shortName
            }
            .
          </p>
          <Link
            className={
              styles.primaryLink
            }
            href={`/manager/login?storefrontCode=${storefrontCode}&destination=catalogue`}
          >
            Sign in
          </Link>
        </section>
      ) : catalog ? (
        <>
          <section
            className={styles.summary}
          >
            <article>
              <span>Products</span>
              <strong>
                {catalog.products.length}
              </strong>
            </article>
            <article>
              <span>Live now</span>
              <strong>
                {activeCount}
              </strong>
            </article>
            <article>
              <span>
                Low-stock alerts
              </span>
              <strong>
                {lowStockCount}
              </strong>
            </article>
            <article>
              <span>Currency</span>
              <strong>
                {
                  catalog.storefront
                    .currencyCode
                }
              </strong>
            </article>
          </section>

          <details
            className={styles.panel}
            open={
              catalog.products
                .length === 0
            }
          >
            <summary>
              Create a product
            </summary>
            <form
              className={styles.form}
              onSubmit={createProduct}
              data-catalog-create-form
            >
              <div
                className={
                  styles.formGrid
                }
              >
                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    Storefront URL name
                  </span>
                  <input
                    name="listingSlug"
                    placeholder="classic-leather-shoe"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    maxLength={140}
                    required
                  />
                </label>
                <label
                  className={
                    styles.field
                  }
                >
                  <span>SKU</span>
                  <input
                    name="sku"
                    placeholder="ATI-SHOE-001"
                    maxLength={80}
                    required
                  />
                </label>
                <label
                  className={
                    styles.field
                  }
                >
                  <span>
                    Opening stock
                  </span>
                  <input
                    name="initialStock"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={0}
                    required
                  />
                </label>
              </div>
              <ProductFields
                catalog={catalog}
              />
              <button
                className={
                  styles.primaryButton
                }
                type="submit"
                disabled={
                  busyKey !== null
                }
              >
                {busyKey === "create"
                  ? "Creating…"
                  : "Create product"}
              </button>
            </form>
          </details>

          <section
            className={styles.products}
          >
            <div
              className={
                styles.sectionHeading
              }
            >
              <div>
                <span
                  className={
                    styles.eyebrow
                  }
                >
                  Managed catalogue
                </span>
                <h2>
                  Products and stock
                </h2>
              </div>
              <p>
                Signed in as{" "}
                {catalog.manager.email}
              </p>
            </div>

            {catalog.products.length ===
            0 ? (
              <div
                className={
                  styles.empty
                }
              >
                No products have been
                created for this
                storefront.
              </div>
            ) : (
              catalog.products.map(
                (product) => (
                  <article
                    className={
                      styles.product
                    }
                    key={product.id}
                    data-managed-product={
                      product.slug
                    }
                  >
                    <div
                      className={
                        styles.productHead
                      }
                    >
                      <div
                        className={
                          styles.productImage
                        }
                        style={
                          product.image
                            ? {
                                backgroundImage: `url("${product.image.url.replace(/"/gu, "%22")}")`,
                              }
                            : undefined
                        }
                        role={
                          product.image
                            ? "img"
                            : undefined
                        }
                        aria-label={
                          product.image
                            ? product.image
                                .altText ??
                              product.name
                            : undefined
                        }
                      >
                        {!product.image
                          ? "No image"
                          : null}
                      </div>
                      <div>
                        <span
                          className={
                            styles.eyebrow
                          }
                        >
                          {
                            product.variant
                              .sku
                          }{" "}
                          ·{" "}
                          {readable(
                            product.listingStatus,
                          )}
                        </span>
                        <h3>
                          {product.name}
                        </h3>
                        <p>
                          {formatMoney(
                            product.variant
                              .price
                              .amount,
                            product.variant
                              .price
                              .currencyCode,
                          )}
                        </p>
                      </div>
                      <div
                        className={
                          styles.stockCount
                        }
                      >
                        <strong>
                          {
                            product.variant
                              .inventory
                              .availableQuantity
                          }
                        </strong>
                        <span>available</span>
                        <small>
                          {
                            product.variant
                              .inventory
                              .quantityReserved
                          }{" "}
                          reserved by
                          orders
                        </small>
                      </div>
                    </div>

                    <details
                      className={
                        styles.innerPanel
                      }
                    >
                      <summary>
                        Edit product
                      </summary>
                      <form
                        className={
                          styles.form
                        }
                        onSubmit={(
                          event,
                        ) =>
                          void updateProduct(
                            event,
                            product.id,
                          )
                        }
                      >
                        <ProductFields
                          catalog={
                            catalog
                          }
                          product={
                            product
                          }
                        />
                        <p
                          className={
                            styles.locked
                          }
                        >
                          URL: /
                          {product.slug} ·
                          SKU:{" "}
                          {
                            product.variant
                              .sku
                          }{" "}
                          (identifiers are
                          locked after
                          creation)
                        </p>
                        <button
                          className={
                            styles.primaryButton
                          }
                          type="submit"
                          disabled={
                            busyKey !==
                            null
                          }
                        >
                          {busyKey ===
                          `update:${product.id}`
                            ? "Saving…"
                            : "Save product"}
                        </button>
                      </form>
                    </details>

                    <details
                      className={
                        styles.innerPanel
                      }
                    >
                      <summary>
                        Adjust stock
                      </summary>
                      <form
                        className={
                          styles.stockForm
                        }
                        onSubmit={(
                          event,
                        ) =>
                          void adjustStock(
                            event,
                            product.id,
                          )
                        }
                      >
                        <label
                          className={
                            styles.field
                          }
                        >
                          <span>
                            Movement
                          </span>
                          <select
                            name="type"
                            defaultValue="PURCHASE"
                          >
                            <option value="PURCHASE">
                              New stock
                            </option>
                            <option value="RETURN">
                              Customer
                              return
                            </option>
                            <option value="DAMAGE">
                              Damage / loss
                            </option>
                            <option value="ADJUSTMENT">
                              Count
                              correction
                            </option>
                          </select>
                        </label>
                        <label
                          className={
                            styles.field
                          }
                        >
                          <span>
                            Quantity change
                          </span>
                          <input
                            name="quantityDelta"
                            type="number"
                            step={1}
                            placeholder="e.g. 5 or -2"
                            required
                          />
                        </label>
                        <label
                          className={
                            styles.field
                          }
                        >
                          <span>Reason</span>
                          <input
                            name="reason"
                            maxLength={500}
                            placeholder="Supplier delivery or stock count"
                            required
                          />
                        </label>
                        <button
                          className={
                            styles.primaryButton
                          }
                          type="submit"
                          disabled={
                            busyKey !==
                            null
                          }
                        >
                          {busyKey ===
                          `stock:${product.id}`
                            ? "Recording…"
                            : "Record stock movement"}
                        </button>
                      </form>

                      <div
                        className={
                          styles.movements
                        }
                      >
                        {product.variant
                          .inventory
                          .movements
                          .length ===
                        0 ? (
                          <p>
                            No stock
                            movements yet.
                          </p>
                        ) : (
                          product.variant.inventory.movements.map(
                            (
                              movement,
                            ) => (
                              <div
                                key={
                                  movement.id
                                }
                              >
                                <strong>
                                  {movement.quantityDelta >
                                  0
                                    ? "+"
                                    : ""}
                                  {
                                    movement.quantityDelta
                                  }{" "}
                                  ·{" "}
                                  {readable(
                                    movement.type,
                                  )}
                                </strong>
                                <span>
                                  {movement.reason ??
                                    "Recorded stock movement"}
                                </span>
                                <time>
                                  {new Date(
                                    movement.createdAt,
                                  ).toLocaleString()}
                                </time>
                              </div>
                            ),
                          )
                        )}
                      </div>
                    </details>
                  </article>
                ),
              )
            )}
          </section>
        </>
      ) : null}
    </GovernanceShell>
  );
}
