import "server-only";

import type {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  cartSessionRequiredResponse,
  readCheckoutApiSession,
  requireCheckoutStorefrontCode,
} from "@/server/checkout/http";

import {
  PaymentServiceError,
} from "../errors";
import {
  paymentApiErrorResponse,
  paymentJsonResponse,
  toPublicProductPaymentView,
} from "../http";
import type {
  ReconcileProductPaymentInput,
} from "../types";
import {
  isPaymentReconciliationError,
} from "./errors";
import type {
  PaymentReconciliationResult,
} from "./types";

export interface PaymentReconciliationRouteContext {
  params: Promise<{
    orderNumber: string;
  }>;
}

export type PaymentReconciliationHandler =
  (
    input:
      ReconcileProductPaymentInput,
  ) => Promise<
    PaymentReconciliationResult
  >;

async function reconcileWithDefaultService(
  input:
    ReconcileProductPaymentInput,
): Promise<
  PaymentReconciliationResult
> {
  const {
    reconcileStoredProductPayment,
  } =
    await import("./service");

  return reconcileStoredProductPayment(
    input,
  );
}

function assertReconciliationBody(
  body:
    Record<string, unknown>,
): void {
  const submittedFields =
    Object.keys(body);

  if (
    submittedFields.some(
      (field) =>
        field !==
        "storefrontCode",
    )
  ) {
    throw new PaymentServiceError(
      "VALIDATION",
      "Payment provider, reference, amount, currency and status are controlled by the server.",
    );
  }
}

function addRetryAfter(
  response: NextResponse,
  retryAfterSeconds: number,
): NextResponse {
  if (
    retryAfterSeconds > 0
  ) {
    response.headers.set(
      "Retry-After",
      retryAfterSeconds
        .toString(),
    );
  }

  return response;
}

export async function handleProductPaymentReconciliation(
  request: NextRequest,
  context:
    PaymentReconciliationRouteContext,
  reconcile:
    PaymentReconciliationHandler =
      reconcileWithDefaultService,
): Promise<NextResponse> {
  try {
    assertTrustedOrigin(
      request,
    );

    const body =
      await readJsonObject(
        request,
      );

    assertReconciliationBody(
      body,
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

    const result =
      await reconcile({
        storefrontCode,
        userId:
          session.userId,
        orderNumber,
      });

    const payload = {
      ok:
        result.disposition !==
        "RATE_LIMITED",
      payment:
        toPublicProductPaymentView(
          result.payment,
        ),
      reconciliation: {
        disposition:
          result.disposition,
        checkedAt:
          result.checkedAt,
        retryAfterSeconds:
          result
            .retryAfterSeconds,
      },
    };

    const response =
      paymentJsonResponse(
        payload,
        result.disposition ===
          "RATE_LIMITED"
          ? 429
          : 200,
      );

    return addRetryAfter(
      response,
      result.retryAfterSeconds,
    );
  } catch (error) {
    if (
      isPaymentReconciliationError(
        error,
      )
    ) {
      return addRetryAfter(
        paymentJsonResponse(
          {
            ok: false,
            error: {
              code:
                error.code,
              message:
                error.message,
            },
          },
          error.status,
        ),
        error.retryAfterSeconds ??
          0,
      );
    }

    return paymentApiErrorResponse(
      error,
    );
  }
}
