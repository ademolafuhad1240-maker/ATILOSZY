import type {
  StorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";

import StorefrontOrder from "./storefront-order";

export default function StorefrontOrderPage({
  storefront,
  orderNumber,
}: {
  storefront:
    StorefrontCheckoutConfig;
  orderNumber: string;
}) {
  return (
    <StorefrontOrder
      storefront={storefront}
      orderNumber={orderNumber}
    />
  );
}
