import type {
  NextRequest,
} from "next/server";

import {
  handlePaymentWebhook,
  resolvePaymentWebhookProvider,
} from "@/server/payments/webhooks";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  return handlePaymentWebhook(
    request,
    () =>
      resolvePaymentWebhookProvider(
        "paystack",
      ),
  );
}
