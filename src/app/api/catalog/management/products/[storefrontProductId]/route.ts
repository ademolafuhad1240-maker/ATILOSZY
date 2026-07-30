import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  updateManagedCatalogProduct,
} from "@/server/catalog";
import {
  assertOnlyCatalogFields,
  catalogApiErrorResponse,
  catalogJsonResponse,
  catalogSessionRequiredResponse,
  productFieldsFromBody,
  readCatalogApiSession,
  requireCatalogIdentifier,
  requireCatalogStorefrontCode,
  updateProductFields,
} from "@/server/catalog/http";

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

export async function PATCH(
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
      updateProductFields,
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
    const updated =
      await updateManagedCatalogProduct({
        storefrontCode,
        userId: session.userId,
        storefrontProductId:
          requireCatalogIdentifier(
            params
              .storefrontProductId,
          ),
        ...productFieldsFromBody(
          body,
        ),
      });

    return catalogJsonResponse({
      ok: true,
      data: {
        product: updated,
      },
    });
  } catch (error) {
    return catalogApiErrorResponse(
      error,
    );
  }
}
