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
import StorefrontProductVariantSelector from "./storefront-product-variant-selector";

import styles from "./live-catalog.module.css";

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

        <StorefrontProductVariantSelector
          storefrontCode={storefront.code}
          variants={product.variants}
          loginHref={storefront.loginHref}
          cartHref={storefront.cartHref}
        />
      </div>
    </main>
  );
}
