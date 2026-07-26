import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  cancelPendingCheckoutOrder,
} from "@/server/checkout";
import {
  cartSessionRequiredResponse,
  checkoutApiErrorResponse,
  checkoutJsonResponse,
  optionalCheckoutString,
  readCheckoutApiSession,
  requireCheckoutStorefrontCode,
} from "@/server/checkout/http";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

interface RouteContext {
  params: Promise<{
    orderNumber: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    assertTrustedOrigin(
      request,
    );

    const body =
      await readJsonObject(
        request,
      );

    const storefrontCode =
      requireCheckoutStorefrontCode(
        body.storefrontCode,
      );

    const session =
      await readCheckoutApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return cartSessionRequiredResponse();
    }

    const {
      orderNumber,
    } = await context.params;

    const order =
      await cancelPendingCheckoutOrder(
        {
          storefrontCode,
          userId:
            session.userId,
          orderNumber,
          reason:
            optionalCheckoutString(
              body,
              "reason",
              "Cancellation reason",
              500,
            ),
        },
      );

    return checkoutJsonResponse({
      order,
    });
  } catch (error) {
    return checkoutApiErrorResponse(
      error,
    );
  }
}
