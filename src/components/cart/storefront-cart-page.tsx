import {
  getOrCreateActiveCart,
} from "../../server/cart";
import {
  requireStorefrontSession,
} from "../../server/auth/page-session";
import {
  toPublicCartView,
} from "../../server/cart/presentation";
import type {
  StorefrontAuthConfig,
} from "../../lib/storefront-auth";

import {
  StorefrontCart,
} from "./storefront-cart";

export async function StorefrontCartPage({
  storefront,
}: {
  storefront: StorefrontAuthConfig;
}) {
  const session =
    await requireStorefrontSession(
      storefront.code,
      storefront.loginHref,
    );

  const cart =
    await getOrCreateActiveCart({
      storefrontCode:
        storefront.code,
      userId: session.userId,
    });

  return (
    <StorefrontCart
      storefront={storefront}
      initialCart={
        toPublicCartView(cart)
      }
    />
  );
}
