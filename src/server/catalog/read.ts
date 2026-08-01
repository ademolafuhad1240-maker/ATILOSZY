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
  quantityTiers: readonly {
    minimumQuantity: number;
    unitAmount: {
      toString(): string;
    };
  }[];
}

type SelectedPublicPrice =
  PublicCatalogPrice & {
    quantityTiers:
      PriceRecord["quantityTiers"];
  };

function chooseCurrentPrice(
  prices: readonly PriceRecord[],
): SelectedPublicPrice | null {
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
    quantityTiers:
      selected.quantityTiers,
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
      isDemo: false,
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
            include: {
              quantityTiers: {
                orderBy: {
                  minimumQuantity: "asc",
                },
              },
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

      const {
        quantityTiers,
        ...publicPrice
      } = price;

      variants.push({
        id: variant.id,
        sku: variant.sku,
        title: variant.title,
        options: variant.options.map((option) => ({
          name: option.name,
          value: option.value,
        })),
        price: publicPrice,
        imageUrl:
          variant.images[0]?.url ??
          listing.images[0]?.url ??
          null,
        availableQuantity,
        isInStock,
        allowBackorder:
          inventory?.allowBackorder ?? false,
        sellingUnitLabel: variant.sellingUnitLabel,
        unitsPerSellingUnit: variant.unitsPerSellingUnit,
        quantityPriceTiers: quantityTiers.map((tier) => ({
          minimumQuantity: tier.minimumQuantity,
          unitAmount: tier.unitAmount.toString(),
        })),
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
      images:
        listing.images.map(
          (image) => ({
            id: image.id,
            url: image.url,
            altText:
              image.altText,
            isPrimary:
              image.isPrimary,
            position:
              image.position,
          }),
        ),
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
