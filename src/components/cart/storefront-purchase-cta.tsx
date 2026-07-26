import Link from "next/link";

import styles from "./storefront-purchase-cta.module.css";

export default function StorefrontPurchaseCta({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <aside
      className={
        compact
          ? styles.compact
          : styles.panel
      }
      data-storefront-purchase-cta
    >
      <div>
        <p
          className={
            styles.eyebrow
          }
        >
          SORVYRA discovery
        </p>

        <p
          className={
            styles.message
          }
        >
          This preview is not connected
          to verified live inventory yet.
          Choose an owned storefront to
          view current products, prices
          and availability.
        </p>
      </div>

      <Link
        className={styles.link}
        href="/cart"
      >
        Choose a storefront
      </Link>
    </aside>
  );
}
