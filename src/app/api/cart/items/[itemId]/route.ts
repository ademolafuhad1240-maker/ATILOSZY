import type {
  NextRequest,
} from "next/server";

import {
  removeCartItem,
  updateCartItemQuantity,
} from "../../../../../server/cart";
import {
  assertTrustedOrigin,
  authJsonResponse,
  readJsonObject,
  requiredString,
} from "../../../../../server/auth/http";
import {
  cartApiErrorResponse,
  cartSessionRequiredResponse,
  readCartApiSession,
  requiredIntegerField,
  requireStorefrontCode,
} from "../../../../../server/cart/http";
import {
  toPublicCartView,
} from "../../../../../server/cart/presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CartItemRouteContext {
  params: Promise<{
    itemId: string;
  }>;
}

export async function PATCH(
  request: NextRequest,
  context: CartItemRouteContext,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requireStorefrontCode(
        requiredString(
          body,
          "storefrontCode",
          {
            maxLength: 12,
          },
        ),
      );

    const session =
      await readCartApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const {
      itemId,
    } = await context.params;

    const cart =
      await updateCartItemQuantity({
        storefrontCode,
        userId: session.userId,
        cartItemId: itemId,
        quantity:
          requiredIntegerField(
            body,
            "quantity",
          ),
      });

    return authJsonResponse({
      ok: true,
      data: {
        cart:
          toPublicCartView(cart),
      },
    });
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: CartItemRouteContext,
) {
  try {
    assertTrustedOrigin(request);

    const body =
      await readJsonObject(request);

    const storefrontCode =
      requireStorefrontCode(
        requiredString(
          body,
          "storefrontCode",
          {
            maxLength: 12,
          },
        ),
      );

    const session =
      await readCartApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const {
      itemId,
    } = await context.params;

    const cart =
      await removeCartItem({
        storefrontCode,
        userId: session.userId,
        cartItemId: itemId,
      });

    return authJsonResponse({
      ok: true,
      data: {
        cart:
          toPublicCartView(cart),
      },
    });
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}
