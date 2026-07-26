import type {
  NextRequest,
} from "next/server";

import {
  addCartItem,
} from "../../../../server/cart";
import {
  assertTrustedOrigin,
  authJsonResponse,
  readJsonObject,
  requiredString,
} from "../../../../server/auth/http";
import {
  cartApiErrorResponse,
  cartSessionRequiredResponse,
  readCartApiSession,
  requiredIntegerField,
  requireStorefrontCode,
} from "../../../../server/cart/http";
import {
  toPublicCartView,
} from "../../../../server/cart/presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
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

    const cart =
      await addCartItem({
        storefrontCode,
        userId: session.userId,
        productVariantId:
          requiredString(
            body,
            "productVariantId",
            {
              maxLength: 191,
            },
          ),
        quantity:
          requiredIntegerField(
            body,
            "quantity",
          ),
      });

    return authJsonResponse(
      {
        ok: true,
        data: {
          cart:
            toPublicCartView(cart),
        },
      },
      201,
    );
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}
