#!/usr/bin/env bash

set -Eeuo pipefail

trap 'echo; echo "PHASE 2D FAILED on line $LINENO"; echo "Command: $BASH_COMMAND"' ERR

echo "=== VERIFY ENVIRONMENT ==="

test "$(git branch --show-current)" = "feat/commerce-foundation"
test -f .env
docker inspect sorvyra-postgres >/dev/null

mkdir -p src/server/catalog scripts

echo "Branch: $(git branch --show-current)"
echo "PostgreSQL container found."

echo
echo "=== CREATE CATALOGUE SERVICE ERRORS ==="

cat > src/server/catalog/errors.ts <<'EOF'
export type CatalogErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CURRENCY_MISMATCH"
  | "INSUFFICIENT_STOCK";

export class CatalogServiceError extends Error {
  readonly code: CatalogErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: CatalogErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);

    this.name = "CatalogServiceError";
    this.code = code;
    this.details = details;
  }
}
EOF

echo
echo "=== CREATE CATALOGUE SERVICE TYPES ==="

cat > src/server/catalog/types.ts <<'EOF'
import type {
  PriceType,
  ProductStatus,
  StockMovementType,
  StorefrontProductStatus,
} from "@/generated/prisma/client";

export interface CatalogVariantOptionInput {
  name: string;
  value: string;
  position?: number;
}

export interface CatalogPriceInput {
  amount: string;
  compareAtAmount?: string | null;
  costAmount?: string | null;
  type?: PriceType;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export interface CatalogImageInput {
  url: string;
  altText?: string | null;
}

export interface CreateCatalogProductInput {
  storefrontKey: string;
  categorySlug: string;
  listingSlug: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  brand?: string | null;
  productStatus?: ProductStatus;
  listingStatus?: StorefrontProductStatus;
  isFeatured?: boolean;
  isDemo?: boolean;
  sortOrder?: number;
  maxPerOrder?: number | null;
  publishedAt?: Date | null;
  availableFrom?: Date | null;
  availableUntil?: Date | null;
  image?: CatalogImageInput | null;
  variant: {
    sku: string;
    title: string;
    barcode?: string | null;
    options?: readonly CatalogVariantOptionInput[];
    price: CatalogPriceInput;
    initialStock: number;
    quantityReserved?: number;
    reorderLevel?: number;
    isTracked?: boolean;
    allowBackorder?: boolean;
    weightGrams?: number | null;
  };
}

export interface CreatedCatalogProduct {
  productId: string;
  storefrontProductId: string;
  variantId: string;
  listingSlug: string;
  sku: string;
  storefrontCode: string;
  currencyCode: string;
}

export interface PublicCatalogPrice {
  type: PriceType;
  amount: string;
  compareAtAmount: string | null;
  currencyCode: string;
}

export interface PublicCatalogOption {
  name: string;
  value: string;
}

export interface PublicCatalogVariant {
  id: string;
  sku: string;
  title: string;
  options: PublicCatalogOption[];
  price: PublicCatalogPrice;
  imageUrl: string | null;
  availableQuantity: number | null;
  isInStock: boolean;
  allowBackorder: boolean;
}

export interface PublicCatalogProduct {
  id: string;
  productId: string;
  storefrontCode: string;
  storefrontKey: string;
  storefrontName: string;
  currencyCode: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  category: {
    slug: string;
    name: string;
  } | null;
  primaryImageUrl: string | null;
  isFeatured: boolean;
  variants: PublicCatalogVariant[];
}

export interface AdjustVariantStockInput {
  storefrontKey: string;
  sku: string;
  quantityDelta: number;
  type: StockMovementType;
  reason: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface AdjustedInventory {
  inventoryId: string;
  sku: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
}
EOF

echo
echo "=== CREATE CATALOGUE VALIDATION UTILITIES ==="

cat > src/server/catalog/validation.ts <<'EOF'
import { CatalogServiceError } from "@/server/catalog/errors";

export function requireText(
  value: string,
  label: string,
  maximumLength: number,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} is required.`,
    );
  }

  if (normalized.length > maximumLength) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} cannot exceed ${maximumLength} characters.`,
    );
  }

  return normalized;
}

export function normalizeSlug(
  value: string,
  label: string,
  maximumLength = 140,
): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must contain letters or numbers.`,
    );
  }

  if (normalized.length > maximumLength) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} cannot exceed ${maximumLength} characters.`,
    );
  }

  return normalized;
}

