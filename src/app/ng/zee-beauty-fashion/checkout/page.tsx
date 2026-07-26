import type {
  Metadata,
} from "next";

import StorefrontCheckoutPage from "@/components/checkout/storefront-checkout-page";
import {
  getStorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";

const storefront =
  getStorefrontCheckoutConfig(
    "ZBF",
  );

export const metadata:
  Metadata = {
    title:
      "Secure Checkout | ZEE Beauty & Fashion",
    description:
      "Review and prepare your ZEE Beauty & Fashion order.",
  };

export default function CheckoutPage() {
  return (
    <StorefrontCheckoutPage
      storefront={storefront}
    />
  );
}
