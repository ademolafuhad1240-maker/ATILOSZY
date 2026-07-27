import type {
  NextRequest,
} from "next/server";

import {
  handleProductPaymentReconciliation,
  type PaymentReconciliationRouteContext,
} from "@/server/payments/reconciliation";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: NextRequest,
  context:
    PaymentReconciliationRouteContext,
) {
  return handleProductPaymentReconciliation(
    request,
    context,
  );
}
