import "server-only";

import {
  CategoryStatus,
  PriceType,
  ProductStatus,
  ProductVariantStatus,
  StockMovementType,
  StorefrontProductStatus,
  StorefrontStaffRole,
  StorefrontStaffStatus,
  StorefrontStatus,
  UserStatus,
} from "@/generated/prisma/client";
import {
  prisma,
} from "@/lib/prisma";

import {
  CatalogServiceError,
} from "./errors";
import {
  adjustVariantStock,
} from "./inventory";
import type {
  AdjustManagedCatalogStockInput,
  AdjustedInventory,
  CatalogImageInput,
  CreateManagedCatalogProductInput,
  CreatedCatalogProduct,
  ManagedCatalogProductFields,
  ManagedCatalogVariantInput,
  ManagedCatalogImageSelectionInput,
  ManagerCatalogView,
  UploadedManagedCatalogImage,
  UpdateManagedCatalogProductInput,
} from "./types";
import {
  getCatalogMediaCapabilities,
  issueCatalogMediaToken,
  MAX_CATALOG_IMAGES,
  prepareCatalogImage,
  resolveCatalogMediaProvider,
  verifyCatalogMediaToken,
} from "./media";
import {
  normalizeImageUrl,
  normalizeSku,
  normalizeSlug,
  normalizeStorefrontCode,
  moneyToMinorUnits,
  optionalText,
  requireInteger,
  requireMoney,
  requireText,
} from "./validation";
import {
  createCatalogProduct,
} from "./write";

interface ManagerCatalogContext {
  membershipId: string;
  userId: string;
  email: string;
  storefront: {
    id: string;
    code: string;
    key: string;
    name: string;
    currencyCode: string;
  };
}

interface NormalizedManagedProductFields {
  categorySlug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  listingStatus:
    StorefrontProductStatus;
  isFeatured: boolean;
  maxPerOrder: number | null;
  imageUrl: string | null;
  imageAltText: string | null;
  images:
    ManagedCatalogImageSelectionInput[] |
    undefined;
  variantTitle: string;
  priceAmount: string;
  compareAtAmount: string | null;
  costAmount: string | null;
  reorderLevel: number;
  isTracked: boolean;
  allowBackorder: boolean;
  variants: NormalizedManagedVariant[] | null;
}

interface NormalizedManagedVariant {
  id: string | null;
  sku: string;
  title: string;
  size: string | null;
  color: string | null;
  priceAmount: string;
  compareAtAmount: string | null;
  costAmount: string | null;
  initialStock: number | null;
  reorderLevel: number;
  isTracked: boolean;
  allowBackorder: boolean;
  status: ProductVariantStatus;
  sellingUnitLabel: string;
  unitsPerSellingUnit: number;
  quantityPriceTiers: Array<{
    minimumQuantity: number;
    unitAmount: string;
  }>;
}

type ResolvedManagedCatalogImage =
  | {
      kind: "existing";
      id: string;
      altText: string | null;
    }
  | {
      kind: "upload";
      image: CatalogImageInput;
      altText: string | null;
    };

const editableListingStatuses =
  new Set<StorefrontProductStatus>([
    StorefrontProductStatus.DRAFT,
    StorefrontProductStatus.ACTIVE,
    StorefrontProductStatus.HIDDEN,
    StorefrontProductStatus.ARCHIVED,
  ]);

function isUniqueConstraintError(
  error: unknown,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

async function requireManagerCatalogContext(
  storefrontCodeInput: string,
  userIdInput: string,
): Promise<ManagerCatalogContext> {
  const storefrontCode =
    normalizeStorefrontCode(
      storefrontCodeInput,
    );
  const userId = requireText(
    userIdInput,
    "Manager identity",
    191,
  );

  const membership =
    await prisma
      .storefrontStaffMembership
      .findFirst({
        where: {
          userId,
          role:
            StorefrontStaffRole
              .MANAGER,
          status:
            StorefrontStaffStatus
              .ACTIVE,
          storefront: {
            code: storefrontCode,
            status:
              StorefrontStatus.ACTIVE,
          },
          user: {
            status: UserStatus.ACTIVE,
            emailVerifiedAt: {
              not: null,
            },
            deletedAt: null,
          },
        },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              email: true,
            },
          },
          storefront: {
            select: {
              id: true,
              code: true,
              key: true,
              name: true,
              currencyCode: true,
            },
          },
        },
      });

  if (!membership) {
    throw new CatalogServiceError(
      "MANAGER_ACCESS_REQUIRED",
      "Active manager access is required for this storefront catalogue.",
    );
  }

  return {
    membershipId: membership.id,
    userId: membership.userId,
    email: membership.user.email,
    storefront:
      membership.storefront,
  };
}

