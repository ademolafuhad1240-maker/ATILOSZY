import type {
  StorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";

import StorefrontCheckout from "./storefront-checkout";

export default function StorefrontCheckoutPage({
  storefront,
}: {
  storefront:
    StorefrontCheckoutConfig;
}) {
  return (
    <StorefrontCheckout
      storefront={storefront}
    />
  );
}
