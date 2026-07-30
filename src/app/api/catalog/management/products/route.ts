import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
  readJsonObject,
} from "@/server/auth/http";
import {
  createManagedCatalogProduct,
} from "@/server/catalog";
import {
  assertOnlyCatalogFields,
  catalogApiErrorResponse,
  catalogJsonResponse,
  catalogSessionRequiredResponse,
  createProductFields,
  productFieldsFromBody,
  readCatalogApiSession,
  requireCatalogInteger,
  requireCatalogStorefrontCode,
  requireCatalogString,
} from "@/server/catalog/http";

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);
    const body =
      await readJsonObject(
        request,
      );
    assertOnlyCatalogFields(
      body,
      createProductFields,
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

    const created =
      await createManagedCatalogProduct({
        storefrontCode,
        userId: session.userId,
        ...productFieldsFromBody(
          body,
        ),
        listingSlug:
          requireCatalogString(
            body,
            "listingSlug",
            140,
          ),
        sku: requireCatalogString(
          body,
          "sku",
          80,
        ),
        initialStock:
          requireCatalogInteger(
            body,
            "initialStock",
          ),
      });

    return catalogJsonResponse(
      {
        ok: true,
        data: {
          product: created,
        },
      },
      201,
    );
  } catch (error) {
    return catalogApiErrorResponse(
      error,
    );
  }
}
