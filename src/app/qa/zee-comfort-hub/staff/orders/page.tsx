import type {
  Metadata,
} from "next";

import StorefrontOrdersPage from "@/components/operations/storefront-orders-page";
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
      "Staff Orders | Zee COMFORT HUB",
    description:
      "Private Zee COMFORT HUB order operations.",
  };

export default function StaffOrdersPage() {
  return (
    <StorefrontOrdersPage
      storefront={storefront}
    />
  );
}
