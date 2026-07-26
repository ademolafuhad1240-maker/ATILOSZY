#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2f-d-a-details.log"
: >"$DETAIL_LOG"

run_quiet() {
  local label="$1"
  shift

  echo
  echo "=== $label ==="

  if "$@" >>"$DETAIL_LOG" 2>&1; then
    echo "PASS: $label"
  else
    echo "FAIL: $label"
    echo
    echo "=== FAILURE LOG TAIL ==="
    tail -n 180 "$DETAIL_LOG"
    exit 1
  fi
}

echo "=== VERIFY CLEAN CHECKPOINT ==="

test "$(git branch --show-current)" = \
  "feat/commerce-foundation"

UNEXPECTED_CHANGES="$(
  git status --porcelain |
  grep -v \
    '^?? scripts/setup-live-catalog-cart-integration.sh$' ||
  true
)"

if [ -n "$UNEXPECTED_CHANGES" ]; then
  echo "Unexpected repository changes exist:"
  printf '%s\n' "$UNEXPECTED_CHANGES"
  exit 1
fi

echo "Branch: $(git branch --show-current)"
echo "Starting commit: $(git rev-parse --short HEAD)"
echo "PASS: Working tree is clean."

echo
echo "=== VERIFY REQUIRED ROUTES AND SERVICES ==="

python - <<'PY'
from pathlib import Path

required = [
    Path("src/server/catalog/index.ts"),
    Path("src/server/cart/index.ts"),
    Path("src/app/api/cart/items/route.ts"),
    Path("src/lib/storefront-auth.ts"),
    Path("src/app/ng/atiloszy/shop/page.tsx"),
    Path("src/app/ng/zee-beauty-fashion/shop/page.tsx"),
    Path("src/app/ng/denald/shop/page.tsx"),
    Path("src/app/qa/zee-comfort-hub/shop/page.tsx"),
]

for path in required:
    if not path.exists():
        raise RuntimeError(
            f"Required file is missing: {path}"
        )

catalogue_exports = Path(
    "src/server/catalog/index.ts"
).read_text(
    encoding="utf-8",
)

for value in [
    "getPublicStorefrontCatalogue",
    "getPublicStorefrontProduct",
]:
    if value not in catalogue_exports:
        raise RuntimeError(
            f"Missing catalogue export: {value}"
        )

for path in required[4:]:
    content = path.read_text(
        encoding="utf-8",
    )

    if "</>" not in content:
        raise RuntimeError(
            f"Shop page does not expose a closing React fragment: {path}"
        )

print(
    "PASS: Catalogue, cart API and storefront shop foundations are available."
)
PY

echo
echo "=== CREATE STOREFRONT CATALOGUE CONFIGURATION ==="

cat > src/lib/storefront-catalog.ts <<'TS'
export interface StorefrontCatalogConfig {
  code: "ATI" | "ZBF" | "DEN" | "ZCH";
  key: string;
  name: string;
  shortName: string;
  baseHref: string;
  shopHref: string;
  cartHref: string;
  loginHref: string;
  accountHref: string;
}

const storefrontCatalogConfigs:
  Record<
    StorefrontCatalogConfig["code"],
    StorefrontCatalogConfig
  > = {
    ATI: {
      code: "ATI",
      key: "atiloszy",
      name:
        "ATILOSZY Varieties Store",
      shortName: "ATILOSZY",
      baseHref: "/ng/atiloszy",
      shopHref:
        "/ng/atiloszy/shop",
      cartHref:
        "/ng/atiloszy/cart",
      loginHref:
        "/ng/atiloszy/account/login",
      accountHref:
        "/ng/atiloszy/account",
    },
    ZBF: {
      code: "ZBF",
      key:
        "zee-beauty-fashion",
      name:
        "ZEE Beauty & Fashion World",
      shortName:
        "ZEE Beauty & Fashion",
      baseHref:
        "/ng/zee-beauty-fashion",
      shopHref:
        "/ng/zee-beauty-fashion/shop",
      cartHref:
        "/ng/zee-beauty-fashion/cart",
      loginHref:
        "/ng/zee-beauty-fashion/account/login",
      accountHref:
        "/ng/zee-beauty-fashion/account",
    },
    DEN: {
      code: "DEN",
      key: "denald",
      name:
        "DENALD Solar | CCTV | Computer",
      shortName: "DENALD",
      baseHref: "/ng/denald",
      shopHref:
        "/ng/denald/shop",
      cartHref:
        "/ng/denald/cart",
      loginHref:
        "/ng/denald/account/login",
      accountHref:
        "/ng/denald/account",
    },
    ZCH: {
      code: "ZCH",
      key:
        "zee-comfort-hub",
      name:
        "Zee COMFORT HUB",
      shortName:
        "Zee COMFORT HUB",
      baseHref:
        "/qa/zee-comfort-hub",
      shopHref:
        "/qa/zee-comfort-hub/shop",
      cartHref:
        "/qa/zee-comfort-hub/cart",
      loginHref:
        "/qa/zee-comfort-hub/account/login",
      accountHref:
        "/qa/zee-comfort-hub/account",
    },
  };