function requireBoolean(
  value: boolean,
  label: string,
): boolean {
  if (typeof value !== "boolean") {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} must be true or false.`,
    );
  }

  return value;
}

function normalizeManagedImageSelections(
  images:
    readonly ManagedCatalogImageSelectionInput[] |
    undefined,
):
  ManagedCatalogImageSelectionInput[] |
  undefined {
  if (images === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(images) ||
    images.length >
      MAX_CATALOG_IMAGES
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `A product can have no more than ${MAX_CATALOG_IMAGES} photos.`,
    );
  }

  const normalized =
    images.map(
      (image, index) => {
        if (
          typeof image !==
            "object" ||
          image === null
        ) {
          throw new CatalogServiceError(
            "VALIDATION",
            `Product photo ${index + 1} is invalid.`,
          );
        }

        const existingImageId =
          optionalText(
            image.existingImageId,
            `Product photo ${index + 1} identifier`,
            191,
          );
        const uploadToken =
          optionalText(
            image.uploadToken,
            `Product photo ${index + 1} upload attachment`,
            8_192,
          );

        if (
          Boolean(
            existingImageId,
          ) ===
          Boolean(uploadToken)
        ) {
          throw new CatalogServiceError(
            "VALIDATION",
            "Each product photo must be an existing photo or a new secure upload.",
          );
        }

        return {
          existingImageId,
          uploadToken,
          altText:
            optionalText(
              image.altText,
              `Product photo ${index + 1} description`,
              300,
            ),
        };
      },
    );

  const identities =
    normalized.map(
      (image) =>
        image.existingImageId ??
        image.uploadToken!,
    );

  if (
    new Set(identities).size !==
    identities.length
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "A product photo cannot be attached more than once.",
    );
  }

  return normalized;
}

function resolveManagedImageSelections(
  images:
    readonly ManagedCatalogImageSelectionInput[],
  storefrontCode: string,
): ResolvedManagedCatalogImage[] {
  return images.map(
    (selection) => {
      if (
        selection.existingImageId
      ) {
        return {
          kind: "existing",
          id:
            selection.existingImageId,
          altText:
            selection.altText ??
            null,
        };
      }

      return {
        kind: "upload",
        image:
          verifyCatalogMediaToken(
            selection.uploadToken!,
            storefrontCode,
          ),
        altText:
          selection.altText ??
          null,
      };
    },
  );
}

function normalizeManagedVariant(
  input: ManagedCatalogVariantInput,
  index: number,
): NormalizedManagedVariant {
  const label = `Variant ${index + 1}`;
  const priceAmount = requireMoney(
    input.priceAmount,
    `${label} selling price`,
  );
  const compareAtAmount =
    input.compareAtAmount === null ||
    input.compareAtAmount === undefined ||
    input.compareAtAmount.trim() === ""
      ? null
      : requireMoney(
          input.compareAtAmount,
          `${label} compare-at price`,
        );
  const costAmount =
    input.costAmount === null ||
    input.costAmount === undefined ||
    input.costAmount.trim() === ""
      ? null
      : requireMoney(
          input.costAmount,
          `${label} cost price`,
          true,
        );

  if (
    compareAtAmount !== null &&
    moneyToMinorUnits(compareAtAmount) <=
      moneyToMinorUnits(priceAmount)
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} compare-at price must be greater than its selling price.`,
    );
  }

  const status = input.status ?? ProductVariantStatus.ACTIVE;

  if (!Object.values(ProductVariantStatus).includes(status)) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} availability is invalid.`,
    );
  }

  if ((input.quantityPriceTiers?.length ?? 0) > 10) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} cannot have more than 10 quantity discounts.`,
    );
  }

  const quantityPriceTiers = (input.quantityPriceTiers ?? [])
    .map((tier, tierIndex) => ({
      minimumQuantity: requireInteger(
        tier.minimumQuantity,
        `${label} discount ${tierIndex + 1} minimum quantity`,
        2,
      ),
      unitAmount: requireMoney(
        tier.unitAmount,
        `${label} discount ${tierIndex + 1} unit price`,
      ),
    }))
    .sort((left, right) => left.minimumQuantity - right.minimumQuantity);

  if (
    new Set(quantityPriceTiers.map((tier) => tier.minimumQuantity)).size !==
    quantityPriceTiers.length
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      `${label} discount quantities must be unique.`,
    );
  }

  for (const [tierIndex, tier] of quantityPriceTiers.entries()) {
    const previousAmount =
      tierIndex === 0
        ? priceAmount
        : quantityPriceTiers[tierIndex - 1]!.unitAmount;

    if (
      moneyToMinorUnits(tier.unitAmount) >=
      moneyToMinorUnits(previousAmount)
    ) {
      throw new CatalogServiceError(
        "VALIDATION",
        `${label} quantity discounts must become cheaper as quantity increases.`,
      );
    }
  }

  return {
    id: optionalText(input.id, `${label} identifier`, 191),
    sku: normalizeSku(input.sku),
    title: requireText(input.title, `${label} name`, 240),
    size: optionalText(input.size, `${label} size`, 120),
    color: optionalText(input.color, `${label} colour`, 120),
    priceAmount,
    compareAtAmount,
    costAmount,
    initialStock:
      input.initialStock === undefined
        ? null
        : requireInteger(
            input.initialStock,
            `${label} opening stock`,
            0,
          ),
    reorderLevel: requireInteger(
      input.reorderLevel,
      `${label} reorder level`,
      0,
    ),
    isTracked:
      typeof input.isTracked === "boolean"
        ? input.isTracked
        : (() => {
            throw new CatalogServiceError(
              "VALIDATION",
              `${label} inventory tracking is invalid.`,
            );
          })(),
    allowBackorder:
      typeof input.allowBackorder === "boolean"
        ? input.allowBackorder
        : (() => {
            throw new CatalogServiceError(
              "VALIDATION",
              `${label} backorder setting is invalid.`,
            );
          })(),
    status,
    sellingUnitLabel:
      optionalText(input.sellingUnitLabel, `${label} selling unit`, 80) ??
      "item",
    unitsPerSellingUnit: requireInteger(
      input.unitsPerSellingUnit ?? 1,
      `${label} pieces per selling unit`,
      1,
    ),
    quantityPriceTiers,
  };
}

