import "server-only";

import {
  PriceType,
  ProductStatus,
  StockMovementType,
  StorefrontProductStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CatalogServiceError } from "@/server/catalog/errors";
import type {
  CatalogImageInput,
  CreateCatalogProductInput,
  CreatedCatalogProduct,
} from "@/server/catalog/types";
import {
  MAX_CATALOG_IMAGES,
} from "@/server/catalog/media";
import {
  normalizeImageUrl,
  normalizeSku,
  normalizeSlug,
  optionalText,
  requireInteger,
  requireMoney,
  requireText,
} from "@/server/catalog/validation";

function isUniqueConstraintError(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error)
  ) {
    return false;
  }

  return error.code === "P2002";
}

function normalizeCatalogImages(
  input:
    readonly CatalogImageInput[],
) {
  if (
    input.length >
    MAX_CATALOG_IMAGES
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `A product can have no more than ${MAX_CATALOG_IMAGES} photos.`,
    );
  }

  return input.map(
    (image, index) => {
      const storageProvider =
        optionalText(
          image.storageProvider,
          `Product photo ${index + 1} storage provider`,
          32,
        );
      const storageKey =
        optionalText(
          image.storageKey,
          `Product photo ${index + 1} storage key`,
          255,
        );
      const mimeType =
        optionalText(
          image.mimeType,
          `Product photo ${index + 1} media type`,
          100,
        );
      const hasStorageMetadata =
        storageProvider !== null ||
        storageKey !== null ||
        mimeType !== null ||
        image.byteSize !==
          null &&
          image.byteSize !==
            undefined ||
        image.width !== null &&
          image.width !==
            undefined ||
        image.height !== null &&
          image.height !==
            undefined;

      if (
        hasStorageMetadata &&
        (
          !storageProvider ||
          !storageKey ||
          !mimeType ||
          image.byteSize ===
            null ||
          image.byteSize ===
            undefined ||
          image.width === null ||
          image.width ===
            undefined ||
          image.height === null ||
          image.height ===
            undefined
        )
      ) {
        throw new CatalogServiceError(
          "VALIDATION",
          "Managed product photo metadata is incomplete.",
        );
      }

      return {
        url: normalizeImageUrl(
          image.url,
        ),
        altText: optionalText(
          image.altText,
          `Product photo ${index + 1} description`,
          300,
        ),
        position: index + 1,
        isPrimary: index === 0,
        storageProvider,
        storageKey,
        mimeType,
        byteSize:
          hasStorageMetadata
            ? requireInteger(
                image.byteSize!,
                `Product photo ${index + 1} byte size`,
                1,
              )
            : null,
        width:
          hasStorageMetadata
            ? requireInteger(
                image.width!,
                `Product photo ${index + 1} width`,
                1,
              )
            : null,
        height:
          hasStorageMetadata
            ? requireInteger(
                image.height!,
                `Product photo ${index + 1} height`,
                1,
              )
            : null,
      };
    },
  );
}

