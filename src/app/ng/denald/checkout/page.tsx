import type {
  Metadata,
} from "next";

import StorefrontCheckoutPage from "@/components/checkout/storefront-checkout-page";
import {
  getStorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";

const storefront =
  getStorefrontCheckoutConfig(
    "DEN",
  );

export const metadata:
  Metadata = {
    title:
      "Secure Checkout | DENALD",
    description:
      "Review and prepare your DENALD product or installation order.",
  };

export default function CheckoutPage() {
  return (
    <StorefrontCheckoutPage
      storefront={storefront}
    />
  );
}
