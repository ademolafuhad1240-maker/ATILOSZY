import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  adjustManagedCatalogStock,
} from "@/server/catalog";
import {
  assertOnlyCatalogFields,
  catalogApiErrorResponse,
  catalogJsonResponse,
  catalogSessionRequiredResponse,
  optionalCatalogString,
  readCatalogApiSession,
  requireCatalogIdentifier,
  requireCatalogInteger,
  requireCatalogStorefrontCode,
  requireCatalogString,
  requireStockMovementType,
  stockAdjustmentFields,
} from "@/server/catalog/http";

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{
      storefrontProductId:
        string;
    }>;
  },
) {
  try {
    assertTrustedOrigin(request);
    const body =
      await readJsonObject(
        request,
      );
    assertOnlyCatalogFields(
      body,
      stockAdjustmentFields,
    );

    const storefrontCode =
      requireCatalogStorefrontCode(
        body.storefrontCode,
      );
    const session =
      await readCatalogApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return catalogSessionRequiredResponse();
    }

    const params =
      await context.params;
    const inventory =
      await adjustManagedCatalogStock({
        storefrontCode,
        userId: session.userId,
        storefrontProductId:
          requireCatalogIdentifier(
            params
              .storefrontProductId,
          ),
        variantId:
          optionalCatalogString(
            body,
            "variantId",
            191,
          ),
        quantityDelta:
          requireCatalogInteger(
            body,
            "quantityDelta",
          ),
        type:
          requireStockMovementType(
            body,
          ),
        reason:
          requireCatalogString(
            body,
            "reason",
            500,
          ),
      });

    return catalogJsonResponse({
      ok: true,
      data: {
        inventory,
      },
    });
  } catch (error) {
    return catalogApiErrorResponse(
      error,
    );
  }
}
