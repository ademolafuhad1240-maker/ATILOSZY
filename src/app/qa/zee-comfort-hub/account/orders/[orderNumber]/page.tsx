import StorefrontOrderPage from "@/components/orders/storefront-order-page";
import {
  getStorefrontCheckoutConfig,
} from "@/lib/storefront-checkout";

const storefront =
  getStorefrontCheckoutConfig(
    "ZCH",
  );

interface PageProps {
  params: Promise<{
    orderNumber: string;
  }>;
}

export default async function OrderPage({
  params,
}: PageProps) {
  const {
    orderNumber,
  } = await params;

  return (
    <StorefrontOrderPage
      storefront={storefront}
      orderNumber={orderNumber}
    />
  );
}
