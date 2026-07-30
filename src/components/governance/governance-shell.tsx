import type {
  ReactNode,
} from "react";
import Link from "next/link";

import styles from "./governance.module.css";

export default function GovernanceShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div
      className={styles.shell}
      data-governance-shell
    >
      <header className={styles.header}>
        <Link
          href="/"
          className={styles.brand}
        >
          <span
            className={styles.brandMark}
            aria-hidden="true"
          >
            S
          </span>
          <span>
            <span
              className={styles.brandEyebrow}
            >
              Multi-brand commerce
            </span>
            <span
              className={styles.brandName}
            >
              SORVYRA STORE
            </span>
          </span>
        </Link>

        <nav
          className={styles.nav}
          aria-label="Governance navigation"
        >
          <Link href="/manager">
            Manager portal
          </Link>
          <Link href="/manager/catalogue">
            Catalogue
          </Link>
          <Link href="/manager/apply">
            Apply
          </Link>
          <Link href="/admin">
            Owner portal
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section
          className={styles.hero}
        >
          <span
            className={styles.eyebrow}
          >
            {eyebrow}
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>

        {children}
      </main>
    </div>
  );
}