export function getStorefrontCatalogConfig(
  code: StorefrontCatalogConfig["code"],
): StorefrontCatalogConfig {
  return storefrontCatalogConfigs[
    code
  ];
}
TS

echo
echo "=== CREATE AUTHENTICATED ADD-TO-CART BUTTON ==="

cat > src/components/cart/authenticated-add-to-cart-button.tsx <<'TS'
"use client";

import Link from "next/link";
import {
  useState,
} from "react";

import styles from "./authenticated-add-to-cart-button.module.css";

interface CartApiPayload {
  data?: {
    cart?: {
      itemCount?: number;
    };
  };
  error?: {
    message?: string;
  };
}

export default function AuthenticatedAddToCartButton({
  storefrontCode,
  productVariantId,
  loginHref,
  cartHref,
  availableQuantity,
  allowBackorder,
  disabled = false,
}: {
  storefrontCode: string;
  productVariantId: string;
  loginHref: string;
  cartHref: string;
  availableQuantity:
    | number
    | null;
  allowBackorder: boolean;
  disabled?: boolean;
}) {
  const [
    quantity,
    setQuantity,
  ] = useState(1);

  const [
    pending,
    setPending,
  ] = useState(false);

  const [
    added,
    setAdded,
  ] = useState(false);

  const [
    authenticationRequired,
    setAuthenticationRequired,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const maximum =
    availableQuantity === null ||
    allowBackorder
      ? 999
      : Math.max(
          availableQuantity,
          1,
        );

  async function addToCart(): Promise<void> {
    setPending(true);
    setAdded(false);
    setAuthenticationRequired(
      false,
    );
    setError(null);

    try {
      const response = await fetch(
        "/api/cart/items",
        {
          method: "POST",
          credentials:
            "same-origin",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            storefrontCode,
            productVariantId,
            quantity,
          }),
        },
      );

      let payload:
        CartApiPayload = {};

      try {
        payload =
          await response.json() as
            CartApiPayload;
      } catch {
        payload = {};
      }

      if (response.status === 401) {
        setAuthenticationRequired(
          true,
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
          "The product could not be added to your cart.",
        );
      }

      setAdded(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The product could not be added to your cart.",
      );
    } finally {
      setPending(false);
    }
  }

  const unavailable =
    disabled ||
    (
      availableQuantity !== null &&
      availableQuantity < 1 &&
      !allowBackorder
    );

  return (
    <div
      className={styles.wrapper}
      data-server-cart-button={
        productVariantId
      }
    >
      <div
        className={
          styles.controls
        }
      >
        <label
          className={
            styles.quantityLabel
          }
        >
          <span>Quantity</span>

          <input
            className={
              styles.quantityInput
            }
            type="number"
            min={1}
            max={maximum}
            value={quantity}
            disabled={
              unavailable ||
              pending
            }
            onChange={(event) => {
              const nextValue =
                Number(
                  event.target.value,
                );

              if (
                Number.isSafeInteger(
                  nextValue,
                ) &&
                nextValue >= 1
              ) {
                setQuantity(
                  Math.min(
                    nextValue,
                    maximum,
                  ),
                );
              }
            }}
          />
        </label>

        <button
          className={
            styles.button
          }
          type="button"
          disabled={
            unavailable ||
            pending
          }
          onClick={() =>
            void addToCart()
          }
        >
          {unavailable
            ? "Out of stock"
            : pending
              ? "Adding…"
              : "Add to cart"}
        </button>
      </div>

      {authenticationRequired ? (
        <p
          className={
            styles.notice
          }
          role="status"
        >
          Sign in to this storefront
          before adding products.{" "}
          <Link href={loginHref}>
            Sign in
          </Link>
        </p>
      ) : null}

      {added ? (
        <p
          className={
            styles.success
          }
          role="status"
        >
          Added to your secure
          storefront cart.{" "}
          <Link href={cartHref}>
            View cart
          </Link>
        </p>
      ) : null}

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
    </div>
  );
}
TS

cat > src/components/cart/authenticated-add-to-cart-button.module.css <<'CSS'
.wrapper {
  display: grid;
  gap: 0.7rem;
}

