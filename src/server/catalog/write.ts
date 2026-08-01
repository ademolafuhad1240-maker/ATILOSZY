import "server-only";

import {
  PriceType,
  ProductStatus,
  ProductVariantStatus,
  StockMovementType,
  StorefrontProductStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CatalogServiceError } from "@/server/catalog/errors";
import type {
  CatalogImageInput,
  CatalogProductVariantInput,
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

function normalizeCatalogVariant(
  input: CatalogProductVariantInput,
  index: number,
  storefrontCode: string,
  globalProductSlug: string,
) {
  const label = `Variant ${index + 1}`;
  const sku = normalizeSku(input.sku);
  const expectedSkuPrefix = `${storefrontCode}-`;
  const status = input.status ?? ProductVariantStatus.ACTIVE;

  if (!Object.values(ProductVariantStatus).includes(status)) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} status is invalid.`,
    );
  }

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

  const initialStock = requireInteger(
    input.initialStock,
    `${label} initial stock`,
    0,
  );
  const quantityReserved = requireInteger(
    input.quantityReserved ?? 0,
    `${label} reserved stock`,
    0,
  );

  if (quantityReserved > initialStock) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} reserved stock cannot exceed stock on hand.`,
    );
  }

  const amount = requireMoney(
    input.price.amount,
    `${label} price`,
  );
  const compareAtAmount =
    input.price.compareAtAmount === null ||
    input.price.compareAtAmount === undefined
      ? null
      : requireMoney(
          input.price.compareAtAmount,
          `${label} compare-at price`,
        );
  const costAmount =
    input.price.costAmount === null ||
    input.price.costAmount === undefined
      ? null
      : requireMoney(
          input.price.costAmount,
          `${label} cost price`,
          true,
        );

  if (
    compareAtAmount !== null &&
    Number(compareAtAmount) <= Number(amount)
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} compare-at price must be greater than its selling price.`,
    );
  }

  if (
    input.price.startsAt &&
    input.price.endsAt &&
    input.price.startsAt >= input.price.endsAt
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} price schedule must end after it begins.`,
    );
  }

  const options = (input.options ?? []).map(
    (option, optionIndex) => ({
      name: requireText(
        option.name,
        `${label} option ${optionIndex + 1} name`,
        80,
      ),
      value: requireText(
        option.value,
        `${label} option ${optionIndex + 1} value`,
        120,
      ),
      position: requireInteger(
        option.position ?? optionIndex + 1,
        `${label} option ${optionIndex + 1} position`,
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
      `${label} option names must be unique.`,
    );
  }

  return {
    sku,
    barcode: optionalText(input.barcode, `${label} barcode`, 80),
    title: requireText(input.title, `${label} title`, 240),
    status,
    weightGrams:
      input.weightGrams === null || input.weightGrams === undefined
        ? null
        : requireInteger(input.weightGrams, `${label} weight`, 0),
    options,
    price: {
      currencyType: input.price.type ?? PriceType.REGULAR,
      amount,
      compareAtAmount,
      costAmount,
      startsAt: input.price.startsAt ?? null,
      endsAt: input.price.endsAt ?? null,
    },
    inventory: {
      initialStock,
      quantityReserved,
      reorderLevel: requireInteger(
        input.reorderLevel ?? 0,
        `${label} reorder level`,
        0,
      ),
      isTracked: input.isTracked ?? true,
      allowBackorder: input.allowBackorder ?? false,
    },
    openingStockReason:
      optionalText(
        input.openingStockReason,
        `${label} opening stock reason`,
        500,
      ) ?? "Opening stock created with product",
    openingStockReferenceType:
      optionalText(
        input.openingStockReferenceType,
        `${label} opening stock reference type`,
        80,
      ) ?? "PRODUCT_CREATION",
    openingStockReferenceId:
      optionalText(
        input.openingStockReferenceId,
        `${label} opening stock reference`,
        160,
      ) ?? `${globalProductSlug}:${sku}`,
  };
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

  const globalProductSlug = `${storefront.key}-${listingSlug}`;

  if (globalProductSlug.length > 140) {
    throw new CatalogServiceError(
      "VALIDATION",
      "The combined storefront and product slug is too long.",
    );
  }

  const rawVariants = input.variants ?? [input.variant];

  if (rawVariants.length === 0 || rawVariants.length > 100) {
    throw new CatalogServiceError(
      "VALIDATION",
      "A product must have between 1 and 100 variants.",
    );
  }

  const variants = rawVariants.map((variant, index) =>
    normalizeCatalogVariant(
      variant,
      index,
      storefront.code,
      globalProductSlug,
    ),
  );
  const skus = new Set(variants.map((variant) => variant.sku));

  if (skus.size !== variants.length) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Every product variant must have a unique SKU.",
    );
  }

  const maxPerOrder =
    input.maxPerOrder === null ||
    input.maxPerOrder === undefined
      ? null
      : requireInteger(
          input.maxPerOrder,
          "Maximum quantity per order",
          1,
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
              create: variants.map((variant, index) => ({
                sku: variant.sku,
                barcode: variant.barcode,
                title: variant.title,
                status: variant.status,
                isDefault: index === 0,
                weightGrams: variant.weightGrams,
                options:
                  variant.options.length > 0
                    ? { create: variant.options }
                    : undefined,
                prices: {
                  create: {
                    currencyCode: storefront.currencyCode,
                    type: variant.price.currencyType,
                    amount: variant.price.amount,
                    compareAtAmount:
                      variant.price.compareAtAmount,
                    costAmount: variant.price.costAmount,
                    startsAt: variant.price.startsAt,
                    endsAt: variant.price.endsAt,
                    isActive: true,
                  },
                },
                inventory: {
                  create: {
                    storefrontId: storefront.id,
                    quantityOnHand:
                      variant.inventory.initialStock,
                    quantityReserved:
                      variant.inventory.quantityReserved,
                    reorderLevel:
                      variant.inventory.reorderLevel,
                    isTracked: variant.inventory.isTracked,
                    allowBackorder:
                      variant.inventory.allowBackorder,
                    movements:
                      variant.inventory.initialStock > 0
                        ? {
                            create: {
                              type:
                                StockMovementType.OPENING_STOCK,
                              quantityDelta:
                                variant.inventory.initialStock,
                              quantityOnHandAfter:
                                variant.inventory.initialStock,
                              quantityReservedAfter:
                                variant.inventory.quantityReserved,
                              reason:
                                variant.openingStockReason,
                              referenceType:
                                variant.openingStockReferenceType,
                              referenceId:
                                variant.openingStockReferenceId,
                            },
                          }
                        : undefined,
                  },
                },
              })),
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
      sku: variant.sku,
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
