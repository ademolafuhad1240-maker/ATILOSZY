import type {
  NextRequest,
} from "next/server";

import {
  handleProductPaymentInitiation,
  type PaymentInitiationRouteContext,
} from "@/server/payments/http";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: NextRequest,
  context:
    PaymentInitiationRouteContext,
) {
  return handleProductPaymentInitiation(
    request,
    context,
  );
}
