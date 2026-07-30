import "server-only";

import type {
  NextRequest,
} from "next/server";

import {
  StockMovementType,
  StorefrontProductStatus,
} from "@/generated/prisma/client";
import {
  authApiErrorResponse,
  authJsonResponse,
} from "@/server/auth/http";
import {
  readCartApiSession,
} from "@/server/cart/http";

import {
  CatalogServiceError,
} from "./errors";
import type {
  ManagedCatalogProductFields,
} from "./types";
import {
  normalizeStorefrontCode,
} from "./validation";

type JsonObject =
  Record<string, unknown>;

const productFields = [
  "storefrontCode",
  "categorySlug",
  "name",
  "shortDescription",
  "description",
  "brand",
  "listingStatus",
  "isFeatured",
  "maxPerOrder",
  "imageUrl",
  "imageAltText",
  "variantTitle",
  "priceAmount",
  "compareAtAmount",
  "costAmount",
  "reorderLevel",
  "isTracked",
  "allowBackorder",
] as const;

export const createProductFields = [
  ...productFields,
  "listingSlug",
  "sku",
  "initialStock",
] as const;

export const updateProductFields =
  productFields;

export const stockAdjustmentFields = [
  "storefrontCode",
  "quantityDelta",
  "type",
  "reason",
] as const;

export function catalogJsonResponse(
  body: unknown,
  status = 200,
) {
  return authJsonResponse(
    body,
    status,
  );
}

export function catalogSessionRequiredResponse() {
  return catalogJsonResponse(
    {
      ok: false,
      error: {
        code: "SESSION_INVALID",
        message:
          "Sign in with the approved storefront manager account to continue.",
      },
    },
    401,
  );
}

export async function readCatalogApiSession(
  request: NextRequest,
  storefrontCode: string,
) {
  return readCartApiSession(
    request,
    storefrontCode,
  );
}

export function assertOnlyCatalogFields(
  body: JsonObject,
  allowedFields:
    readonly string[],
): void {
  const allowed =
    new Set(allowedFields);

  if (
    Object.keys(body).some(
      (field) =>
        !allowed.has(field),
    )
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Storefront identity, currency, reservations, actor identity, audit references and product identifiers are controlled by the server.",
    );
  }
}

export function requireCatalogStorefrontCode(
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new CatalogServiceError(
      "VALIDATION",
      "Storefront code is required.",
    );
  }

  return normalizeStorefrontCode(
    value,
  );
}

export function requireCatalogString(
  body: JsonObject,
  field: string,
  maximumLength: number,
): string {
  const value = body[field];

  if (
    typeof value !== "string" ||
    value.length >
      maximumLength
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${field} is invalid.`,
    );
  }

  return value;
}

export function optionalCatalogString(
  body: JsonObject,
  field: string,
  maximumLength: number,
): string | null {
  const value = body[field];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return requireCatalogString(
    body,
    field,
    maximumLength,
  );
}

export function requireCatalogBoolean(
  body: JsonObject,
  field: string,
): boolean {
  const value = body[field];

  if (typeof value !== "boolean") {
    throw new CatalogServiceError(
      "VALIDATION",
      `${field} must be true or false.`,
    );
  }

  return value;
}

export function requireCatalogInteger(
  body: JsonObject,
  field: string,
): number {
  const value = body[field];

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${field} must be a whole number.`,
    );
  }

  return value;
}

export function optionalCatalogInteger(
  body: JsonObject,
  field: string,
): number | null {
  const value = body[field];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return requireCatalogInteger(
    body,
    field,
  );
}

export function requireListingStatus(
  body: JsonObject,
): StorefrontProductStatus {
  const value =
    requireCatalogString(
      body,
      "listingStatus",
      32,
    ).toUpperCase();

  if (
    !Object.values(
      StorefrontProductStatus,
    ).includes(
      value as
        StorefrontProductStatus,
    )
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Product publication status is invalid.",
    );
  }

  return value as
    StorefrontProductStatus;
}

export function requireStockMovementType(
  body: JsonObject,
): StockMovementType {
  const value =
    requireCatalogString(
      body,
      "type",
      32,
    ).toUpperCase();
  const allowed =
    new Set<StockMovementType>([
      StockMovementType.PURCHASE,
      StockMovementType.ADJUSTMENT,
      StockMovementType.RETURN,
      StockMovementType.DAMAGE,
    ]);

  if (
    !allowed.has(
      value as
        StockMovementType,
    )
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Stock adjustment type is invalid.",
    );
  }

  return value as
    StockMovementType;
}

export function productFieldsFromBody(
  body: JsonObject,
): ManagedCatalogProductFields {
  return {
    categorySlug:
      requireCatalogString(
        body,
        "categorySlug",
        100,
      ),
    name: requireCatalogString(
      body,
      "name",
      240,
    ),
    shortDescription:
      optionalCatalogString(
        body,
        "shortDescription",
        500,
      ),
    description:
      optionalCatalogString(
        body,
        "description",
        10_000,
      ),
    brand: optionalCatalogString(
      body,
      "brand",
      160,
    ),
    listingStatus:
      requireListingStatus(
        body,
      ),
    isFeatured:
      requireCatalogBoolean(
        body,
        "isFeatured",
      ),
    maxPerOrder:
      optionalCatalogInteger(
        body,
        "maxPerOrder",
      ),
    imageUrl:
      optionalCatalogString(
        body,
        "imageUrl",
        2048,
      ),
    imageAltText:
      optionalCatalogString(
        body,
        "imageAltText",
        300,
      ),
    variantTitle:
      requireCatalogString(
        body,
        "variantTitle",
        240,
      ),
    priceAmount:
      requireCatalogString(
        body,
        "priceAmount",
        40,
      ),
    compareAtAmount:
      optionalCatalogString(
        body,
        "compareAtAmount",
        40,
      ),
    costAmount:
      optionalCatalogString(
        body,
        "costAmount",
        40,
      ),
    reorderLevel:
      requireCatalogInteger(
        body,
        "reorderLevel",
      ),
    isTracked:
      requireCatalogBoolean(
        body,
        "isTracked",
      ),
    allowBackorder:
      requireCatalogBoolean(
        body,
        "allowBackorder",
      ),
  };
}

export function requireCatalogIdentifier(
  value: string,
): string {
  const normalized =
    value.trim();

  if (
    normalized.length < 1 ||
    normalized.length > 191 ||
    !/^[A-Za-z0-9_-]+$/u.test(
      normalized,
    )
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Catalogue product identifier is invalid.",
    );
  }

  return normalized;
}

const errorStatuses: Record<
  CatalogServiceError["code"],
  number
> = {
  VALIDATION: 400,
  MANAGER_ACCESS_REQUIRED: 403,
  STOREFRONT_UNAVAILABLE: 404,
  NOT_FOUND: 404,
  CONFLICT: 409,
  CURRENCY_MISMATCH: 409,
  INSUFFICIENT_STOCK: 409,
};

export function catalogApiErrorResponse(
  error: unknown,
) {
  if (
    error instanceof
    CatalogServiceError
  ) {
    return catalogJsonResponse(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      errorStatuses[
        error.code
      ],
    );
  }

  return authApiErrorResponse(
    error,
  );
}
