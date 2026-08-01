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

  const galleryImages =
    product.images.length > 0
      ? product.images
      : product.primaryImageUrl
        ? [
            {
              id: "primary",
              url:
                product.primaryImageUrl,
              altText:
                product.name,
              isPrimary: true,
              position: 1,
            },
          ]
        : [];
  const primaryImage =
    galleryImages[0] ?? null;

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

        <section
          className={
            styles.productGallery
          }
          aria-label={`${product.name} photos`}
        >
          <div
            className={
              styles.productHeroMedia
            }
            style={
              primaryImage
                ? {
                    backgroundImage: `url("${primaryImage.url.replace(/"/gu, "%22")}")`,
                  }
                : undefined
            }
            role={
              primaryImage
                ? "img"
                : undefined
            }
            aria-label={
              primaryImage
                ? primaryImage
                    .altText ??
                  product.name
                : undefined
            }
          >
            {!primaryImage
              ? (
                  product.name
                    .trim()
                    .charAt(0)
                    .toUpperCase() ||
                  "S"
                )
              : null}
          </div>

          {galleryImages.length >
          1 ? (
            <div
              className={
                styles.productThumbnails
              }
            >
              {galleryImages
                .slice(1)
                .map(
                  (image) => (
                    <div
                      className={
                        styles.productThumbnail
                      }
                      key={image.id}
                      style={{
                        backgroundImage: `url("${image.url.replace(/"/gu, "%22")}")`,
                      }}
                      role="img"
                      aria-label={
                        image.altText ??
                        product.name
                      }
                    />
                  ),
                )}
            </div>
          ) : null}
        </section>

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
          <div className={styles.variantIntro}>
            <h2>Choose your size and colour</h2>
            <p>
              Select the exact available combination before adding it to your
              secure cart. Price and stock are checked for that variant.
            </p>
          </div>
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

                <p className={styles.stock}>
                  Price per {variant.sellingUnitLabel}
                  {variant.unitsPerSellingUnit > 1
                    ? ` (${variant.unitsPerSellingUnit} pieces)`
                    : ""}
                </p>

                {variant.quantityPriceTiers.length > 0 ? (
                  <ul className={styles.optionList}>
                    {variant.quantityPriceTiers.map((tier) => (
                      <li className={styles.option} key={tier.minimumQuantity}>
                        Buy {tier.minimumQuantity}+ {variant.sellingUnitLabel}: {" "}
                        {formatMoney(
                          tier.unitAmount,
                          variant.price.currencyCode,
                        )} each
                      </li>
                    ))}
                  </ul>
                ) : null}

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
                  sellingUnitLabel={
                    variant.sellingUnitLabel
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