function normalizeManagedProductFields(
  input: ManagedCatalogProductFields,
): NormalizedManagedProductFields {
  if (
    !editableListingStatuses.has(
      input.listingStatus,
    )
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Product publication status is invalid.",
    );
  }

  const priceAmount = requireMoney(
    input.priceAmount,
    "Selling price",
  );
  const compareAtAmount =
    input.compareAtAmount === null ||
    input.compareAtAmount ===
      undefined ||
    input.compareAtAmount.trim() ===
      ""
      ? null
      : requireMoney(
          input.compareAtAmount,
          "Compare-at price",
        );
  const costAmount =
    input.costAmount === null ||
    input.costAmount === undefined ||
    input.costAmount.trim() === ""
      ? null
      : requireMoney(
          input.costAmount,
          "Cost price",
          true,
        );

  if (
    compareAtAmount !== null &&
    moneyToMinorUnits(compareAtAmount) <=
      moneyToMinorUnits(priceAmount)
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Compare-at price must be greater than the selling price.",
    );
  }

  const rawImageUrl =
    optionalText(
      input.imageUrl,
      "Product image URL",
      2048,
    );

  const variants =
    input.variants === undefined
      ? null
      : input.variants.map(
          normalizeManagedVariant,
        );

  if (variants && (variants.length === 0 || variants.length > 100)) {
    throw new CatalogServiceError(
      "VALIDATION",
      "A product must have between 1 and 100 variants.",
    );
  }

  if (variants) {
    const skus = new Set(variants.map((variant) => variant.sku));
    const ids = variants
      .map((variant) => variant.id)
      .filter((id): id is string => id !== null);
    const combinations = new Set(
      variants.map((variant) =>
        `${variant.size ?? ""}\u0000${variant.color ?? ""}`.toLowerCase(),
      ),
    );

    if (skus.size !== variants.length) {
      throw new CatalogServiceError(
        "VALIDATION",
        "Every product variant must have a unique SKU.",
      );
    }

    if (new Set(ids).size !== ids.length) {
      throw new CatalogServiceError(
        "VALIDATION",
        "A product variant was submitted more than once.",
      );
    }

    if (
      variants.length > 1 &&
      combinations.size !== variants.length
    ) {
      throw new CatalogServiceError(
        "VALIDATION",
        "Every size and colour combination must be unique.",
      );
    }
  }

  return {
    categorySlug: normalizeSlug(
      input.categorySlug,
      "Category",
      100,
    ),
    name: requireText(
      input.name,
      "Product name",
      240,
    ),
    shortDescription:
      optionalText(
        input.shortDescription,
        "Short description",
        500,
      ),
    description: optionalText(
      input.description,
      "Description",
      10_000,
    ),
    brand: optionalText(
      input.brand,
      "Brand",
      160,
    ),
    listingStatus:
      input.listingStatus,
    isFeatured: requireBoolean(
      input.isFeatured,
      "Featured status",
    ),
    maxPerOrder:
      input.maxPerOrder === null ||
      input.maxPerOrder ===
        undefined
        ? null
        : requireInteger(
            input.maxPerOrder,
            "Maximum quantity per order",
            1,
          ),
    imageUrl:
      rawImageUrl === null
        ? null
        : normalizeImageUrl(
            rawImageUrl,
          ),
    imageAltText:
      optionalText(
        input.imageAltText,
        "Image alternative text",
        300,
      ),
    images:
      normalizeManagedImageSelections(
        input.images,
      ),
    variantTitle: requireText(
      input.variantTitle,
      "Variant title",
      240,
    ),
    priceAmount,
    compareAtAmount,
    costAmount,
    reorderLevel: requireInteger(
      input.reorderLevel,
      "Reorder level",
      0,
    ),
    isTracked: requireBoolean(
      input.isTracked,
      "Inventory tracking",
    ),
    allowBackorder: requireBoolean(
      input.allowBackorder,
      "Backorder setting",
    ),
    variants,
  };
}

