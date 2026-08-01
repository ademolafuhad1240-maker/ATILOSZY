import styles from "./sorvyra-logo.module.css";

type SorvyraLogoProps = {
  className?: string;
  size?: "compact" | "default" | "large";
  subtitle?: string;
  tone?: "dark" | "light";
};

export default function SorvyraLogo({
  className,
  size = "default",
  subtitle = "Multi-brand commerce",
  tone = "light",
}: SorvyraLogoProps) {
  return (
    <span
      className={[
        styles.logo,
        styles[size],
        styles[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={styles.mark}
        aria-hidden="true"
      >
        <span className={styles.markS}>
          S
        </span>
        <span className={styles.markV}>
          V
        </span>
      </span>

      <span className={styles.copy}>
        <span className={styles.wordmark}>
          <span className={styles.name}>
            SORVYRA
          </span>
          <span
            className={styles.divider}
            aria-hidden="true"
          />
          <span className={styles.store}>
            STORE
          </span>
        </span>
        <span className={styles.subtitle}>
          {subtitle}
        </span>
      </span>
    </span>
  );
}
