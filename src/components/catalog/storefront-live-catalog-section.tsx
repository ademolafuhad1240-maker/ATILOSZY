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
                <div
                  className={
                    styles.productMedia
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
