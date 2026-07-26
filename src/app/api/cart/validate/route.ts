import type {
  NextRequest,
} from "next/server";

import {
  validateActiveCart,
} from "../../../../server/cart";
import {
  authJsonResponse,
} from "../../../../server/auth/http";
import {
  cartApiErrorResponse,
  cartSessionRequiredResponse,
  readCartApiSession,
  requireStorefrontCode,
} from "../../../../server/cart/http";
import {
  toPublicCartValidation,
} from "../../../../server/cart/presentation";

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

    const validation =
      await validateActiveCart({
        storefrontCode,
        userId: session.userId,
      });

    return authJsonResponse({
      ok: true,
      data: {
        validation:
          toPublicCartValidation(
            validation,
          ),
      },
    });
  } catch (error) {
    return cartApiErrorResponse(
      error,
    );
  }
}