function productStatusForListing(
  status:
    StorefrontProductStatus,
): ProductStatus {
  if (
    status ===
    StorefrontProductStatus.ACTIVE ||
    status ===
    StorefrontProductStatus.HIDDEN
  ) {
    return ProductStatus.ACTIVE;
  }

  if (
    status ===
    StorefrontProductStatus.ARCHIVED
  ) {
    return ProductStatus.ARCHIVED;
  }

  return ProductStatus.DRAFT;
}

export async function getManagerCatalog(
  input: {
    storefrontCode: string;
    userId: string;
  },
): Promise<ManagerCatalogView> {
  const manager =
    await requireManagerCatalogContext(
      input.storefrontCode,
      input.userId,
    );

  const [
    categories,
    listings,
  ] = await Promise.all([
    prisma.category.findMany({
      where: {
        storefrontId:
          manager.storefront.id,
        status: {
          not: CategoryStatus.ARCHIVED,
        },
      },
      orderBy: [
        {
          position: "asc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
      },
    }),
    prisma.storefrontProduct
      .findMany({
        where: {
          storefrontId:
            manager.storefront.id,
        },
        take: 200,
        orderBy: [
          {
            updatedAt: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        include: {
          product: true,
          category: {
            select: {
              slug: true,
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
              prices: {
                where: {
                  isActive: true,
                },
                orderBy: {
                  createdAt: "desc",
                },
                include: {
                  quantityTiers: {
                    orderBy: {
                      minimumQuantity: "asc",
                    },
                  },
                },
              },
              inventory: {
                include: {
                  movements: {
                    orderBy: {
                      createdAt: "desc",
                    },
                    take: 8,
                  },
                },
              },
            },
          },
        },
      }),
  ]);

  const products: ManagerCatalogView["products"] =
    [];

  for (const listing of listings) {
    const variants = listing.variants.map((variant) => {
      const price =
        variant.prices.find(
          (candidate) => candidate.type === PriceType.REGULAR,
        ) ?? variant.prices[0];
      const inventory = variant.inventory;

      if (!price || !inventory) {
        throw new CatalogServiceError(
          "CONFLICT",
          `Catalogue listing "${listing.slug}" has a variant without an active price or inventory record.`,
        );
      }

      return {
        id: variant.id,
        sku: variant.sku,
        title: variant.title,
        status: variant.status,
        options: variant.options.map((option) => ({
          name: option.name,
          value: option.value,
        })),
        sellingUnitLabel: variant.sellingUnitLabel,
        unitsPerSellingUnit: variant.unitsPerSellingUnit,
        quantityPriceTiers: price.quantityTiers.map((tier) => ({
          minimumQuantity: tier.minimumQuantity,
          unitAmount: tier.unitAmount.toString(),
        })),
        price: {
          amount: price.amount.toString(),
          compareAtAmount:
            price.compareAtAmount?.toString() ?? null,
          costAmount: price.costAmount?.toString() ?? null,
          currencyCode: price.currencyCode,
        },
        inventory: {
          quantityOnHand: inventory.quantityOnHand,
          quantityReserved: inventory.quantityReserved,
          availableQuantity:
            inventory.quantityOnHand - inventory.quantityReserved,
          reorderLevel: inventory.reorderLevel,
          isTracked: inventory.isTracked,
          allowBackorder: inventory.allowBackorder,
          movements: inventory.movements.map((movement) => ({
            id: movement.id,
            type: movement.type,
            quantityDelta: movement.quantityDelta,
            quantityOnHandAfter: movement.quantityOnHandAfter,
            quantityReservedAfter: movement.quantityReservedAfter,
            reason: movement.reason,
            createdAt: movement.createdAt.toISOString(),
          })),
        },
      };
    });
    const variant = variants[0];

    if (!variant) {
      throw new CatalogServiceError(
        "CONFLICT",
        `Catalogue listing "${listing.slug}" is missing its managed variant.`,
      );
    }

    products.push({
      id: listing.id,
      productId:
        listing.productId,
      slug: listing.slug,
      name: listing.product.name,
      shortDescription:
        listing.product
          .shortDescription,
      description:
        listing.product.description,
      brand: listing.product.brand,
      categorySlug:
        listing.category?.slug ??
        "",
      listingStatus:
        listing.status,
      productStatus:
        listing.product.status,
      isFeatured:
        listing.isFeatured,
      maxPerOrder:
        listing.maxPerOrder,
      publishedAt:
        listing.publishedAt
          ?.toISOString() ?? null,
      updatedAt:
        listing.updatedAt
          .toISOString(),
      image: listing.images[0]
        ? {
            id:
              listing.images[0]
                .id,
            url:
              listing.images[0]
                .url,
            altText:
              listing.images[0]
                .altText,
          }
        : null,
      images:
        listing.images.map(
          (image) => ({
            id: image.id,
            url: image.url,
            altText:
              image.altText,
            position:
              image.position,
            isPrimary:
              image.isPrimary,
          }),
        ),
      variants,
      variant,
    });
  }

  return {
    manager: {
      email: manager.email,
    },
    storefront:
      manager.storefront,
    categories,
    products,
    media:
      getCatalogMediaCapabilities(),
  };
}

export async function createManagedCatalogProduct(
  input:
    CreateManagedCatalogProductInput,
): Promise<CreatedCatalogProduct> {
  const manager =
    await requireManagerCatalogContext(
      input.storefrontCode,
      input.userId,
    );
  const fields =
    normalizeManagedProductFields(
      input,
    );

  if (
    fields.listingStatus ===
    StorefrontProductStatus.ARCHIVED
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "A new product cannot begin in archived status.",
    );
  }

  const managedImages =
    fields.images === undefined
      ? null
      : resolveManagedImageSelections(
          fields.images,
          manager.storefront.code,
        );

  if (
    managedImages?.some(
      (image) =>
        image.kind ===
        "existing",
    )
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "A new product can use only newly uploaded photos.",
    );
  }

  const managedVariants =
    fields.variants ?? [
      {
        id: null,
        sku: normalizeSku(input.sku),
        title: fields.variantTitle,
        size: null,
        color: null,
        priceAmount: fields.priceAmount,
        compareAtAmount: fields.compareAtAmount,
        costAmount: fields.costAmount,
        initialStock: requireInteger(
          input.initialStock,
          "Opening stock",
          0,
        ),
        reorderLevel: fields.reorderLevel,
        isTracked: fields.isTracked,
        allowBackorder: fields.allowBackorder,
        status: ProductVariantStatus.ACTIVE,
        sellingUnitLabel: "item",
        unitsPerSellingUnit: 1,
        quantityPriceTiers: [],
      },
    ];
  const catalogVariants = managedVariants.map((variant, index) => {
    if (variant.initialStock === null) {
      throw new CatalogServiceError(
        "VALIDATION",
        `Variant ${index + 1} opening stock is required.`,
      );
    }

    return {
      sku: variant.sku,
      title: variant.title,
      status: variant.status,
      sellingUnitLabel: variant.sellingUnitLabel,
      unitsPerSellingUnit: variant.unitsPerSellingUnit,
      options: [
        ...(variant.size
          ? [{ name: "Size", value: variant.size, position: 1 }]
          : []),
        ...(variant.color
          ? [{ name: "Colour", value: variant.color, position: 2 }]
          : []),
      ],
      price: {
        amount: variant.priceAmount,
        compareAtAmount: variant.compareAtAmount,
        costAmount: variant.costAmount,
        type: PriceType.REGULAR,
        quantityTiers: variant.quantityPriceTiers,
      },
      initialStock: variant.initialStock,
      reorderLevel: variant.reorderLevel,
      isTracked: variant.isTracked,
      allowBackorder: variant.allowBackorder,
      openingStockReason:
        "Opening stock recorded by storefront manager",
      openingStockReferenceType: "MANAGER_CATALOG",
      openingStockReferenceId: manager.membershipId,
    };
  });

  if (
    fields.listingStatus === StorefrontProductStatus.ACTIVE &&
    managedVariants.every(
      (variant) => variant.status !== ProductVariantStatus.ACTIVE,
    )
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "A live product must have at least one available variant.",
    );
  }

  return createCatalogProduct({
    storefrontKey:
      manager.storefront.key,
    categorySlug:
      fields.categorySlug,
    listingSlug:
      input.listingSlug,
    name: fields.name,
    shortDescription:
      fields.shortDescription,
    description:
      fields.description,
    brand: fields.brand,
    productStatus:
      productStatusForListing(
        fields.listingStatus,
      ),
    listingStatus:
      fields.listingStatus,
    isFeatured:
      fields.isFeatured,
    isDemo: false,
    maxPerOrder:
      fields.maxPerOrder,
    publishedAt:
      fields.listingStatus ===
      StorefrontProductStatus.ACTIVE
        ? new Date()
        : null,
    image:
      managedImages === null &&
      fields.imageUrl
      ? {
          url: fields.imageUrl,
          altText:
            fields.imageAltText,
        }
      : null,
    images:
      managedImages === null
        ? undefined
        : managedImages.map(
            (selection) => ({
              ...(
                selection.kind ===
                "upload"
                  ? selection.image
                  : {}
              ),
              url:
                selection.kind ===
                "upload"
                  ? selection.image
                      .url
                  : "",
              altText:
                selection.altText,
            }),
          ),
    variant: catalogVariants[0]!,
    variants: catalogVariants,
  });
}

