import type {
  NextRequest,
} from "next/server";

import {
  OrderFulfilmentMethod,
} from "@/generated/prisma/client";
import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  createCheckoutOrder,
} from "@/server/checkout";
import {
  cartSessionRequiredResponse,
  checkoutApiErrorResponse,
  checkoutJsonResponse,
  optionalCheckoutAddress,
  optionalCheckoutString,
  readCheckoutApiSession,
  requireCheckoutStorefrontCode,
  requiredCheckoutString,
} from "@/server/checkout/http";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: NextRequest,
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

    const order =
      await createCheckoutOrder({
        storefrontCode,
        userId:
          session.userId,
        cartId:
          requiredCheckoutString(
            body,
            "cartId",
            "Cart",
          ),
        fulfilmentMethod:
          requiredCheckoutString(
            body,
            "fulfilmentMethod",
            "Fulfilment method",
            60,
          ) as
            OrderFulfilmentMethod,
        deliveryAddress:
          optionalCheckoutAddress(
            body,
            "deliveryAddress",
          ),
        billingAddress:
          optionalCheckoutAddress(
            body,
            "billingAddress",
          ),
        customerNote:
          optionalCheckoutString(
            body,
            "customerNote",
            "Customer note",
            1000,
          ),
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
