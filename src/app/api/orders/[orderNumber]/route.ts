import type {
  NextRequest,
} from "next/server";

import {
  getCheckoutOrder,
} from "@/server/checkout";
import {
  cartSessionRequiredResponse,
  checkoutApiErrorResponse,
  checkoutJsonResponse,
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

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const storefrontCode =
      requireCheckoutStorefrontCode(
        request.nextUrl
          .searchParams
          .get(
            "storefrontCode",
          ),
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
      await getCheckoutOrder({
        storefrontCode,
        userId:
          session.userId,
        orderNumber,
      });

    return checkoutJsonResponse({
      order,
    });
  } catch (error) {
    return checkoutApiErrorResponse(
      error,
    );
  }
}
