"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  PublicCatalogVariant,
} from "../../server/catalog/types";
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
      currency: currencyCode,
    },
  ).format(Number(amount));
}

function optionValue(
  variant: PublicCatalogVariant,
  optionName: string,
): string | null {
  return variant.options.find(
    (option) => option.name === optionName,
  )?.value ?? null;
}

function sentenceList(values: readonly string[]): string {
  if (values.length === 0) {
    return "options";
  }

  if (values.length === 1) {
    return values[0]!.toLocaleLowerCase();
  }

  return `${values
    .slice(0, -1)
    .map((value) => value.toLocaleLowerCase())
    .join(", ")} and ${values.at(-1)!.toLocaleLowerCase()}`;
}

export default function StorefrontProductVariantSelector({
  storefrontCode,
  variants,
  loginHref,
  cartHref,
}: {
  storefrontCode: string;
  variants: readonly PublicCatalogVariant[];
  loginHref: string;
  cartHref: string;
}) {
  const optionNames = useMemo(
    () =>
      Array.from(
        new Set(
          variants.flatMap((variant) =>
            variant.options.map((option) => option.name),
          ),
        ),
      ),
    [variants],
  );
  const [selections, setSelections] = useState<
    Record<string, string>
  >({});
  const [fallbackVariantId, setFallbackVariantId] = useState("");

  const optionValues = useMemo(
    () =>
      Object.fromEntries(
        optionNames.map((name) => [
          name,
          Array.from(
            new Set(
              variants.flatMap((variant) => {
                const value = optionValue(variant, name);
                return value ? [value] : [];
              }),
            ),
          ),
        ]),
      ) as Record<string, string[]>,
    [optionNames, variants],
  );

  const selectedVariant = useMemo(() => {
    if (optionNames.length > 0) {
      const selectionComplete = optionNames.every(
        (name) => Boolean(selections[name]),
      );

      if (!selectionComplete) {
        return null;
      }

      return (
        variants.find((variant) =>
          optionNames.every(
            (name) =>
              optionValue(variant, name) === selections[name],
          ),
        ) ?? null
      );
    }

    if (variants.length === 1) {
      return variants[0] ?? null;
    }

    return (
      variants.find((variant) => variant.id === fallbackVariantId) ??
      null
    );
  }, [fallbackVariantId, optionNames, selections, variants]);

  const selectionLabel = sentenceList(optionNames);

  return (
    <section
      className={styles.variantSelector}
      aria-label="Choose product options"
      data-product-variant-selector
    >
      <div className={styles.variantIntro}>
        <h2>
          {optionNames.length > 0
            ? `Choose your ${selectionLabel}`
            : "Review your product choice"}
        </h2>
        <p>
          {optionNames.length > 0
            ? `Select the exact ${selectionLabel} combination before adding it to your secure cart. Price and stock are checked for the selected option.`
            : "Review the price and current availability before adding this product to your secure cart."}
        </p>
      </div>

      {optionNames.length > 0 ? (
        <div className={styles.selectorPanel}>
          <div className={styles.selectGrid}>
            {optionNames.map((name) => (
              <label className={styles.optionSelectLabel} key={name}>
                <span>{name}</span>
                <select
                  className={styles.optionSelect}
                  value={selections[name] ?? ""}
                  data-variant-option={name.toLocaleLowerCase()}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelections((current) => ({
                      ...current,
                      [name]: value,
                    }));
                  }}
                >
                  <option value="">
                    Select {name.toLocaleLowerCase()}
                  </option>
                  {(optionValues[name] ?? []).map((value) => {
                    const combinationAvailable = variants.some(
                      (variant) =>
                        variant.isInStock &&
                        optionValue(variant, name) === value &&
                        optionNames.every(
                          (otherName) =>
                            otherName === name ||
                            !selections[otherName] ||
                            optionValue(variant, otherName) ===
                              selections[otherName],
                        ),
                    );

                    return (
                      <option
                        disabled={!combinationAvailable}
                        key={value}
                        value={value}
                      >
                        {value}
                        {!combinationAvailable ? " — unavailable" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : variants.length > 1 ? (
        <div className={styles.selectorPanel}>
          <label className={styles.optionSelectLabel}>
            <span>Product option</span>
            <select
              className={styles.optionSelect}
              value={fallbackVariantId}
              data-variant-option="product-option"
              onChange={(event) => setFallbackVariantId(event.target.value)}
            >
              <option value="">Select an option</option>
              {variants.map((variant) => (
                <option
                  disabled={!variant.isInStock}
                  key={variant.id}
                  value={variant.id}
                >
                  {variant.title}
                  {!variant.isInStock ? " — unavailable" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {selectedVariant ? (
        <article
          className={styles.variantCard}
          data-product-variant-id={selectedVariant.id}
        >
          <div>
            <p className={styles.category}>SKU {selectedVariant.sku}</p>
            <h3 className={styles.productName}>{selectedVariant.title}</h3>
          </div>

          {selectedVariant.options.length > 0 ? (
            <ul className={styles.optionList}>
              {selectedVariant.options.map((option) => (
                <li
                  className={styles.option}
                  key={`${option.name}:${option.value}`}
                >
                  {option.name}: {option.value}
                </li>
              ))}
            </ul>
          ) : null}

          <p className={styles.price}>
            {formatMoney(
              selectedVariant.price.amount,
              selectedVariant.price.currencyCode,
            )}
            {selectedVariant.price.compareAtAmount ? (
              <span className={styles.comparePrice}>
                {formatMoney(
                  selectedVariant.price.compareAtAmount,
                  selectedVariant.price.currencyCode,
                )}
              </span>
            ) : null}
          </p>

          <p className={styles.stock}>
            Price per {selectedVariant.sellingUnitLabel}
            {selectedVariant.unitsPerSellingUnit > 1
              ? ` (${selectedVariant.unitsPerSellingUnit} pieces)`
              : ""}
          </p>

          {selectedVariant.quantityPriceTiers.length > 0 ? (
            <ul className={styles.optionList}>
              {selectedVariant.quantityPriceTiers.map((tier) => (
                <li className={styles.option} key={tier.minimumQuantity}>
                  Buy {tier.minimumQuantity}+ {selectedVariant.sellingUnitLabel}: {" "}
                  {formatMoney(
                    tier.unitAmount,
                    selectedVariant.price.currencyCode,
                  )} each
                </li>
              ))}
            </ul>
          ) : null}

          <p className={styles.stock}>
            {selectedVariant.availableQuantity === null
              ? "Availability confirmed before checkout"
              : selectedVariant.isInStock
                ? `${selectedVariant.availableQuantity} currently available`
                : "Currently out of stock"}
          </p>

          <AuthenticatedAddToCartButton
            key={selectedVariant.id}
            storefrontCode={storefrontCode}
            productVariantId={selectedVariant.id}
            loginHref={loginHref}
            cartHref={cartHref}
            availableQuantity={selectedVariant.availableQuantity}
            allowBackorder={selectedVariant.allowBackorder}
            sellingUnitLabel={selectedVariant.sellingUnitLabel}
            disabled={!selectedVariant.isInStock}
          />
        </article>
      ) : (
        <p className={styles.selectionPrompt} role="status">
          Select {selectionLabel} to see the exact price, stock and cart
          controls.
        </p>
      )}
    </section>
  );
}