export function normalizeSku(value: string): string {
  const normalized = requireText(
    value,
    "SKU",
    80,
  ).toUpperCase();

  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) {
    throw new CatalogServiceError(
      "VALIDATION",
      "SKU may contain only letters, numbers, periods, underscores and hyphens.",
    );
  }

  return normalized;
}

export function requireInteger(
  value: number,
  label: string,
  minimum: number,
): number {
  if (!Number.isInteger(value) || value < minimum) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must be an integer greater than or equal to ${minimum}.`,
    );
  }

  return value;
}

export function requireMoney(
  value: string,
  label: string,
  allowZero = false,
): string {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must be a positive amount with no more than two decimal places.`,
    );
  }

  const numericValue = Number(normalized);

  if (
    !Number.isFinite(numericValue) ||
    numericValue < 0 ||
    (!allowZero && numericValue === 0)
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must be ${allowZero ? "zero or greater" : "greater than zero"}.`,
    );
  }

  return numericValue.toFixed(2);
}

export function optionalText(
  value: string | null | undefined,
  label: string,
  maximumLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maximumLength) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} cannot exceed ${maximumLength} characters.`,
    );
  }

  return normalized;
}
EOF

echo
echo "=== CREATE CATALOGUE WRITE SERVICE ==="

cat > src/server/catalog/write.ts <<'EOF'
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
  CreateCatalogProductInput,
  CreatedCatalogProduct,
} from "@/server/catalog/types";
import {
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

  const image = input.image
    ? {
        url: requireText(
          input.image.url,
          "Product image URL",
          2048,
        ),
        altText: optionalText(
          input.image.altText,
          "Image alternative text",
          300,
        ),
        position: 1,
        isPrimary: true,
      }
    : null;

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
            images: image
              ? {
                  create: image,
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
                                "Opening stock created with product",
                              referenceType:
                                "PRODUCT_CREATION",
                              referenceId:
                                globalProductSlug,
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
EOF

echo
echo "=== CREATE PUBLIC CATALOGUE READ SERVICE ==="

cat > src/server/catalog/read.ts <<'EOF'
import "server-only";

import {
  PriceType,
  ProductStatus,
  ProductVariantStatus,
  StorefrontProductStatus,
  StorefrontStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  PublicCatalogPrice,
  PublicCatalogProduct,
  PublicCatalogVariant,
} from "@/server/catalog/types";
import { normalizeSlug } from "@/server/catalog/validation";

interface PriceRecord {
  type: PriceType;
  amount: {
    toString(): string;
  };
  compareAtAmount: {
    toString(): string;
  } | null;
  currencyCode: string;
}

function chooseCurrentPrice(
  prices: readonly PriceRecord[],
): PublicCatalogPrice | null {
  const selected =
    prices.find((price) => price.type === PriceType.SALE) ??
    prices.find((price) => price.type === PriceType.REGULAR) ??
    null;

  if (!selected) {
    return null;
  }

  return {
    type: selected.type,
    amount: selected.amount.toString(),
    compareAtAmount:
      selected.compareAtAmount?.toString() ?? null,
    currencyCode: selected.currencyCode,
  };
}

async function queryPublicCatalogue(
  storefrontKey: string,
  listingSlug?: string,
): Promise<PublicCatalogProduct[]> {
  const now = new Date();

  const listings = await prisma.storefrontProduct.findMany({
    where: {
      storefront: {
        key: storefrontKey,
        status: StorefrontStatus.ACTIVE,
      },
      status: StorefrontProductStatus.ACTIVE,
      product: {
        status: ProductStatus.ACTIVE,
      },
      ...(listingSlug
        ? {
            slug: listingSlug,
          }
        : {}),
      AND: [
        {
          OR: [
            {
              publishedAt: null,
            },
            {
              publishedAt: {
                lte: now,
              },
            },
          ],
        },
        {
          OR: [
            {
              availableFrom: null,
            },
            {
              availableFrom: {
                lte: now,
              },
            },
          ],
        },
        {
          OR: [
            {
              availableUntil: null,
            },
            {
              availableUntil: {
                gt: now,
              },
            },
          ],
        },
      ],
    },
    include: {
      storefront: {
        select: {
          code: true,
          key: true,
          name: true,
          currencyCode: true,
        },
      },
      product: true,
      category: {
        select: {
          slug: true,
          name: true,
        },
      },
      images: {
        orderBy: [
          {
            isPrimary: "desc",
          },
          {
            position: "asc",
          },
        ],
      },
      variants: {
        where: {
          status: ProductVariantStatus.ACTIVE,
        },
        orderBy: [
          {
            isDefault: "desc",
          },
          {
            createdAt: "asc",
          },
        ],
        include: {
          options: {
            orderBy: {
              position: "asc",
            },
          },
          images: {
            orderBy: [
              {
                isPrimary: "desc",
              },
              {
                position: "asc",
              },
            ],
          },
          prices: {
            where: {
              isActive: true,
              AND: [
                {
                  OR: [
                    {
                      startsAt: null,
                    },
                    {
                      startsAt: {
                        lte: now,
                      },
                    },
                  ],
                },
                {
                  OR: [
                    {
                      endsAt: null,
                    },
                    {
                      endsAt: {
                        gt: now,
                      },
                    },
                  ],
                },
              ],
            },
          },
          inventory: true,
        },
      },
    },
    orderBy: [
      {
        isFeatured: "desc",
      },
      {
        sortOrder: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  const products: PublicCatalogProduct[] = [];

  for (const listing of listings) {
    const variants: PublicCatalogVariant[] = [];

    for (const variant of listing.variants) {
      const price = chooseCurrentPrice(variant.prices);

      if (!price) {
        continue;
      }

      const inventory = variant.inventory;

      const availableQuantity =
        !inventory || !inventory.isTracked
          ? null
          : Math.max(
              0,
              inventory.quantityOnHand -
                inventory.quantityReserved,
            );

      const isInStock =
        !inventory ||
        !inventory.isTracked ||
        inventory.allowBackorder ||
        (availableQuantity ?? 0) > 0;

      variants.push({
        id: variant.id,
        sku: variant.sku,
        title: variant.title,
        options: variant.options.map((option) => ({
          name: option.name,
          value: option.value,
        })),
        price,
        imageUrl:
          variant.images[0]?.url ??
          listing.images[0]?.url ??
          null,
        availableQuantity,
        isInStock,
        allowBackorder:
          inventory?.allowBackorder ?? false,
      });
    }

    if (variants.length === 0) {
      continue;
    }

    products.push({
      id: listing.id,
      productId: listing.product.id,
      storefrontCode: listing.storefront.code,
      storefrontKey: listing.storefront.key,
      storefrontName: listing.storefront.name,
      currencyCode: listing.storefront.currencyCode,
      slug: listing.slug,
      name: listing.product.name,
      shortDescription:
        listing.product.shortDescription,
      description: listing.product.description,
      brand: listing.product.brand,
      category: listing.category,
      primaryImageUrl:
        listing.images[0]?.url ??
        variants[0]?.imageUrl ??
        null,
      isFeatured: listing.isFeatured,
      variants,
    });
  }

  return products;
}

export async function getPublicStorefrontCatalogue(
  storefrontKeyInput: string,
): Promise<PublicCatalogProduct[]> {
  const storefrontKey = normalizeSlug(
    storefrontKeyInput,
    "Storefront key",
    50,
  );

  return queryPublicCatalogue(storefrontKey);
}

export async function getPublicStorefrontProduct(
  storefrontKeyInput: string,
  listingSlugInput: string,
): Promise<PublicCatalogProduct | null> {
  const storefrontKey = normalizeSlug(
    storefrontKeyInput,
    "Storefront key",
    50,
  );

  const listingSlug = normalizeSlug(
    listingSlugInput,
    "Listing slug",
  );

  const products = await queryPublicCatalogue(
    storefrontKey,
    listingSlug,
  );

  return products[0] ?? null;
}
EOF

echo
echo "=== CREATE INVENTORY ADJUSTMENT SERVICE ==="

cat > src/server/catalog/inventory.ts <<'EOF'
import "server-only";

import { randomUUID } from "node:crypto";
import {
  Prisma,
  StockMovementType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CatalogServiceError } from "@/server/catalog/errors";
import type {
  AdjustedInventory,
  AdjustVariantStockInput,
} from "@/server/catalog/types";
import {
  normalizeSku,
  normalizeSlug,
  optionalText,
  requireInteger,
  requireText,
} from "@/server/catalog/validation";

interface InventoryAdjustmentRow {
  inventoryId: string;
  sku: string;
  quantityOnHand: number;
  quantityReserved: number;
}

const allowedAdjustmentTypes = new Set<StockMovementType>([
  StockMovementType.PURCHASE,
  StockMovementType.ADJUSTMENT,
  StockMovementType.RETURN,
  StockMovementType.DAMAGE,
]);

export async function adjustVariantStock(
  input: AdjustVariantStockInput,
): Promise<AdjustedInventory> {
  const storefrontKey = normalizeSlug(
    input.storefrontKey,
    "Storefront key",
    50,
  );

  const sku = normalizeSku(input.sku);

  if (
    !Number.isInteger(input.quantityDelta) ||
    input.quantityDelta === 0
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Stock adjustment must be a non-zero integer.",
    );
  }

  if (!allowedAdjustmentTypes.has(input.type)) {
    throw new CatalogServiceError(
      "VALIDATION",
      "This stock movement type cannot be used for a manual stock adjustment.",
    );
  }

  const reason = requireText(
    input.reason,
    "Stock adjustment reason",
    500,
  );

  const referenceType = optionalText(
    input.referenceType,
    "Reference type",
    80,
  );

  const referenceId = optionalText(
    input.referenceId,
    "Reference ID",
    160,
  );

  const movementId = randomUUID();

  const rows = await prisma.$queryRaw<
    InventoryAdjustmentRow[]
  >(Prisma.sql`
    WITH target AS (
      SELECT
        i.id,
        i."quantityOnHand",
        i."quantityReserved",
        v.sku
      FROM inventories AS i
      INNER JOIN product_variants AS v
        ON v.id = i."productVariantId"
      INNER JOIN storefront_products AS sp
        ON sp.id = v."storefrontProductId"
      INNER JOIN storefronts AS s
        ON s.id = sp."storefrontId"
      WHERE
        s.key = ${storefrontKey}
        AND v.sku = ${sku}
      FOR UPDATE
    ),
    updated AS (
      UPDATE inventories AS i
      SET
        "quantityOnHand" =
          target."quantityOnHand" + ${input.quantityDelta},
        "updatedAt" = CURRENT_TIMESTAMP
      FROM target
      WHERE
        i.id = target.id
        AND target."quantityOnHand" +
          ${input.quantityDelta} >=
          target."quantityReserved"
      RETURNING
        i.id AS "inventoryId",
        target.sku AS sku,
        i."quantityOnHand" AS "quantityOnHand",
        i."quantityReserved" AS "quantityReserved"
    ),
    movement AS (
      INSERT INTO stock_movements (
        id,
        "inventoryId",
        type,
        "quantityDelta",
        "quantityOnHandAfter",
        "quantityReservedAfter",
        reason,
        "referenceType",
        "referenceId",
        "createdAt"
      )
      SELECT
        ${movementId},
        updated."inventoryId",
        CAST(${input.type} AS "StockMovementType"),
        ${input.quantityDelta},
        updated."quantityOnHand",
        updated."quantityReserved",
        ${reason},
        ${referenceType},
        ${referenceId},
        CURRENT_TIMESTAMP
      FROM updated
      RETURNING id
    )
    SELECT
      updated."inventoryId",
      updated.sku,
      updated."quantityOnHand",
      updated."quantityReserved"
    FROM updated
    INNER JOIN movement
      ON TRUE
  `);

  const adjusted = rows[0];

  if (!adjusted) {
    const discovered =
      await prisma.productVariant.findFirst({
        where: {
          sku,
          storefrontProduct: {
            storefront: {
              key: storefrontKey,
            },
          },
        },
        include: {
          inventory: true,
        },
      });

    if (!discovered) {
      throw new CatalogServiceError(
        "NOT_FOUND",
        `Variant ${sku} was not found in ${storefrontKey}.`,
      );
    }

    if (!discovered.inventory) {
      throw new CatalogServiceError(
        "NOT_FOUND",
        `Variant ${sku} does not have an inventory record.`,
      );
    }

    const attemptedQuantity =
      discovered.inventory.quantityOnHand +
      input.quantityDelta;

    if (
      attemptedQuantity <
      discovered.inventory.quantityReserved
    ) {
      throw new CatalogServiceError(
        "INSUFFICIENT_STOCK",
        "Stock on hand cannot be reduced below reserved stock.",
        {
          quantityOnHand:
            discovered.inventory.quantityOnHand,
          quantityReserved:
            discovered.inventory.quantityReserved,
          attemptedQuantity,
        },
      );
    }

    throw new CatalogServiceError(
      "CONFLICT",
      "The stock adjustment could not be completed.",
    );
  }

  requireInteger(
    adjusted.quantityOnHand,
    "Updated stock",
    0,
  );

  return {
    inventoryId: adjusted.inventoryId,
    sku: adjusted.sku,
    quantityOnHand: adjusted.quantityOnHand,
    quantityReserved: adjusted.quantityReserved,
    availableQuantity:
      adjusted.quantityOnHand -
      adjusted.quantityReserved,
  };
}
EOF

echo
echo "=== CREATE SERVICE EXPORTS ==="

cat > src/server/catalog/index.ts <<'EOF'
export {
  CatalogServiceError,
  type CatalogErrorCode,
} from "@/server/catalog/errors";

export {
  adjustVariantStock,
} from "@/server/catalog/inventory";

export {
  getPublicStorefrontCatalogue,
  getPublicStorefrontProduct,
} from "@/server/catalog/read";

export {
  createCatalogProduct,
} from "@/server/catalog/write";

export type {
  AdjustedInventory,
  AdjustVariantStockInput,
  CatalogImageInput,
  CatalogPriceInput,
  CatalogVariantOptionInput,
  CreatedCatalogProduct,
  CreateCatalogProductInput,
  PublicCatalogOption,
  PublicCatalogPrice,
  PublicCatalogProduct,
  PublicCatalogVariant,
} from "@/server/catalog/types";
EOF

echo
echo "=== CREATE CATALOGUE SERVICE AUDIT ==="

cat > scripts/audit-catalog-services.ts <<'EOF'
import "dotenv/config";

import assert from "node:assert/strict";
import {
  ProductStatus,
  StockMovementType,
  StorefrontProductStatus,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  adjustVariantStock,
  CatalogServiceError,
  createCatalogProduct,
  getPublicStorefrontCatalogue,
  getPublicStorefrontProduct,
} from "../src/server/catalog";

const auditToken = Date.now().toString();
const listingSlug = `service-audit-${auditToken}`;
const sku = `ATI-SVC-${auditToken}`;
const globalProductSlug = `atiloszy-${listingSlug}`;

async function audit(): Promise<void> {
  const productCountBefore =
    await prisma.product.count();

  let createdProductId: string | null = null;

  try {
    await assert.rejects(
      () =>
        createCatalogProduct({
          storefrontKey: "atiloszy",
          categorySlug: "shoes",
          listingSlug: `invalid-prefix-${auditToken}`,
          name: "Invalid prefix audit product",
          productStatus: ProductStatus.DRAFT,
          listingStatus:
            StorefrontProductStatus.DRAFT,
          variant: {
            sku: `WRONG-${auditToken}`,
            title: "Default",
            price: {
              amount: "100.00",
            },
            initialStock: 0,
          },
        }),
      (error: unknown) =>
        error instanceof CatalogServiceError &&
        error.code === "VALIDATION",
      "A product with an invalid SKU prefix was accepted.",
    );

    const created = await createCatalogProduct({
      storefrontKey: "atiloszy",
      categorySlug: "shoes",
      listingSlug,
      name: "Temporary catalogue service audit product",
      shortDescription:
        "Temporary product used to verify the server-side catalogue services.",
      description:
        "This product must be removed automatically when the audit completes.",
      brand: "SORVYRA Audit",
      productStatus: ProductStatus.ACTIVE,
      listingStatus:
        StorefrontProductStatus.ACTIVE,
      isFeatured: true,
      isDemo: true,
      publishedAt: new Date(
        Date.now() - 60_000,
      ),
      image: {
        url: "https://example.invalid/catalogue-service-audit.jpg",
        altText:
          "Temporary catalogue service audit product",
      },
      variant: {
        sku,
        title: "Black / Size 42",
        options: [
          {
            name: "Colour",
            value: "Black",
            position: 1,
          },
          {
            name: "Size",
            value: "42",
            position: 2,
          },
        ],
        price: {
          amount: "15000.00",
          compareAtAmount: "17500.00",
          costAmount: "9000.00",
        },
        initialStock: 4,
        reorderLevel: 1,
        isTracked: true,
        allowBackorder: false,
      },
    });

    createdProductId = created.productId;

    assert.equal(created.storefrontCode, "ATI");
    assert.equal(created.currencyCode, "NGN");
    assert.ok(created.sku.startsWith("ATI-"));

    const product =
      await getPublicStorefrontProduct(
        "atiloszy",
        listingSlug,
      );

    assert.ok(
      product,
      "Published audit product was not returned.",
    );

    assert.equal(product.storefrontCode, "ATI");
    assert.equal(product.currencyCode, "NGN");
    assert.equal(product.variants.length, 1);

    const initialVariant = product.variants[0];

    assert.equal(
      initialVariant.price.amount,
      "15000",
    );

    assert.equal(
      initialVariant.price.currencyCode,
      "NGN",
    );

    assert.equal(
      initialVariant.availableQuantity,
      4,
    );

    assert.equal(initialVariant.isInStock, true);

    const afterPurchase = await adjustVariantStock({
      storefrontKey: "atiloszy",
      sku,
      quantityDelta: 3,
      type: StockMovementType.PURCHASE,
      reason:
        "Temporary service audit purchase adjustment",
      referenceType: "SERVICE_AUDIT",
      referenceId: auditToken,
    });

    assert.equal(afterPurchase.quantityOnHand, 7);
    assert.equal(afterPurchase.availableQuantity, 7);

    const afterDamage = await adjustVariantStock({
      storefrontKey: "atiloszy",
      sku,
      quantityDelta: -2,
      type: StockMovementType.DAMAGE,
      reason:
        "Temporary service audit damage adjustment",
      referenceType: "SERVICE_AUDIT",
      referenceId: auditToken,
    });

    assert.equal(afterDamage.quantityOnHand, 5);
    assert.equal(afterDamage.availableQuantity, 5);

    await assert.rejects(
      () =>
        adjustVariantStock({
          storefrontKey: "atiloszy",
          sku,
          quantityDelta: -100,
          type: StockMovementType.ADJUSTMENT,
          reason:
            "Temporary invalid negative adjustment",
        }),
      (error: unknown) =>
        error instanceof CatalogServiceError &&
        error.code === "INSUFFICIENT_STOCK",
      "An adjustment below reserved stock was accepted.",
    );

    const catalogue =
      await getPublicStorefrontCatalogue(
        "atiloszy",
      );

    assert.ok(
      catalogue.some(
        (entry) => entry.slug === listingSlug,
      ),
      "Audit product was absent from the public catalogue.",
    );

    const inventory =
      await prisma.inventory.findUniqueOrThrow({
        where: {
          productVariantId: created.variantId,
        },
        include: {
          movements: true,
        },
      });

    assert.equal(inventory.quantityOnHand, 5);

    assert.equal(
      inventory.movements.length,
      3,
      "Expected opening stock and two adjustments.",
    );

    console.log("=== CATALOGUE SERVICE AUDIT ===");
    console.log(`Storefront: ${created.storefrontCode}`);
    console.log(`Currency: ${created.currencyCode}`);
    console.log(`SKU prefix: ${created.sku.split("-")[0]}`);
    console.log("Opening stock: 4");
    console.log("Stock after adjustments: 5");
    console.log(
      `Stock movements: ${inventory.movements.length}`,
    );
    console.log("");
    console.log(
      "PASS: Invalid SKU prefix was rejected.",
    );
    console.log(
      "PASS: Product creation service completed.",
    );
    console.log(
      "PASS: Public catalogue read service completed.",
    );
    console.log(
      "PASS: Storefront currency was enforced.",
    );
    console.log(
      "PASS: Atomic stock adjustments completed.",
    );
    console.log(
      "PASS: Invalid negative stock was rejected.",
    );
  } finally {
    if (createdProductId) {
      await prisma.product.deleteMany({
        where: {
          id: createdProductId,
        },
      });
    }

    await prisma.product.deleteMany({
      where: {
        slug: globalProductSlug,
      },
    });
  }

  const productCountAfter =
    await prisma.product.count();

  assert.equal(
    productCountAfter,
    productCountBefore,
    "Temporary service audit product was not removed.",
  );

  console.log(
    "PASS: Temporary service records removed.",
  );

  console.log(
    "PASS: Catalogue service audit completed.",
  );
}

audit()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(
      "FAIL: Catalogue service audit failed.",
    );

    console.error(error);

    await prisma.$disconnect();

    process.exit(1);
  });
EOF

echo
echo "=== ADD SERVICE AUDIT COMMAND ==="

npm pkg set \
  scripts.db:audit:services="node --conditions=react-server --import tsx scripts/audit-catalog-services.ts"

echo
echo "=== RUN SERVICE AUDIT ==="

npm run db:audit:services

echo
echo "=== CONFIRM FOUNDATION AUDITS ==="

npm run db:audit
npm run db:audit:catalog

echo
echo "=== APPLICATION VALIDATION ==="

npm run lint
npm run build

echo
echo "=== PHASE 2D CHANGES ==="

git status --short
git diff --check

echo
echo "PHASE 2D SETUP COMPLETED"
