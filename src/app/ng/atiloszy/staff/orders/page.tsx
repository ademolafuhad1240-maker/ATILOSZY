import type {
  Metadata,
} from "next";

import StorefrontOrdersPage from "@/components/operations/storefront-orders-page";
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
      "Staff Orders | ATILOSZY",
    description:
      "Private ATILOSZY order operations.",
  };

export default function StaffOrdersPage() {
  return (
    <StorefrontOrdersPage
      storefront={storefront}
    />
  );
}
