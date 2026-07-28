import type {
  StorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";

import StorefrontOrders from "./storefront-orders";

export default function StorefrontOrdersPage({
  storefront,
}: {
  storefront:
    StorefrontCheckoutConfig;
}) {
  return (
    <StorefrontOrders
      storefront={storefront}
    />
  );
}
