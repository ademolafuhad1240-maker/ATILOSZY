import {
  randomBytes,
} from "node:crypto";

import {
  CheckoutServiceError,
} from "./errors";

export function generateOrderNumber(
  storefrontCode: string,
): string {
  const normalized =
    storefrontCode
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{3}$/.test(
      normalized,
    )
  ) {
    throw new CheckoutServiceError(
      "VALIDATION",
      "A valid storefront code is required to generate an order number.",
    );
  }

  const randomPart =
    randomBytes(10)
      .toString("hex")
      .toUpperCase();

  return `${normalized}-${randomPart}`;
}
