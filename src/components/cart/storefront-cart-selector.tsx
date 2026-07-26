import Link from "next/link";

import {
  getStorefrontCatalogConfig,
  type StorefrontCatalogConfig,
} from "../../lib/storefront-catalog";

import styles from "./storefront-cart-selector.module.css";

const storefrontCodes:
  StorefrontCatalogConfig["code"][] = [
    "ATI",
    "ZBF",
    "DEN",
    "ZCH",
  ];

const descriptions:
  Record<
    StorefrontCatalogConfig["code"],
    string
  > = {
    ATI:
      "Shoes, household products, gadgets and everyday essentials in Nigeria.",
    ZBF:
      "Beauty, fashion, personal care and household essentials in Nigeria.",
    DEN:
      "Solar, CCTV, computers and technical equipment in Nigeria.",
    ZCH:
      "Women’s comfort fashion, sleepwear and everyday essentials in Qatar.",
  };

export default function StorefrontCartSelector() {
  const storefronts =
    storefrontCodes.map(
      getStorefrontCatalogConfig,
    );

  return (
    <main
      className={styles.page}
      data-secure-cart-selector
    >
      <div className={styles.shell}>
        <header
          className={
            styles.header
          }
        >
          <p
            className={
              styles.eyebrow
            }
          >
            SORVYRA STORE
          </p>

          <h1
            className={
              styles.title
            }
          >
            Choose your storefront cart
          </h1>

          <p
            className={
              styles.description
            }
          >
            Every SORVYRA business has
            its own account, currency,
            catalogue and secure cart.
            Select the store where you
            are shopping.
          </p>
        </header>

        <section
          className={styles.grid}
          aria-label="SORVYRA storefront carts"
        >
          {storefronts.map(
            (storefront) => (
              <article
                className={
                  styles.card
                }
                data-cart-selector-storefront={
                  storefront.code
                }
                key={
                  storefront.code
                }
              >
                <p
                  className={
                    styles.code
                  }
                >
                  {storefront.code}
                </p>

                <h2
                  className={
                    styles.storeName
                  }
                >
                  {storefront.name}
                </h2>

                <p
                  className={
                    styles.storeDescription
                  }
                >
                  {
                    descriptions[
                      storefront.code
                    ]
                  }
                </p>

                <div
                  className={
                    styles.actions
                  }
                >
                  <Link
                    className={
                      styles.primaryLink
                    }
                    href={
                      storefront.cartHref
                    }
                  >
                    Open secure cart
                  </Link>

                  <Link
                    className={
                      styles.secondaryLink
                    }
                    href={
                      storefront.shopHref
                    }
                  >
                    Browse store
                  </Link>
                </div>
              </article>
            ),
          )}
        </section>

        <aside
          className={styles.notice}
        >
          Products from one storefront
          cannot be added to another
          storefront’s cart. This protects
          prices, currency, inventory and
          customer accounts.
        </aside>
      </div>
    </main>
  );
}