export async function updateManagedCatalogProduct(
  input:
    UpdateManagedCatalogProductInput,
): Promise<{
  storefrontProductId: string;
  slug: string;
}> {
  const manager =
    await requireManagerCatalogContext(
      input.storefrontCode,
      input.userId,
    );
  const fields =
    normalizeManagedProductFields(
      input,
    );
  const storefrontProductId =
    requireText(
      input.storefrontProductId,
      "Catalogue listing",
      191,
    );
  const managedImages =
    fields.images === undefined
      ? null
      : resolveManagedImageSelections(
          fields.images,
          manager.storefront.code,
        );

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const [
          category,
          listing,
        ] = await Promise.all([
          transaction.category
            .findFirst({
              where: {
                storefrontId:
                  manager.storefront.id,
                slug:
                  fields.categorySlug,
                status: {
                  not:
                    CategoryStatus
                      .ARCHIVED,
                },
              },
              select: {
                id: true,
              },
            }),
          transaction
            .storefrontProduct
            .findFirst({
              where: {
                id:
                  storefrontProductId,
                storefrontId:
                  manager.storefront.id,
              },
              include: {
                images: {
                  orderBy: [
                    {
                      isPrimary:
                        "desc",
                    },
                    {
                      position:
                        "asc",
                    },
                  ],
                },
                variants: {
                  orderBy: [
                    {
                      isDefault:
                        "desc",
                    },
                    {
                      createdAt:
                        "asc",
                    },
                  ],
                  select: {
                    id: true,
                    sku: true,
                  },
                },
              },
            }),
        ]);

        if (!category) {
          throw new CatalogServiceError(
            "NOT_FOUND",
            "The selected category is not available in this storefront.",
          );
        }

        if (!listing) {
          throw new CatalogServiceError(
            "NOT_FOUND",
            "The catalogue product was not found in this storefront.",
          );
        }

        const variant = listing.variants[0];

        if (!variant) {
          throw new CatalogServiceError(
            "CONFLICT",
            "The catalogue product is missing its managed variant.",
          );
        }

        const variants =
          fields.variants ?? [
            {
              id: variant.id,
              sku: variant.sku,
              title: fields.variantTitle,
              size: null,
              color: null,
              priceAmount: fields.priceAmount,
              compareAtAmount: fields.compareAtAmount,
              costAmount: fields.costAmount,
              initialStock: null,
              reorderLevel: fields.reorderLevel,
              isTracked: fields.isTracked,
              allowBackorder: fields.allowBackorder,
              status: ProductVariantStatus.ACTIVE,
              sellingUnitLabel: "item",
              unitsPerSellingUnit: 1,
              quantityPriceTiers: [],
            },
          ];
        const existingById = new Map(
          listing.variants.map((candidate) => [candidate.id, candidate]),
        );
        const submittedExistingIds = new Set(
          variants
            .map((candidate) => candidate.id)
            .filter((id): id is string => id !== null),
        );

        if (
          fields.variants &&
          listing.variants.some(
            (candidate) => !submittedExistingIds.has(candidate.id),
          )
        ) {
          throw new CatalogServiceError(
            "VALIDATION",
            "Existing variants cannot be deleted. Mark a variant unavailable instead.",
          );
        }

        for (const candidate of variants) {
          if (candidate.id) {
            const existing = existingById.get(candidate.id);

            if (!existing) {
              throw new CatalogServiceError(
                "NOT_FOUND",
                "A submitted variant does not belong to this storefront product.",
              );
            }

            if (candidate.sku !== existing.sku) {
              throw new CatalogServiceError(
                "VALIDATION",
                "Existing variant SKUs are locked after creation.",
              );
            }
          } else if (!candidate.sku.startsWith(`${manager.storefront.code}-`)) {
            throw new CatalogServiceError(
              "VALIDATION",
              `New variant SKUs must begin with ${manager.storefront.code}-.`,
            );
          }
        }

        if (
          fields.listingStatus === StorefrontProductStatus.ACTIVE &&
          variants.every(
            (candidate) => candidate.status !== ProductVariantStatus.ACTIVE,
          )
        ) {
          throw new CatalogServiceError(
            "VALIDATION",
            "A live product must have at least one available variant.",
          );
        }

        const changedAt =
          new Date();
        const productStatus =
          productStatusForListing(
            fields.listingStatus,
          );

        await transaction.product
          .update({
            where: {
              id: listing.productId,
            },
            data: {
              name: fields.name,
              shortDescription:
                fields.shortDescription,
              description:
                fields.description,
              brand: fields.brand,
              status:
                productStatus,
            },
          });

        await transaction
          .storefrontProduct
          .update({
            where: {
              id:
                storefrontProductId,
            },
            data: {
              categoryId:
                category.id,
              status:
                fields.listingStatus,
              isFeatured:
                fields.isFeatured,
              maxPerOrder:
                fields.maxPerOrder,
              publishedAt:
                fields.listingStatus ===
                StorefrontProductStatus
                  .ACTIVE
                  ? listing
                      .publishedAt ??
                    changedAt
                  : listing
                      .publishedAt,
            },
          });

        for (const candidate of variants) {
          const options = [
            ...(candidate.size
              ? [{ name: "Size", value: candidate.size, position: 1 }]
              : []),
            ...(candidate.color
              ? [{ name: "Colour", value: candidate.color, position: 2 }]
              : []),
          ];
          const status =
            fields.listingStatus === StorefrontProductStatus.ARCHIVED
              ? ProductVariantStatus.DISCONTINUED
              : candidate.status;
          let variantId = candidate.id;

          if (variantId) {
            await transaction.productVariant.update({
              where: { id: variantId },
              data: {
                title: candidate.title,
                status,
                ...(fields.variants
                  ? {
                      sellingUnitLabel: candidate.sellingUnitLabel,
                      unitsPerSellingUnit: candidate.unitsPerSellingUnit,
                    }
                  : {}),
              },
            });

            if (fields.variants) {
              await transaction.variantOption.deleteMany({
                where: { productVariantId: variantId },
              });

              if (options.length > 0) {
                await transaction.variantOption.createMany({
                  data: options.map((option) => ({
                    productVariantId: variantId!,
                    ...option,
                  })),
                });
              }
            }

            await transaction.storefrontPrice.updateMany({
              where: {
                productVariantId: variantId,
                isActive: true,
              },
              data: {
                isActive: false,
                endsAt: changedAt,
              },
            });
            await transaction.storefrontPrice.create({
              data: {
                productVariantId: variantId,
                currencyCode: manager.storefront.currencyCode,
                type: PriceType.REGULAR,
                amount: candidate.priceAmount,
                compareAtAmount: candidate.compareAtAmount,
                costAmount: candidate.costAmount,
                startsAt: changedAt,
                isActive: true,
                quantityTiers:
                  candidate.quantityPriceTiers.length > 0
                    ? {
                        create: candidate.quantityPriceTiers,
                      }
                    : undefined,
              },
            });
            await transaction.inventory.upsert({
              where: { productVariantId: variantId },
              create: {
                storefrontId: manager.storefront.id,
                productVariantId: variantId,
                quantityOnHand: 0,
                quantityReserved: 0,
                reorderLevel: candidate.reorderLevel,
                isTracked: candidate.isTracked,
                allowBackorder: candidate.allowBackorder,
              },
              update: {
                reorderLevel: candidate.reorderLevel,
                isTracked: candidate.isTracked,
                allowBackorder: candidate.allowBackorder,
              },
            });
          } else {
            if (candidate.initialStock === null) {
              throw new CatalogServiceError(
                "VALIDATION",
                `Opening stock is required for new variant ${candidate.sku}.`,
              );
            }

            const createdVariant = await transaction.productVariant.create({
              data: {
                storefrontProductId,
                sku: candidate.sku,
                title: candidate.title,
                status,
                isDefault: false,
                sellingUnitLabel: candidate.sellingUnitLabel,
                unitsPerSellingUnit: candidate.unitsPerSellingUnit,
                options:
                  options.length > 0 ? { create: options } : undefined,
                prices: {
                  create: {
                    currencyCode: manager.storefront.currencyCode,
                    type: PriceType.REGULAR,
                    amount: candidate.priceAmount,
                    compareAtAmount: candidate.compareAtAmount,
                    costAmount: candidate.costAmount,
                    startsAt: changedAt,
                    isActive: true,
                    quantityTiers:
                      candidate.quantityPriceTiers.length > 0
                        ? {
                            create: candidate.quantityPriceTiers,
                          }
                        : undefined,
                  },
                },
                inventory: {
                  create: {
                    storefrontId: manager.storefront.id,
                    quantityOnHand: candidate.initialStock,
                    quantityReserved: 0,
                    reorderLevel: candidate.reorderLevel,
                    isTracked: candidate.isTracked,
                    allowBackorder: candidate.allowBackorder,
                    movements:
                      candidate.initialStock > 0
                        ? {
                            create: {
                              type: StockMovementType.OPENING_STOCK,
                              quantityDelta: candidate.initialStock,
                              quantityOnHandAfter: candidate.initialStock,
                              quantityReservedAfter: 0,
                              reason:
                                "Opening stock recorded by storefront manager",
                              referenceType: "MANAGER_CATALOG",
                              referenceId: manager.membershipId,
                            },
                          }
                        : undefined,
                  },
                },
              },
              select: { id: true },
            });
            variantId = createdVariant.id;
          }
        }

        if (managedImages) {
          const existingById =
            new Map(
              listing.images.map(
                (image) => [
                  image.id,
                  image,
                ],
              ),
            );
          const retainedIds =
            managedImages
              .filter(
                (
                  image,
                ): image is Extract<
                  ResolvedManagedCatalogImage,
                  {
                    kind:
                      "existing";
                  }
                > =>
                  image.kind ===
                  "existing",
              )
              .map(
                (image) =>
                  image.id,
              );

          if (
            retainedIds.some(
              (id) =>
                !existingById.has(
                  id,
                ),
            )
          ) {
            throw new CatalogServiceError(
              "NOT_FOUND",
              "A selected product photo does not belong to this storefront product.",
            );
          }

          await transaction
            .productImage
            .deleteMany({
              where: {
                storefrontProductId,
                id: {
                  notIn:
                    retainedIds,
                },
              },
            });

          for (
            const [
              index,
              image,
            ] of managedImages.entries()
          ) {
            const shared = {
              altText:
                image.altText,
              variantId: null,
              position:
                index + 1,
              isPrimary:
                index === 0,
            };

            if (
              image.kind ===
              "existing"
            ) {
              await transaction
                .productImage
                .update({
                  where: {
                    id: image.id,
                  },
                  data: shared,
                });
            } else {
              await transaction
                .productImage
                .create({
                  data: {
                    storefrontProductId,
                    ...shared,
                    url:
                      image.image
                        .url,
                    storageProvider:
                      image.image
                        .storageProvider,
                    storageKey:
                      image.image
                        .storageKey,
                    mimeType:
                      image.image
                        .mimeType,
                    byteSize:
                      image.image
                        .byteSize,
                    width:
                      image.image
                        .width,
                    height:
                      image.image
                        .height,
                  },
                });
            }
          }
        } else {
          const primaryImage =
            listing.images[0];

          if (fields.imageUrl) {
            if (primaryImage) {
              await transaction
                .productImage
                .update({
                  where: {
                    id:
                      primaryImage.id,
                  },
                  data: {
                    url:
                      fields.imageUrl,
                    altText:
                      fields
                        .imageAltText,
                    variantId: null,
                    position: 1,
                    isPrimary: true,
                  },
                });
            } else {
              await transaction
                .productImage
                .create({
                  data: {
                    storefrontProductId,
                    url:
                      fields.imageUrl,
                    altText:
                      fields
                        .imageAltText,
                    position: 1,
                    isPrimary: true,
                  },
                });
            }
          } else {
            await transaction
              .productImage
              .deleteMany({
                where: {
                  storefrontProductId,
                  isPrimary: true,
                },
              });
          }
        }

        return {
          storefrontProductId,
          slug: listing.slug,
        };
      },
    );
  } catch (error) {
    if (
      error instanceof
      CatalogServiceError
    ) {
      throw error;
    }

    if (
      isUniqueConstraintError(
        error,
      )
    ) {
      throw new CatalogServiceError(
        "CONFLICT",
        "The catalogue update conflicts with an existing identifier.",
      );
    }

    throw error;
  }
}