export async function createCatalogProduct(
  input: CreateCatalogProductInput,
): Promise<CreatedCatalogProduct> {
  const storefrontKey = normalizeSlug(
    input.storefrontKey,
    "Storefront key",
    50,
  );

  const categorySlug = normalizeSlug(
    input.categorySlug,
    "Category slug",
    100,
  );

  const listingSlug = normalizeSlug(
    input.listingSlug,
    "Listing slug",
  );

  const name = requireText(input.name, "Product name", 240);
  const sku = normalizeSku(input.variant.sku);

  const storefront = await prisma.storefront.findUnique({
    where: {
      key: storefrontKey,
    },
    include: {
      categories: {
        where: {
          slug: categorySlug,
        },
        take: 1,
      },
    },
  });

  if (!storefront) {
    throw new CatalogServiceError(
      "NOT_FOUND",
      `Storefront "${storefrontKey}" was not found.`,
    );
  }

  const category = storefront.categories[0];

  if (!category) {
    throw new CatalogServiceError(
      "NOT_FOUND",
      `Category "${categorySlug}" was not found in ${storefront.code}.`,
    );
  }

  const expectedSkuPrefix = `${storefront.code}-`;

  if (!sku.startsWith(expectedSkuPrefix)) {
    throw new CatalogServiceError(
      "VALIDATION",
      `SKU must begin with ${expectedSkuPrefix}.`,
      {
        expectedPrefix: expectedSkuPrefix,
        receivedSku: sku,
      },
    );
  }

  const globalProductSlug = `${storefront.key}-${listingSlug}`;

  if (globalProductSlug.length > 140) {
    throw new CatalogServiceError(
      "VALIDATION",
      "The combined storefront and product slug is too long.",
    );
  }

  const initialStock = requireInteger(
    input.variant.initialStock,
    "Initial stock",
    0,
  );

  const quantityReserved = requireInteger(
    input.variant.quantityReserved ?? 0,
    "Reserved stock",
    0,
  );

  if (quantityReserved > initialStock) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Reserved stock cannot exceed stock on hand.",
    );
  }

  const reorderLevel = requireInteger(
    input.variant.reorderLevel ?? 0,
    "Reorder level",
    0,
  );

  const maxPerOrder =
    input.maxPerOrder === null ||
    input.maxPerOrder === undefined
      ? null
      : requireInteger(
          input.maxPerOrder,
          "Maximum quantity per order",
          1,
        );

  const amount = requireMoney(
    input.variant.price.amount,
    "Price",
  );

  const compareAtAmount =
    input.variant.price.compareAtAmount === null ||
    input.variant.price.compareAtAmount === undefined
      ? null
      : requireMoney(
          input.variant.price.compareAtAmount,
          "Compare-at price",
        );

  const costAmount =
    input.variant.price.costAmount === null ||
    input.variant.price.costAmount === undefined
      ? null
      : requireMoney(
          input.variant.price.costAmount,
          "Cost price",
          true,
        );

  if (
    input.availableFrom &&
    input.availableUntil &&
    input.availableFrom >= input.availableUntil
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Product availability must end after it begins.",
    );
  }

  if (
    input.variant.price.startsAt &&
    input.variant.price.endsAt &&
    input.variant.price.startsAt >= input.variant.price.endsAt
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Price schedule must end after it begins.",
    );
  }

  const options = (input.variant.options ?? []).map(
    (option, index) => ({
      name: requireText(
        option.name,
        `Variant option ${index + 1} name`,
        80,
      ),
      value: requireText(
        option.value,
        `Variant option ${index + 1} value`,
        120,
      ),
      position: requireInteger(
        option.position ?? index + 1,
        `Variant option ${index + 1} position`,
        0,
      ),
    }),
  );

  const optionNames = new Set(
    options.map((option) => option.name.toLowerCase()),
  );

  if (optionNames.size !== options.length) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Variant option names must be unique.",
    );
  }

  const listingStatus =
    input.listingStatus ??
    StorefrontProductStatus.DRAFT;

  const productStatus =
    input.productStatus ??
    ProductStatus.DRAFT;

  const publishedAt =
    listingStatus === StorefrontProductStatus.ACTIVE
      ? input.publishedAt ?? new Date()
      : input.publishedAt ?? null;

  if (
    input.image &&
    input.images !== undefined
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Use one product photo collection.",
    );
  }

  const images =
    normalizeCatalogImages(
      input.images ??
        (
          input.image
            ? [input.image]
            : []
        ),
    );
  const openingStockReason =
    optionalText(
      input.variant
        .openingStockReason,
      "Opening stock reason",
      500,
    ) ??
    "Opening stock created with product";
  const openingStockReferenceType =
    optionalText(
      input.variant
        .openingStockReferenceType,
      "Opening stock reference type",
      80,
    ) ?? "PRODUCT_CREATION";
  const openingStockReferenceId =
    optionalText(
      input.variant
        .openingStockReferenceId,
      "Opening stock reference",
      160,
    ) ?? globalProductSlug;

  try {
    const createdProduct = await prisma.product.create({
      data: {
        slug: globalProductSlug,
        name,
        shortDescription: optionalText(
          input.shortDescription,
          "Short description",
          500,
        ),
        description: optionalText(
          input.description,
          "Description",
          10000,
        ),
        brand: optionalText(
          input.brand,
          "Brand",
          160,
        ),
        status: productStatus,
        storefrontProducts: {
          create: {
            storefrontId: storefront.id,
            categoryId: category.id,
            slug: listingSlug,
            status: listingStatus,
            isFeatured: input.isFeatured ?? false,
            isDemo: input.isDemo ?? false,
            sortOrder: requireInteger(
              input.sortOrder ?? 0,
              "Sort order",
              0,
            ),
            maxPerOrder,
            publishedAt,
            availableFrom: input.availableFrom ?? null,
            availableUntil: input.availableUntil ?? null,
            images:
              images.length > 0
              ? {
                  create: images,
                }
              : undefined,
            variants: {
              create: {
                sku,
                barcode: optionalText(
                  input.variant.barcode,
                  "Barcode",
                  80,
                ),
                title: requireText(
                  input.variant.title,
                  "Variant title",
                  240,
                ),
                isDefault: true,
                weightGrams:
                  input.variant.weightGrams === null ||
                  input.variant.weightGrams === undefined
                    ? null
                    : requireInteger(
                        input.variant.weightGrams,
                        "Weight",
                        0,
                      ),
                options:
                  options.length > 0
                    ? {
                        create: options,
                      }
                    : undefined,
                prices: {
                  create: {
                    currencyCode: storefront.currencyCode,
                    type:
                      input.variant.price.type ??
                      PriceType.REGULAR,
                    amount,
                    compareAtAmount,
                    costAmount,
                    startsAt:
                      input.variant.price.startsAt ?? null,
                    endsAt:
                      input.variant.price.endsAt ?? null,
                    isActive: true,
                  },
                },
                inventory: {
                  create: {
                    storefrontId: storefront.id,
                    quantityOnHand: initialStock,
                    quantityReserved,
                    reorderLevel,
                    isTracked:
                      input.variant.isTracked ?? true,
                    allowBackorder:
                      input.variant.allowBackorder ?? false,
                    movements:
                      initialStock > 0
                        ? {
                            create: {
                              type:
                                StockMovementType.OPENING_STOCK,
                              quantityDelta: initialStock,
                              quantityOnHandAfter:
                                initialStock,
                              quantityReservedAfter:
                                quantityReserved,
                              reason:
                                openingStockReason,
                              referenceType:
                                openingStockReferenceType,
                              referenceId:
                                openingStockReferenceId,
                            },
                          }
                        : undefined,
                  },
                },
              },
            },
          },
        },
      },
      include: {
        storefrontProducts: {
          include: {
            variants: true,
          },
        },
      },
    });

    const storefrontProduct =
      createdProduct.storefrontProducts[0];

    const variant = storefrontProduct?.variants[0];

    if (!storefrontProduct || !variant) {
      throw new CatalogServiceError(
        "CONFLICT",
        "Product creation completed without its required listing or variant.",
      );
    }

    return {
      productId: createdProduct.id,
      storefrontProductId: storefrontProduct.id,
      variantId: variant.id,
      listingSlug,
      sku,
      storefrontCode: storefront.code,
      currencyCode: storefront.currencyCode,
    };
  } catch (error: unknown) {
    if (error instanceof CatalogServiceError) {
      throw error;
    }

    if (isUniqueConstraintError(error)) {
      throw new CatalogServiceError(
        "CONFLICT",
        "A product, listing, SKU or barcode already uses one of these identifiers.",
      );
    }

    throw error;
  }
}
