import type {
  Metadata,
} from "next";

import StorefrontCheckoutPage from "@/components/checkout/storefront-checkout-page";
import {
  getStorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";

const storefront =
  getStorefrontCheckoutConfig(
    "ZCH",
  );

export const metadata:
  Metadata = {
    title:
      "Secure Checkout | Zee COMFORT HUB",
    description:
      "Review and prepare your Zee COMFORT HUB order.",
  };

export default function CheckoutPage() {
  return (
    <StorefrontCheckoutPage
      storefront={storefront}
    />
  );
}
