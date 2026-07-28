import type {
  Metadata,
} from "next";

import StorefrontOrdersPage from "@/components/operations/storefront-orders-page";
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
      "Staff Orders | ZEE Beauty & Fashion",
    description:
      "Private ZEE Beauty & Fashion order operations.",
  };

export default function StaffOrdersPage() {
  return (
    <StorefrontOrdersPage
      storefront={storefront}
    />
  );
}