export async function uploadManagedCatalogImage(
  input: {
    storefrontCode: string;
    userId: string;
    bytes: Uint8Array;
    contentType: string;
  },
): Promise<UploadedManagedCatalogImage> {
  const manager =
    await requireManagerCatalogContext(
      input.storefrontCode,
      input.userId,
    );
  const prepared =
    await prepareCatalogImage({
      bytes: input.bytes,
      contentType:
        input.contentType,
    });
  const provider =
    resolveCatalogMediaProvider();
  const asset =
    await provider.upload({
      storefrontCode:
        manager.storefront.code,
      ...prepared,
    });
  const attachment =
    issueCatalogMediaToken({
      storefrontCode:
        manager.storefront.code,
      asset,
    });

  return {
    uploadToken:
      attachment.token,
    url: asset.url,
    mimeType:
      asset.mimeType,
    byteSize:
      asset.byteSize,
    width: asset.width,
    height: asset.height,
    expiresAt:
      attachment.expiresAt.toISOString(),
  };
}

export async function adjustManagedCatalogStock(
  input:
    AdjustManagedCatalogStockInput,
): Promise<AdjustedInventory> {
  const manager =
    await requireManagerCatalogContext(
      input.storefrontCode,
      input.userId,
    );
  const storefrontProductId =
    requireText(
      input.storefrontProductId,
      "Catalogue listing",
      191,
    );
  const variantId = optionalText(
    input.variantId,
    "Product variant",
    191,
  );
  const reason = requireText(
    input.reason,
    "Stock adjustment reason",
    500,
  );

  if (
    !Number.isInteger(
      input.quantityDelta,
    ) ||
    input.quantityDelta === 0
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Stock adjustment must be a non-zero whole number.",
    );
  }

  if (
    (input.type ===
      StockMovementType.PURCHASE ||
      input.type ===
        StockMovementType.RETURN) &&
    input.quantityDelta < 1
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Purchases and returns must add stock.",
    );
  }

  if (
    input.type ===
      StockMovementType.DAMAGE &&
    input.quantityDelta > -1
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Damage adjustments must remove stock.",
    );
  }

  const listing =
    await prisma
      .storefrontProduct
      .findFirst({
        where: {
          id:
            storefrontProductId,
          storefrontId:
            manager.storefront.id,
        },
        select: {
          variants: {
            where: variantId
              ? {
                  id: variantId,
                }
              : undefined,
            orderBy: [
              {
                isDefault: "desc",
              },
              {
                createdAt: "asc",
              },
            ],
            take: 1,
            select: {
              sku: true,
            },
          },
        },
      });

  const variant =
    listing?.variants[0];

  if (!variant) {
    throw new CatalogServiceError(
      "NOT_FOUND",
      "The catalogue product variant was not found in this storefront.",
    );
  }

  return adjustVariantStock({
    storefrontKey:
      manager.storefront.key,
    sku: variant.sku,
    quantityDelta:
      input.quantityDelta,
    type: input.type,
    reason,
    referenceType:
      "MANAGER_CATALOG",
    referenceId:
      manager.membershipId,
  });
}
