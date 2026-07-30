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

        <div
          className={
            styles.productHeroMedia
          }
          style={
            product.primaryImageUrl
              ? {
                  backgroundImage: `url("${product.primaryImageUrl.replace(/"/gu, "%22")}")`,
                }
              : undefined
          }
          role={
            product.primaryImageUrl
              ? "img"
              : undefined
          }
          aria-label={
            product.primaryImageUrl
              ? product.name
              : undefined
          }
        >
          {!product.primaryImageUrl
            ? (
                product.name
                  .trim()
                  .charAt(0)
                  .toUpperCase() ||
                "S"
              )
            : null}
        </div>

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
