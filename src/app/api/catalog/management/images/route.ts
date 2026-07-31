import type {
  NextRequest,
} from "next/server";

import {
  assertTrustedOrigin,
} from "@/server/auth/http";
import {
  uploadManagedCatalogImage,
} from "@/server/catalog";
import {
  catalogApiErrorResponse,
  catalogJsonResponse,
  catalogSessionRequiredResponse,
  readCatalogApiSession,
  requireCatalogStorefrontCode,
} from "@/server/catalog/http";
import {
  MAX_CATALOG_IMAGE_INPUT_BYTES,
} from "@/server/catalog/media";
import {
  CatalogServiceError,
} from "@/server/catalog/errors";

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

const MULTIPART_OVERHEAD_BYTES =
  256 * 1024;

export async function POST(
  request: NextRequest,
) {
  try {
    assertTrustedOrigin(request);
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

    const rawContentLength =
      request.headers.get(
        "content-length",
      );
    const contentLength =
      rawContentLength === null
        ? null
        : Number(
            rawContentLength,
          );

    if (
      contentLength !== null &&
      (
        !Number.isSafeInteger(
          contentLength,
        ) ||
        contentLength < 1 ||
        contentLength >
          MAX_CATALOG_IMAGE_INPUT_BYTES +
            MULTIPART_OVERHEAD_BYTES
      )
    ) {
      throw new CatalogServiceError(
        "VALIDATION",
        "Each product photo must be no larger than 8 MB.",
      );
    }

    const body =
      await request.formData();

    if (
      [...body.keys()].some(
        (field) =>
          field !== "image",
      )
    ) {
      throw new CatalogServiceError(
        "VALIDATION",
        "Product photo storage identity and metadata are controlled by the server.",
      );
    }

    const image =
      body.get("image");

    if (
      !(image instanceof File) ||
      image.size < 1 ||
      image.size >
        MAX_CATALOG_IMAGE_INPUT_BYTES
    ) {
      throw new CatalogServiceError(
        "VALIDATION",
        "Select one product photo no larger than 8 MB.",
      );
    }

    const uploaded =
      await uploadManagedCatalogImage({
        storefrontCode,
        userId: session.userId,
        bytes:
          new Uint8Array(
            await image.arrayBuffer(),
          ),
        contentType:
          image.type,
      });

    return catalogJsonResponse(
      {
        ok: true,
        data: {
          image: uploaded,
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
