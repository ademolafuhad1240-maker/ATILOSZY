import "server-only";

import type {
  NextRequest,
} from "next/server";

import {
  ProductVariantStatus,
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
  ManagedCatalogImageSelectionInput,
  ManagedCatalogVariantInput,
} from "./types";
import {
  MAX_CATALOG_IMAGES,
} from "./media";
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
  "images",
  "variantTitle",
  "priceAmount",
  "compareAtAmount",
  "costAmount",
  "reorderLevel",
  "isTracked",
  "allowBackorder",
  "variants",
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
  "variantId",
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

function optionalCatalogImages(
  value: unknown,
):
  ManagedCatalogImageSelectionInput[] |
  undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    value.length >
      MAX_CATALOG_IMAGES
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `A product can have no more than ${MAX_CATALOG_IMAGES} photos.`,
    );
  }

  return value.map(
    (item, index) => {
      if (
        typeof item !==
          "object" ||
        item === null ||
        Array.isArray(item)
      ) {
        throw new CatalogServiceError(
          "VALIDATION",
          `Product photo ${index + 1} is invalid.`,
        );
      }

      const image =
        item as Record<
          string,
          unknown
        >;
      const allowed =
        new Set([
          "existingImageId",
          "uploadToken",
          "altText",
        ]);

      if (
        Object.keys(image).some(
          (field) =>
            !allowed.has(field),
        )
      ) {
        throw new CatalogServiceError(
          "VALIDATION",
          "Product photo storage identity is controlled by the server.",
        );
      }

      const existingImageId =
        image.existingImageId;
      const uploadToken =
        image.uploadToken;
      const altText =
        image.altText;

      if (
        existingImageId !==
          undefined &&
        (
          typeof existingImageId !==
            "string" ||
          existingImageId.length >
            191
        )
      ) {
        throw new CatalogServiceError(
          "VALIDATION",
          `Product photo ${index + 1} identifier is invalid.`,
        );
      }

      if (
        uploadToken !==
          undefined &&
        (
          typeof uploadToken !==
            "string" ||
          uploadToken.length >
            8_192
        )
      ) {
        throw new CatalogServiceError(
          "VALIDATION",
          `Product photo ${index + 1} attachment is invalid.`,
        );
      }

      if (
        altText !== undefined &&
        altText !== null &&
        (
          typeof altText !==
            "string" ||
          altText.length > 300
        )
      ) {
        throw new CatalogServiceError(
          "VALIDATION",
          `Product photo ${index + 1} description is invalid.`,
        );
      }

      return {
        existingImageId:
          typeof existingImageId ===
          "string"
            ? existingImageId
            : undefined,
        uploadToken:
          typeof uploadToken ===
          "string"
            ? uploadToken
            : undefined,
        altText:
          typeof altText ===
          "string"
            ? altText
            : null,
      };
    },
  );
}

function optionalCatalogVariants(
  value: unknown,
): ManagedCatalogVariantInput[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new CatalogServiceError(
      "VALIDATION",
      "A product must have between 1 and 100 variants.",
    );
  }

  return value.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new CatalogServiceError(
        "VALIDATION",
        `Variant ${index + 1} is invalid.`,
      );
    }

    const variant = item as Record<string, unknown>;
    const allowed = new Set([
      "id",
      "sku",
      "title",
      "size",
      "color",
      "priceAmount",
      "compareAtAmount",
      "costAmount",
      "initialStock",
      "reorderLevel",
      "isTracked",
      "allowBackorder",
      "status",
    ]);

    if (Object.keys(variant).some((field) => !allowed.has(field))) {
      throw new CatalogServiceError(
        "VALIDATION",
        "Variant storefront, currency, price type and inventory audit identity are controlled by the server.",
      );
    }

    const object = variant as JsonObject;
    const statusValue = object.status;
    const status =
      statusValue === undefined
        ? ProductVariantStatus.ACTIVE
        : typeof statusValue === "string" &&
            Object.values(ProductVariantStatus).includes(
              statusValue as ProductVariantStatus,
            )
          ? (statusValue as ProductVariantStatus)
          : null;

    if (status === null) {
      throw new CatalogServiceError(
        "VALIDATION",
        `Variant ${index + 1} availability is invalid.`,
      );
    }

    const initialStock = object.initialStock;

    if (
      initialStock !== undefined &&
      (typeof initialStock !== "number" || !Number.isSafeInteger(initialStock))
    ) {
      throw new CatalogServiceError(
        "VALIDATION",
        `Variant ${index + 1} opening stock must be a whole number.`,
      );
    }

    return {
      id: optionalCatalogString(object, "id", 191),
      sku: requireCatalogString(object, "sku", 80),
      title: requireCatalogString(object, "title", 240),
      size: optionalCatalogString(object, "size", 120),
      color: optionalCatalogString(object, "color", 120),
      priceAmount: requireCatalogString(object, "priceAmount", 40),
      compareAtAmount:
        optionalCatalogString(object, "compareAtAmount", 40),
      costAmount: optionalCatalogString(object, "costAmount", 40),
      initialStock:
        typeof initialStock === "number" ? initialStock : undefined,
      reorderLevel: requireCatalogInteger(object, "reorderLevel"),
      isTracked: requireCatalogBoolean(object, "isTracked"),
      allowBackorder:
        requireCatalogBoolean(object, "allowBackorder"),
      status,
    };
  });
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
    images:
      optionalCatalogImages(
        body.images,
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
    variants:
      optionalCatalogVariants(
        body.variants,
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
  MEDIA_UNAVAILABLE: 503,
  MEDIA_REJECTED: 502,
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
