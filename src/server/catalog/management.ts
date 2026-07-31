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
  normalizeSlug,
  normalizeStorefrontCode,
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
    Number(compareAtAmount) <=
      Number(priceAmount)
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
            take: 1,
            include: {
              prices: {
                where: {
                  isActive: true,
                },
                orderBy: {
                  createdAt: "desc",
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
    const variant =
      listing.variants[0];
    const price =
      variant?.prices.find(
        (candidate) =>
          candidate.type ===
          PriceType.REGULAR,
      ) ??
      variant?.prices[0];
    const inventory =
      variant?.inventory;

    if (
      !variant ||
      !price ||
      !inventory
    ) {
      throw new CatalogServiceError(
        "CONFLICT",
        `Catalogue listing "${listing.slug}" is missing its managed variant, active price, or inventory record.`,
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
      variant: {
        id: variant.id,
        sku: variant.sku,
        title: variant.title,
        status: variant.status,
        price: {
          amount:
            price.amount.toString(),
          compareAtAmount:
            price.compareAtAmount
              ?.toString() ?? null,
          costAmount:
            price.costAmount
              ?.toString() ?? null,
          currencyCode:
            price.currencyCode,
        },
        inventory: {
          quantityOnHand:
            inventory
              .quantityOnHand,
          quantityReserved:
            inventory
              .quantityReserved,
          availableQuantity:
            inventory
              .quantityOnHand -
            inventory
              .quantityReserved,
          reorderLevel:
            inventory.reorderLevel,
          isTracked:
            inventory.isTracked,
          allowBackorder:
            inventory
              .allowBackorder,
          movements:
            inventory.movements
              .map(
                (movement) => ({
                  id: movement.id,
                  type:
                    movement.type,
                  quantityDelta:
                    movement
                      .quantityDelta,
                  quantityOnHandAfter:
                    movement
                      .quantityOnHandAfter,
                  quantityReservedAfter:
                    movement
                      .quantityReservedAfter,
                  reason:
                    movement.reason,
                  createdAt:
                    movement.createdAt
                      .toISOString(),
                }),
              ),
        },
      },
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
    variant: {
      sku: input.sku,
      title:
        fields.variantTitle,
      price: {
        amount:
          fields.priceAmount,
        compareAtAmount:
          fields.compareAtAmount,
        costAmount:
          fields.costAmount,
        type: PriceType.REGULAR,
      },
      initialStock:
        requireInteger(
          input.initialStock,
          "Opening stock",
          0,
        ),
      reorderLevel:
        fields.reorderLevel,
      isTracked:
        fields.isTracked,
      allowBackorder:
        fields.allowBackorder,
      openingStockReason:
        "Opening stock recorded by storefront manager",
      openingStockReferenceType:
        "MANAGER_CATALOG",
      openingStockReferenceId:
        manager.membershipId,
    },
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
                  take: 1,
                  select: {
                    id: true,
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

        const variant =
          listing.variants[0];

        if (!variant) {
          throw new CatalogServiceError(
            "CONFLICT",
            "The catalogue product is missing its managed variant.",
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

        await transaction
          .productVariant
          .update({
            where: {
              id: variant.id,
            },
            data: {
              title:
                fields.variantTitle,
              status:
                fields.listingStatus ===
                StorefrontProductStatus
                  .ARCHIVED
                  ? ProductVariantStatus
                      .DISCONTINUED
                  : ProductVariantStatus
                      .ACTIVE,
            },
          });

        await transaction
          .storefrontPrice
          .updateMany({
            where: {
              productVariantId:
                variant.id,
              isActive: true,
            },
            data: {
              isActive: false,
              endsAt: changedAt,
            },
          });

        await transaction
          .storefrontPrice
          .create({
            data: {
              productVariantId:
                variant.id,
              currencyCode:
                manager.storefront
                  .currencyCode,
              type:
                PriceType.REGULAR,
              amount:
                fields.priceAmount,
              compareAtAmount:
                fields
                  .compareAtAmount,
              costAmount:
                fields.costAmount,
              startsAt: changedAt,
              isActive: true,
            },
          });

        await transaction.inventory
          .upsert({
            where: {
              productVariantId:
                variant.id,
            },
            create: {
              storefrontId:
                manager.storefront.id,
              productVariantId:
                variant.id,
              quantityOnHand: 0,
              quantityReserved: 0,
              reorderLevel:
                fields.reorderLevel,
              isTracked:
                fields.isTracked,
              allowBackorder:
                fields
                  .allowBackorder,
            },
            update: {
              reorderLevel:
                fields.reorderLevel,
              isTracked:
                fields.isTracked,
              allowBackorder:
                fields
                  .allowBackorder,
            },
          });

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
      "The catalogue product was not found in this storefront.",
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
