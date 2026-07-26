"use client";

import Link from "next/link";
import {
  useState,
} from "react";

import styles from "./authenticated-add-to-cart-button.module.css";

interface CartApiPayload {
  data?: {
    cart?: {
      itemCount?: number;
    };
  };
  error?: {
    message?: string;
  };
}

export default function AuthenticatedAddToCartButton({
  storefrontCode,
  productVariantId,
  loginHref,
  cartHref,
  availableQuantity,
  allowBackorder,
  disabled = false,
}: {
  storefrontCode: string;
  productVariantId: string;
  loginHref: string;
  cartHref: string;
  availableQuantity:
    | number
    | null;
  allowBackorder: boolean;
  disabled?: boolean;
}) {
  const [
    quantity,
    setQuantity,
  ] = useState(1);

  const [
    pending,
    setPending,
  ] = useState(false);

  const [
    added,
    setAdded,
  ] = useState(false);

  const [
    authenticationRequired,
    setAuthenticationRequired,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const maximum =
    availableQuantity === null ||
    allowBackorder
      ? 999
      : Math.max(
          availableQuantity,
          1,
        );

  async function addToCart(): Promise<void> {
    setPending(true);
    setAdded(false);
    setAuthenticationRequired(
      false,
    );
    setError(null);

    try {
      const response = await fetch(
        "/api/cart/items",
        {
          method: "POST",
          credentials:
            "same-origin",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            storefrontCode,
            productVariantId,
            quantity,
          }),
        },
      );

      let payload:
        CartApiPayload = {};

      try {
        payload =
          await response.json() as
            CartApiPayload;
      } catch {
        payload = {};
      }

      if (response.status === 401) {
        setAuthenticationRequired(
          true,
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
          "The product could not be added to your cart.",
        );
      }

      setAdded(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The product could not be added to your cart.",
      );
    } finally {
      setPending(false);
    }
  }

  const unavailable =
    disabled ||
    (
      availableQuantity !== null &&
      availableQuantity < 1 &&
      !allowBackorder
    );

  return (
    <div
      className={styles.wrapper}
      data-server-cart-button={
        productVariantId
      }
    >
      <div
        className={
          styles.controls
        }
      >
        <label
          className={
            styles.quantityLabel
          }
        >
          <span>Quantity</span>

          <input
            className={
              styles.quantityInput
            }
            type="number"
            min={1}
            max={maximum}
            value={quantity}
            disabled={
              unavailable ||
              pending
            }
            onChange={(event) => {
              const nextValue =
                Number(
                  event.target.value,
                );

              if (
                Number.isSafeInteger(
                  nextValue,
                ) &&
                nextValue >= 1
              ) {
                setQuantity(
                  Math.min(
                    nextValue,
                    maximum,
                  ),
                );
              }
            }}
          />
        </label>

        <button
          className={
            styles.button
          }
          type="button"
          disabled={
            unavailable ||
            pending
          }
          onClick={() =>
            void addToCart()
          }
        >
          {unavailable
            ? "Out of stock"
            : pending
              ? "Adding…"
              : "Add to cart"}
        </button>
      </div>

      {authenticationRequired ? (
        <p
          className={
            styles.notice
          }
          role="status"
        >
          Sign in to this storefront
          before adding products.{" "}
          <Link href={loginHref}>
            Sign in
          </Link>
        </p>
      ) : null}

      {added ? (
        <p
          className={
            styles.success
          }
          role="status"
        >
          Added to your secure
          storefront cart.{" "}
          <Link href={cartHref}>
            View cart
          </Link>
        </p>
      ) : null}

      {error ? (
        <p
          className={
            styles.error
          }
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
