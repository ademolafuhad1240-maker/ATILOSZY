import {
  StorefrontCartPage,
} from "../../../../components/cart/storefront-cart-page";
import {
  getStorefrontAuthConfig,
} from "../../../../lib/storefront-auth";

export const dynamic =
  "force-dynamic";

const storefront =
  getStorefrontAuthConfig("ZCH");

export default function CartPage() {
  return (
    <StorefrontCartPage
      storefront={storefront}
    />
  );
}