.controls {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.quantityLabel {
  display: grid;
  gap: 0.35rem;
  color: #5c6470;
  font-size: 0.78rem;
  font-weight: 750;
}

.quantityInput {
  width: 5rem;
  border: 1px solid
    rgba(15, 24, 38, 0.16);
  border-radius: 0.75rem;
  padding: 0.7rem;
  background: #ffffff;
  color: #101827;
  font: inherit;
  text-align: center;
}

.button {
  min-height: 2.8rem;
  border: 0;
  border-radius: 999px;
  padding: 0.72rem 1.15rem;
  background: #101827;
  color: #ffffff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.notice,
.success,
.error {
  margin: 0;
  border-radius: 0.8rem;
  padding: 0.7rem 0.85rem;
  font-size: 0.84rem;
  line-height: 1.5;
}

.notice {
  background: #fff5d8;
  color: #705516;
}

.success {
  background: #e5f4eb;
  color: #1f6846;
}

.error {
  background: #fbe6e6;
  color: #8c2424;
}

.notice a,
.success a {
  color: inherit;
  font-weight: 850;
}
CSS

echo
echo "=== CREATE LIVE CATALOGUE STYLES ==="

mkdir -p \
  src/components/catalog

cat > src/components/catalog/live-catalog.module.css <<'CSS'
.section,
.productPage {
  --catalog-accent: #b48631;
  --catalog-soft: #f4ead5;
  color: #101827;
}

.section[data-storefront-code="ZBF"],
.productPage[data-storefront-code="ZBF"],
.section[data-storefront-code="ZCH"],
.productPage[data-storefront-code="ZCH"] {
  --catalog-accent: #8f2949;
  --catalog-soft: #f7e4e9;
}

.section[data-storefront-code="DEN"],
.productPage[data-storefront-code="DEN"] {
  --catalog-accent: #176b62;
  --catalog-soft: #ddf1ed;
}

.section {
  width: min(1180px, calc(100% - 2rem));
  margin: 4rem auto;
  border: 1px solid
    rgba(16, 24, 39, 0.1);
  border-radius: 2rem;
  padding: clamp(
    1.25rem,
    4vw,
    2.5rem
  );
  background:
    radial-gradient(
      circle at top right,
      var(--catalog-soft),
      transparent 32rem
    ),
    #faf8f3;
  box-shadow:
    0 28px 80px
    rgba(16, 24, 39, 0.08);
}

.headingRow {
  display: flex;
  align-items: end;
  justify-content:
    space-between;
  gap: 1rem;
  margin-bottom: 1.7rem;
}

.eyebrow {
  margin: 0 0 0.4rem;
  color:
    var(--catalog-accent);
  font-size: 0.74rem;
  font-weight: 850;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.heading {
  margin: 0;
  font-size: clamp(
    1.8rem,
    4vw,
    3.4rem
  );
  letter-spacing: -0.045em;
}

.description {
  max-width: 44rem;
  margin: 0.8rem 0 0;
  color: #606a78;
  line-height: 1.65;
}

.cartLink,
.backLink {
  border-radius: 999px;
  padding: 0.78rem 1rem;
  background: #ffffff;
  color: #101827;
  box-shadow:
    0 12px 35px
    rgba(16, 24, 39, 0.09);
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
}

.grid {
  display: grid;
  grid-template-columns:
    repeat(
      auto-fit,
      minmax(230px, 1fr)
    );
  gap: 1rem;
}

.card {
  display: grid;
  gap: 1rem;
  border: 1px solid
    rgba(16, 24, 39, 0.09);
  border-radius: 1.35rem;
  padding: 1.15rem;
  background: rgba(
    255,
    255,
    255,
    0.94
  );
}

.cardHeader {
  display: grid;
  gap: 0.4rem;
}

.category {
  margin: 0;
  color:
    var(--catalog-accent);
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.productName {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.15;
}

.productLink {
  color: inherit;
  text-decoration: none;
}

.productLink:hover {
  text-decoration: underline;
}

.productDescription {
  margin: 0;
  min-height: 3rem;
  color: #69717e;
  font-size: 0.9rem;
  line-height: 1.55;
}

.variantSummary {
  display: grid;
  gap: 0.35rem;
}

.variantTitle {
  margin: 0;
  color: #555f6c;
  font-size: 0.85rem;
}

.price {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 900;
}

.comparePrice {
  margin-left: 0.45rem;
  color: #838b96;
  font-size: 0.82rem;
  font-weight: 650;
  text-decoration:
    line-through;
}

.stock {
  margin: 0;
  color: #606a78;
  font-size: 0.8rem;
}

.empty {
  border: 1px dashed
    rgba(16, 24, 39, 0.2);
  border-radius: 1.25rem;
  padding: clamp(
    1.5rem,
    5vw,
    3rem
  );
  text-align: center;
  color: #69717e;
}

.productPage {
  min-height: 100vh;
  padding: 2rem 1rem 5rem;
  background:
    radial-gradient(
      circle at top right,
      var(--catalog-soft),
      transparent 34rem
    ),
    #f7f3eb;
}

.productShell {
  width: min(1080px, 100%);
  margin: 0 auto;
}

.productHeader {
  display: grid;
  gap: 1rem;
  margin: 2rem 0;
}

.productTitle {
  margin: 0;
  max-width: 52rem;
  font-size: clamp(
    2.4rem,
    7vw,
    5.5rem
  );
  line-height: 0.95;
  letter-spacing: -0.06em;
}

.productLead {
  max-width: 48rem;
  margin: 0;
  color: #606a78;
  font-size: 1rem;
  line-height: 1.75;
}

.variantGrid {
  display: grid;
  grid-template-columns:
    repeat(
      auto-fit,
      minmax(260px, 1fr)
    );
  gap: 1rem;
}

.variantCard {
  display: grid;
  gap: 1rem;
  border: 1px solid
    rgba(16, 24, 39, 0.1);
  border-radius: 1.5rem;
  padding: 1.35rem;
  background: #ffffff;
  box-shadow:
    0 20px 55px
    rgba(16, 24, 39, 0.07);
}

.optionList {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.option {
  border-radius: 999px;
  padding: 0.45rem 0.65rem;
  background:
    var(--catalog-soft);
  color: #414956;
  font-size: 0.76rem;
  font-weight: 750;
}

@media (max-width: 700px) {
  .headingRow {
    align-items: stretch;
    flex-direction: column;
  }

  .cartLink {
    text-align: center;
  }
}
CSS

echo
echo "=== CREATE LIVE STOREFRONT CATALOGUE SECTION ==="

cat > src/components/catalog/storefront-live-catalog-section.tsx <<'TS'
import Link from "next/link";

import {
  getPublicStorefrontCatalogue,
} from "../../server/catalog";
import {
  getStorefrontCatalogConfig,
  type StorefrontCatalogConfig,
} from "../../lib/storefront-catalog";
import AuthenticatedAddToCartButton from "../cart/authenticated-add-to-cart-button";

import styles from "./live-catalog.module.css";

function formatMoney(
  amount: string,
  currencyCode: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency:
        currencyCode,
    },
  ).format(Number(amount));
}

export default async function StorefrontLiveCatalogSection({
  storefrontCode,
}: {
  storefrontCode:
    StorefrontCatalogConfig["code"];
}) {
  const storefront =
    getStorefrontCatalogConfig(
      storefrontCode,
    );

  const products =
    await getPublicStorefrontCatalogue(
      storefront.key,
    );

  return (
    <section
      className={styles.section}
      data-storefront-code={
        storefront.code
      }
      data-live-catalog-storefront={
        storefront.code
      }
    >
      <div
        className={
          styles.headingRow
        }
      >
        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            Live inventory
          </p>

          <h2
            className={
              styles.heading
            }
          >
            Products available now
          </h2>

          <p
            className={
              styles.description
            }
          >
            These products come directly
            from the secure{" "}
            {storefront.shortName}{" "}
            catalogue. Prices, variants
            and stock are checked by the
            server before they enter your
            storefront cart.
          </p>
        </div>

        <Link
          className={
            styles.cartLink
          }
          href={
            storefront.cartHref
          }
        >
          View secure cart
        </Link>
      </div>

      {products.length === 0 ? (
        <div
          className={styles.empty}
        >
          Live products have not been
          published for this storefront
          yet. The demonstration products
          above remain available for
          preview.
        </div>
      ) : (
        <div
          className={styles.grid}
        >
          {products.map((product) => {
            const variant =
              product.variants[0];

            const detailHref =
              `${storefront.shopHref}/${product.slug}`;

            return (
              <article
                className={
                  styles.card
                }
                key={product.id}
                data-live-product={
                  product.slug
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <p
                    className={
                      styles.category
                    }
                  >
                    {product.category
                      ?.name ??
                      storefront.shortName}
                  </p>

                  <h3
                    className={
                      styles.productName
                    }
                  >
                    <Link
                      className={
                        styles.productLink
                      }
                      href={
                        detailHref
                      }
                    >
                      {product.name}
                    </Link>
                  </h3>
                </header>

                <p
                  className={
                    styles.productDescription
                  }
                >
                  {product.shortDescription ??
                    "View this product's current variants, price and availability."}
                </p>

                {variant ? (
                  <>
                    <div
                      className={
                        styles.variantSummary
                      }
                    >
                      <p
                        className={
                          styles.variantTitle
                        }
                      >
                        {variant.title}
                      </p>

                      <p
                        className={
                          styles.price
                        }
                      >
                        {formatMoney(
                          variant.price
                            .amount,
                          variant.price
                            .currencyCode,
                        )}

                        {variant.price
                          .compareAtAmount ? (
                          <span
                            className={
                              styles.comparePrice
                            }
                          >
                            {formatMoney(
                              variant.price
                                .compareAtAmount,
                              variant.price
                                .currencyCode,
                            )}
                          </span>
                        ) : null}
                      </p>

                      <p
                        className={
                          styles.stock
                        }
                      >
                        {variant
                          .availableQuantity ===
                        null
                          ? "Availability confirmed at checkout"
                          : variant.isInStock
                            ? `${variant.availableQuantity} available`
                            : "Currently out of stock"}
                      </p>
                    </div>

                    <AuthenticatedAddToCartButton
                      storefrontCode={
                        storefront.code
                      }
                      productVariantId={
                        variant.id
                      }
                      loginHref={
                        storefront.loginHref
                      }
                      cartHref={
                        storefront.cartHref
                      }
                      availableQuantity={
                        variant
                          .availableQuantity
                      }
                      allowBackorder={
                        variant
                          .allowBackorder
                      }
                      disabled={
                        !variant.isInStock
                      }
                    />
                  </>
                ) : (
                  <p
                    className={
                      styles.stock
                    }
                  >
                    No purchasable variant
                    is currently available.
                  </p>
                )}

                <Link
                  className={
                    styles.productLink
                  }
                  href={detailHref}
                >
                  View product details
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
TS

echo
echo "=== CREATE LIVE PRODUCT DETAIL COMPONENT ==="

cat > src/components/catalog/storefront-live-product-page.tsx <<'TS'
import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import {
  getPublicStorefrontProduct,
} from "../../server/catalog";
import {
  getStorefrontCatalogConfig,
  type StorefrontCatalogConfig,
} from "../../lib/storefront-catalog";
import AuthenticatedAddToCartButton from "../cart/authenticated-add-to-cart-button";

import styles from "./live-catalog.module.css";

function formatMoney(
  amount: string,
  currencyCode: string,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency:
        currencyCode,
    },
  ).format(Number(amount));
}

export async function StorefrontLiveProductPage({
  storefrontCode,
  slug,
}: {
  storefrontCode:
    StorefrontCatalogConfig["code"];
  slug: string;
}) {
  const storefront =
    getStorefrontCatalogConfig(
      storefrontCode,
    );

  const product =
    await getPublicStorefrontProduct(
      storefront.key,
      slug,
    );

  if (!product) {
    notFound();
  }

  return (
    <main
      className={
        styles.productPage
      }
      data-storefront-code={
        storefront.code
      }
      data-live-product-page={
        product.slug
      }
    >
      <div
        className={
          styles.productShell
        }
      >
        <Link
          className={styles.backLink}
          href={
            storefront.shopHref
          }
        >
          Back to{" "}
          {storefront.shortName}
        </Link>

        <header
          className={
            styles.productHeader
          }
        >
          <p
            className={
              styles.eyebrow
            }
          >
            {product.category
              ?.name ??
              storefront.shortName}
          </p>

          <h1
            className={
              styles.productTitle
            }
          >
            {product.name}
          </h1>

          <p
            className={
              styles.productLead
            }
          >
            {product.description ??
              product.shortDescription ??
              "Choose an available variant and add it to your secure storefront cart."}
          </p>
        </header>

        <section
          className={
            styles.variantGrid
          }
          aria-label="Product variants"
        >
          {product.variants.map(
            (variant) => (
              <article
                className={
                  styles.variantCard
                }
                key={variant.id}
                data-product-variant-id={
                  variant.id
                }
              >
                <div>
                  <p
                    className={
                      styles.category
                    }
                  >
                    SKU {variant.sku}
                  </p>

                  <h2
                    className={
                      styles.productName
                    }
                  >
                    {variant.title}
                  </h2>
                </div>

                {variant.options
                  .length > 0 ? (
                  <ul
                    className={
                      styles.optionList
                    }
                  >
                    {variant.options.map(
                      (option) => (
                        <li
                          className={
                            styles.option
                          }
                          key={`${option.name}:${option.value}`}
                        >
                          {option.name}:{" "}
                          {option.value}
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}

                <p
                  className={
                    styles.price
                  }
                >
                  {formatMoney(
                    variant.price.amount,
                    variant.price
                      .currencyCode,
                  )}

                  {variant.price
                    .compareAtAmount ? (
                    <span
                      className={
                        styles.comparePrice
                      }
                    >
                      {formatMoney(
                        variant.price
                          .compareAtAmount,
                        variant.price
                          .currencyCode,
                      )}
                    </span>
                  ) : null}
                </p>

                <p
                  className={
                    styles.stock
                  }
                >
                  {variant
                    .availableQuantity ===
                  null
                    ? "Availability confirmed before checkout"
                    : variant.isInStock
                      ? `${variant.availableQuantity} currently available`
                      : "Currently out of stock"}
                </p>

                <AuthenticatedAddToCartButton
                  storefrontCode={
                    storefront.code
                  }
                  productVariantId={
                    variant.id
                  }
                  loginHref={
                    storefront.loginHref
                  }
                  cartHref={
                    storefront.cartHref
                  }
                  availableQuantity={
                    variant
                      .availableQuantity
                  }
                  allowBackorder={
                    variant
                      .allowBackorder
                  }
                  disabled={
                    !variant.isInStock
                  }
                />
              </article>
            ),
          )}
        </section>
      </div>
    </main>
  );
}
TS

echo
echo "=== ADD LIVE CATALOGUE TO FOUR SHOP PAGES ==="

python - <<'PY'
from pathlib import Path

pages = {
    Path(
        "src/app/ng/atiloszy/shop/page.tsx"
    ): "ATI",
    Path(
        "src/app/ng/zee-beauty-fashion/shop/page.tsx"
    ): "ZBF",
    Path(
        "src/app/ng/denald/shop/page.tsx"
    ): "DEN",
    Path(
        "src/app/qa/zee-comfort-hub/shop/page.tsx"
    ): "ZCH",
}

import_line = (
    "import StorefrontLiveCatalogSection "
    "from '@/components/catalog/"
    "storefront-live-catalog-section';\n"
)

for path, code in pages.items():
    content = path.read_text(
        encoding="utf-8",
    )

    if (
        "StorefrontLiveCatalogSection"
        not in content
    ):
        content = (
            import_line +
            content
        )

    if (
        'export const dynamic = "force-dynamic";'
        not in content
        and
        "export const dynamic = 'force-dynamic';"
        not in content
    ):
        metadata_marker = (
            "export const metadata"
        )

        index = content.find(
            metadata_marker
        )

        if index < 0:
            raise RuntimeError(
                f"Metadata export not found in {path}."
            )

        content = (
            content[:index] +
            "export const dynamic = "
            "'force-dynamic';\n\n" +
            content[index:]
        )

    component = (
        "\n      "
        "<StorefrontLiveCatalogSection "
        f'storefrontCode="{code}" />\n'
    )

    if (
        f'storefrontCode="{code}"'
        not in content
    ):
        closing_marker = "\n    </>"

        closing = content.rfind(
            closing_marker
        )

        if closing < 0:
            raise RuntimeError(
                f"Closing React fragment not found in {path}."
            )

        content = (
            content[:closing] +
            component +
            content[closing:]
        )

    path.write_text(
        content,
        encoding="utf-8",
    )

    print(
        f"Connected live catalogue to {code}."
    )
PY

echo
echo "=== CREATE STOREFRONT PRODUCT DETAIL ROUTES ==="

python - <<'PY'
from pathlib import Path

routes = {
    Path(
        "src/app/ng/atiloszy/shop/[slug]"
    ): "ATI",
    Path(
        "src/app/ng/zee-beauty-fashion/shop/[slug]"
    ): "ZBF",
    Path(
        "src/app/ng/denald/shop/[slug]"
    ): "DEN",
    Path(
        "src/app/qa/zee-comfort-hub/shop/[slug]"
    ): "ZCH",
}

template = '''import {{
  StorefrontLiveProductPage,
}} from '@/components/catalog/storefront-live-product-page';

export const dynamic =
  'force-dynamic';

interface ProductPageProps {{
  params: Promise<{{
    slug: string;
  }}>;
}}

export default async function ProductPage({{
  params,
}}: ProductPageProps) {{
  const {{
    slug,
  }} = await params;

  return (
    <StorefrontLiveProductPage
      storefrontCode="{code}"
      slug={{slug}}
    />
  );
}}
'''

for directory, code in routes.items():
    directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    (
        directory /
        "page.tsx"
    ).write_text(
        template.format(
            code=code,
        ),
        encoding="utf-8",
    )

    print(
        f"Created live product route for {code}."
    )
PY

echo
echo "=== CREATE LIVE CATALOGUE INTEGRATION AUDIT ==="

cat > scripts/audit-live-catalog-cart-integration.ts <<'TS'
import {
  type ChildProcessByStdio,
  spawn,
} from "node:child_process";
import {
  randomBytes,
  randomInt,
} from "node:crypto";
import type {
  Readable,
} from "node:stream";

import {
  ProductStatus,
  StorefrontProductStatus,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  createCatalogProduct,
} from "../src/server/catalog";
import {
  normalizeEmail,
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

type TestServer =
  ChildProcessByStdio<
    null,
    Readable,
    Readable
  >;

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForExit(
  server: TestServer,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return true;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve(false),
      timeoutMilliseconds,
    );

    server.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function stopServer(
  server: TestServer,
): Promise<void> {
  if (
    server.exitCode !== null ||
    server.signalCode !== null
  ) {
    return;
  }

  server.kill("SIGTERM");

  if (
    await waitForExit(
      server,
      5000,
    )
  ) {
    return;
  }

  server.kill("SIGKILL");

  await waitForExit(
    server,
    2000,
  );
}

async function main(): Promise<void> {
  console.log(
    "=== LIVE CATALOGUE CART INTEGRATION AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const token = randomBytes(7)
    .toString("hex");

  const email =
    `live-catalog-${token}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phone =
    `+234709${`${Date.now()}`.slice(-7)}`;

  const productName =
    `Live catalogue audit product ${token}`;

  const category =
    await prisma.category.findFirstOrThrow(
      {
        where: {
          storefront: {
            key: "atiloszy",
          },
        },
      },
    );

  let productId:
    | string
    | null = null;

  const registration =
    await registerCustomer({
      storefrontCode: "ATI",
      email,
      phone,
      password:
        `Live-Catalog-Passphrase-${token}`,
      firstName: "Live",
      lastName: "Catalogue Audit",
      marketingOptIn: false,
      termsAccepted: true,
      privacyAccepted: true,
      tokenSecret,
    });

  await verifyCustomerEmail({
    storefrontCode: "ATI",
    token:
      registration
        .emailVerificationToken,
    tokenSecret,
  });

  await verifyCustomerPhone({
    storefrontCode: "ATI",
    challengeId:
      registration.phoneChallengeId,
    code:
      registration
        .phoneVerificationCode,
    tokenSecret,
  });

  const created =
    await createCatalogProduct({
      storefrontKey: "atiloszy",
      categorySlug:
        category.slug,
      listingSlug:
        `live-catalog-${token}`,
      name: productName,
      shortDescription:
        "Temporary live catalogue integration product.",
      productStatus:
        ProductStatus.ACTIVE,
      listingStatus:
        StorefrontProductStatus.ACTIVE,
      publishedAt: new Date(
        Date.now() - 60_000,
      ),
      isDemo: true,
      maxPerOrder: 5,
      variant: {
        sku:
          `ATI-LIVE-${token}`,
        title: "Audit variant",
        price: {
          amount: "12500.00",
        },
        initialStock: 7,
        isTracked: true,
        allowBackorder: false,
      },
    });

  productId = created.productId;

  const port = randomInt(
    45001,
    51000,
  );

  const baseUrl =
    `http://127.0.0.1:${port}`;

  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      String(port),
      "-H",
      "127.0.0.1",
    ],
    {
      env: {
        ...process.env,
        APP_ORIGIN: baseUrl,
      },
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  );

  let serverLogs = "";

  for (
    const stream of [
      server.stdout,
      server.stderr,
    ]
  ) {
    stream.on("data", (
      chunk: Buffer,
    ) => {
      serverLogs = (
        serverLogs +
        chunk.toString("utf8")
      ).slice(-18000);
    });
  }

  try {
    let ready = false;

    for (
      let attempt = 0;
      attempt < 60;
      attempt += 1
    ) {
      try {
        const response =
          await fetch(baseUrl);

        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Server is starting.
      }

      await delay(500);
    }

    assertCondition(
      ready,
      "Production server did not become ready.\n" +
      serverLogs,
    );

    console.log(
      "PASS: Production Next.js server started.",
    );

    const shopRoutes = [
      [
        "/ng/atiloszy/shop",
        "ATI",
      ],
      [
        "/ng/zee-beauty-fashion/shop",
        "ZBF",
      ],
      [
        "/ng/denald/shop",
        "DEN",
      ],
      [
        "/qa/zee-comfort-hub/shop",
        "ZCH",
      ],
    ] as const;

    for (
      const [
        route,
        code,
      ] of shopRoutes
    ) {
      const response =
        await fetch(
          `${baseUrl}${route}`,
        );

      const html =
        await response.text();

      assertCondition(
        response.status === 200,
        `${code} shop page failed.`,
      );

      assertCondition(
        html.includes(
          `data-live-catalog-storefront="${code}"`,
        ),
        `${code} live catalogue marker is missing.`,
      );
    }

    console.log(
      "PASS: All storefront shop pages render live catalogue sections.",
    );

    const atiShop =
      await fetch(
        `${baseUrl}/ng/atiloszy/shop`,
      );

    const atiShopHtml =
      await atiShop.text();

    assertCondition(
      atiShopHtml.includes(
        productName,
      ),
      "The live ATI product did not render in its shop.",
    );

    assertCondition(
      atiShopHtml.includes(
        `/ng/atiloszy/shop/live-catalog-${token}`,
      ),
      "The live product detail link was missing.",
    );

    console.log(
      "PASS: Published database products render in their storefront.",
    );

    const detail =
      await fetch(
        `${baseUrl}/ng/atiloszy/shop/live-catalog-${token}`,
      );

    const detailHtml =
      await detail.text();

    assertCondition(
      detail.status === 200,
      "The live product detail page failed.",
    );

    assertCondition(
      detailHtml.includes(
        `data-live-product-page="live-catalog-${token}"`,
      ),
      "The live product-page marker was missing.",
    );

    assertCondition(
      detailHtml.includes(
        `data-product-variant-id="${created.variantId}"`,
      ),
      "The real product variant was not rendered.",
    );

    console.log(
      "PASS: Storefront product detail pages use real catalogue variants.",
    );

    const loginResponse =
      await fetch(
        `${baseUrl}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Origin: baseUrl,
          },
          body: JSON.stringify({
            storefrontCode: "ATI",
            email,
            password:
              `Live-Catalog-Passphrase-${token}`,
          }),
        },
      );

    assertCondition(
      loginResponse.status === 200,
      "The integration customer could not sign in.",
    );

    const setCookie =
      loginResponse.headers.get(
        "set-cookie",
      );

    assertCondition(
      setCookie,
      "Login did not return a storefront session cookie.",
    );

    const cookie =
      setCookie.split(";")[0];

    const addResponse =
      await fetch(
        `${baseUrl}/api/cart/items`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Origin: baseUrl,
            Cookie: cookie,
          },
          body: JSON.stringify({
            storefrontCode: "ATI",
            productVariantId:
              created.variantId,
            quantity: 2,
          }),
        },
      );

    assertCondition(
      addResponse.status === 201,
      "The live product could not be added to the authenticated cart.",
    );

    const cartPage =
      await fetch(
        `${baseUrl}/ng/atiloszy/cart`,
        {
          headers: {
            Cookie: cookie,
          },
        },
      );

    const cartHtml =
      await cartPage.text();

    assertCondition(
      cartPage.status === 200,
      "The authenticated cart page failed.",
    );

    assertCondition(
      cartHtml.includes(
        productName,
      ),
      "The live catalogue product did not reach the storefront cart.",
    );

    console.log(
      "PASS: Live catalogue products reach the authenticated storefront cart.",
    );

    console.log(
      "PASS: Live catalogue cart integration audit completed.",
    );
  } catch (error) {
    console.error(
      "=== PRODUCTION SERVER LOG TAIL ===",
    );

    console.error(serverLogs);

    throw error;
  } finally {
    await stopServer(server);

    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    if (productId) {
      await prisma.product.deleteMany({
        where: {
          id: productId,
        },
      });
    }

    console.log(
      "PASS: Temporary live catalogue audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
TS

echo
echo "=== REGISTER LIVE CATALOGUE AUDIT ==="

npm pkg set \
  "scripts.db:audit:live-catalog=node --env-file=.env --conditions=react-server --import tsx scripts/audit-live-catalog-cart-integration.ts"

run_quiet \
  "VALIDATE DATABASE SCHEMA" \
  npm run db:validate

run_quiet \
  "VERIFY MIGRATION STATUS" \
  npx prisma migrate status

run_quiet \
  "ESLINT" \
  npm run lint

run_quiet \
  "PRODUCTION BUILD" \
  npm run build

echo
echo "=== RUN LIVE CATALOGUE CART INTEGRATION AUDIT ==="

if npm run db:audit:live-catalog \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: Live catalogue integration audit"
else
  echo "FAIL: Live catalogue integration audit"
  exit 1
fi

run_quiet \
  "CART API REGRESSION AUDIT" \
  npm run db:audit:cart-api

run_quiet \
  "CART SERVICE REGRESSION AUDIT" \
  npm run db:audit:cart-services

run_quiet \
  "CATALOGUE SERVICE REGRESSION AUDIT" \
  npm run db:audit:services

run_quiet \
  "AUTHENTICATION PAGE REGRESSION AUDIT" \
  npm run db:audit:auth-ui

echo
echo "=== VERIFY AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TS'
import { prisma } from "./src/lib/prisma";

const users =
  await prisma.user.count({
    where: {
      normalizedEmail: {
        contains:
          "live-catalog-",
        endsWith:
          "@example.test",
      },
    },
  });

const products =
  await prisma.product.count({
    where: {
      slug: {
        startsWith:
          "atiloszy-live-catalog-",
      },
    },
  });

if (
  users !== 0 ||
  products !== 0
) {
  throw new Error(
    `${users} temporary user(s) and ${products} temporary product(s) remain.`,
  );
}

console.log(
  "PASS: No temporary live catalogue records remain.",
);

await prisma.$disconnect();
TS

echo
echo "=== VERIFY NO TEST SERVER REMAINS ==="

if ps -ef |
  grep -E \
    '[n]ode_modules/next/dist/bin/next start' \
  >/tmp/sorvyra-live-catalog-server-check.txt
then
  echo "A temporary Next.js server remains:"
  cat /tmp/sorvyra-live-catalog-server-check.txt
  exit 1
fi

echo "PASS: No temporary test server remains."

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "Detailed validation log:"
echo "$DETAIL_LOG"

echo
echo "PHASE 2F-D-A LIVE CATALOGUE CART INTEGRATION PASSED"
