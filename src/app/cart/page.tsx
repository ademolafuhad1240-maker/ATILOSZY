import type {
  Metadata,
} from "next";

import StorefrontCartSelector from "../../components/cart/storefront-cart-selector";

export const metadata: Metadata = {
  title:
    "Choose a Storefront Cart | SORVYRA STORE",
  description:
    "Open the secure cart for the SORVYRA storefront where you are shopping.",
};

export default function CartPage() {
  return (
    <StorefrontCartSelector />
  );
}
