import type {
  NextRequest,
} from "next/server";

import {
  clearActiveCart,
  getOrCreateActiveCart,
} from "../../../server/cart";
import {
  assertTrustedOrigin,
  authJsonResponse,
  readJsonObject,
  requiredString,
} from "../../../server/auth/http";
import {
  cartApiErrorResponse,
  cartSessionRequiredResponse,
  readCartApiSession,
  requireStorefrontCode,
} from "../../../server/cart/http";
import {
  toPublicCartView,
} from "../../../server/cart/presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const storefrontCode =
      requireStorefrontCode(
        request.nextUrl
          .searchParams
          .get("storefrontCode"),
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
      await getOrCreateActiveCart({
        storefrontCode,
        userId: session.userId,
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
      await clearActiveCart({
        storefrontCode,
        userId: session.userId,
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
