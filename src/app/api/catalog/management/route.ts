import type {
  NextRequest,
} from "next/server";

import {
  getManagerCatalog,
} from "@/server/catalog";
import {
  catalogApiErrorResponse,
  catalogJsonResponse,
  catalogSessionRequiredResponse,
  readCatalogApiSession,
  requireCatalogStorefrontCode,
} from "@/server/catalog/http";

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const storefrontCode =
      requireCatalogStorefrontCode(
        request.nextUrl
          .searchParams.get(
            "storefrontCode",
          ),
      );
    const session =
      await readCatalogApiSession(
        request,
        storefrontCode,
      );

    if (!session) {
      return catalogSessionRequiredResponse();
    }

    const catalog =
      await getManagerCatalog({
        storefrontCode,
        userId: session.userId,
      });

    return catalogJsonResponse({
      ok: true,
      data: catalog,
    });
  } catch (error) {
    return catalogApiErrorResponse(
      error,
    );
  }
}
