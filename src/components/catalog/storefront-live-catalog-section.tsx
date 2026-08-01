import Link from "next/link";

import {
  getPublicStorefrontCatalogue,
} from "../../server/catalog";
import {
  getStorefrontCatalogConfig,
  type StorefrontCatalogConfig,
} from "../../lib/storefront-catalog";

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
      id="products"
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
            Current collection
          </p>

          <h2
            className={
              styles.heading
            }
          >
            Shop {storefront.shortName}
          </h2>

          <p
            className={
              styles.description
            }
          >
            Every product shown here is published by the{" "}
            {storefront.shortName} manager. Prices, options and stock
            are checked again before an item enters this storefront&apos;s
            cart.
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
          No products have been published for this storefront yet. New
          active products will appear here automatically after the
          storefront manager adds them to the catalogue.
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
                        {product.variants.length > 1
                          ? `${product.variants.length} options available`
                          : variant.options.length > 0
                            ? variant.options
                                .map(
                                  (option) =>
                                    `${option.name}: ${option.value}`,
                                )
                                .join(" · ")
                            : variant.title}
                      </p>

                      <p className={styles.stock}>
                        Per {variant.sellingUnitLabel}
                        {variant.unitsPerSellingUnit > 1
                          ? ` (${variant.unitsPerSellingUnit} pieces)`
                          : ""}
                      </p>

                      {product.variants.length === 1 &&
                      variant.quantityPriceTiers[0] ? (
                        <p className={styles.stock}>
                          Buy {variant.quantityPriceTiers[0].minimumQuantity}+ at {" "}
                          {formatMoney(
                            variant.quantityPriceTiers[0].unitAmount,
                            variant.price.currencyCode,
                          )} each
                        </p>
                      ) : null}

                      <p
                        className={
                          styles.price
                        }
                      >
                        {product.variants.length > 1 ? "From " : ""}
                        {formatMoney(
                          Math.min(
                            ...product.variants.map((candidate) =>
                              Number(candidate.price.amount),
                            ),
                          ).toFixed(2),
                          variant.price
                            .currencyCode,
                        )}

                        {product.variants.length === 1 &&
                        variant.price.compareAtAmount ? (
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
                        {product.variants.length > 1
                          ? "Availability shown after selection"
                          : variant.availableQuantity === null
                            ? "Availability confirmed at checkout"
                            : variant.isInStock
                              ? `${variant.availableQuantity} available`
                              : "Currently out of stock"}
                      </p>
                    </div>

                    <Link className={styles.chooseVariant} href={detailHref}>
                      View product &amp; choose options
                    </Link>
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

              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
