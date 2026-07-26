import type {
  Metadata,
} from "next";

import StorefrontCheckoutPage from "@/components/checkout/storefront-checkout-page";
import {
  getStorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";

const storefront =
  getStorefrontCheckoutConfig(
    "ATI",
  );

export const metadata:
  Metadata = {
    title:
      "Secure Checkout | ATILOSZY",
    description:
      "Review and prepare your ATILOSZY order.",
  };

export default function CheckoutPage() {
  return (
    <StorefrontCheckoutPage
      storefront={storefront}
    />
  );
}
