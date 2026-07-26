import "dotenv/config";

import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PriceType,
  PrismaClient,
  ProductStatus,
  StorefrontProductStatus,
  StockMovementType,
} from "../src/generated/prisma/client";

const connectionString =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
  }),
});

const expectedCategories = {
  ATI: [
    "shoes",
    "household-essentials",
    "useful-gadgets",
    "gifts",
    "everyday-essentials",
  ],
  DEN: [
    "solar",
    "cctv",
    "computers",
    "accessories",
  ],
  ZBF: [
    "beauty",
    "fashion",
    "personal-care",
    "household",
    "everyday-essentials",
  ],
  ZCH: [
    "bras",
    "underwear",
    "leggings",
    "sleepwear",
    "loungewear",
    "mens-essentials",
  ],
} as const;

async function audit() {
  const storefronts = await prisma.storefront.findMany({
    include: {
      categories: {
        orderBy: {
          position: "asc",
        },
      },
    },
    orderBy: {
      code: "asc",
    },
  });

  assert.equal(
    storefronts.length,
    4,
    "Expected four approved storefronts.",
  );

  let approvedCategoryCount = 0;

  for (const storefront of storefronts) {
    const expected =
      expectedCategories[
        storefront.code as keyof typeof expectedCategories
      ];

    assert.ok(
      expected,
      `No approved category definition found for ${storefront.code}.`,
    );

    const discovered = new Set(
      storefront.categories.map((category) => category.slug),
    );

    for (const slug of expected) {
      assert.ok(
        discovered.has(slug),
        `${storefront.code} is missing category ${slug}.`,
      );

      approvedCategoryCount += 1;
    }
  }

  assert.equal(
    approvedCategoryCount,
    20,
    "Expected twenty approved storefront categories.",
  );

  const productCountBefore = await prisma.product.count();
  const auditToken = Date.now().toString();
  const auditProductSlug = `catalogue-audit-${auditToken}`;

  let auditProductId: string | null = null;

  try {
    const storefront = await prisma.storefront.findUniqueOrThrow({
      where: {
        code: "ATI",
      },
    });

    const category = await prisma.category.findUniqueOrThrow({
      where: {
        storefrontId_slug: {
          storefrontId: storefront.id,
          slug: "shoes",
        },
      },
    });

    const product = await prisma.product.create({
      data: {
        slug: auditProductSlug,
        name: "Temporary catalogue audit product",
        shortDescription:
          "Temporary record used to validate the catalogue relationships.",
        status: ProductStatus.DRAFT,
      },
    });

    auditProductId = product.id;

    const storefrontProduct =
      await prisma.storefrontProduct.create({
        data: {
          storefrontId: storefront.id,
          productId: product.id,
          categoryId: category.id,
          slug: auditProductSlug,
          status: StorefrontProductStatus.DRAFT,
          isDemo: true,
        },
      });

    const variant = await prisma.productVariant.create({
      data: {
        storefrontProductId: storefrontProduct.id,
        sku: `ATI-AUDIT-${auditToken}`,
        title: "Black / Size 42",
        isDefault: true,
      },
    });

    await prisma.variantOption.createMany({
      data: [
        {
          productVariantId: variant.id,
          name: "Colour",
          value: "Black",
          position: 1,
        },
        {
          productVariantId: variant.id,
          name: "Size",
          value: "42",
          position: 2,
        },
      ],
    });

    await prisma.productImage.create({
      data: {
        storefrontProductId: storefrontProduct.id,
        variantId: variant.id,
        url: "https://example.invalid/catalogue-audit.jpg",
        altText: "Temporary catalogue audit product",
        position: 1,
        isPrimary: true,
      },
    });

    await prisma.storefrontPrice.create({
      data: {
        productVariantId: variant.id,
        currencyCode: storefront.currencyCode,
        type: PriceType.REGULAR,
        amount: "12500.00",
        isActive: true,
      },
    });

    const inventory = await prisma.inventory.create({
      data: {
        storefrontId: storefront.id,
        productVariantId: variant.id,
        quantityOnHand: 5,
        quantityReserved: 1,
        reorderLevel: 2,
        isTracked: true,
        allowBackorder: false,
      },
    });

    await prisma.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        type: StockMovementType.OPENING_STOCK,
        quantityDelta: 5,
        quantityOnHandAfter: 5,
        quantityReservedAfter: 1,
        reason: "Temporary catalogue foundation audit",
        referenceType: "CATALOGUE_AUDIT",
        referenceId: auditToken,
      },
    });

    const discovered =
      await prisma.storefrontProduct.findUniqueOrThrow({
        where: {
          id: storefrontProduct.id,
        },
        include: {
          storefront: true,
          category: true,
          images: true,
          variants: {
            include: {
              options: true,
              prices: true,
              inventory: {
                include: {
                  movements: true,
                },
              },
            },
          },
        },
      });

    assert.equal(discovered.storefront.code, "ATI");
    assert.equal(discovered.category?.slug, "shoes");
    assert.equal(discovered.images.length, 1);
    assert.equal(discovered.variants.length, 1);

    const discoveredVariant = discovered.variants[0];

    assert.ok(
      discoveredVariant.sku.startsWith("ATI-"),
      "The test SKU does not use the storefront prefix.",
    );

    assert.equal(discoveredVariant.options.length, 2);
    assert.equal(discoveredVariant.prices.length, 1);

    assert.equal(
      discoveredVariant.prices[0].currencyCode,
      storefront.currencyCode,
    );

    assert.ok(discoveredVariant.inventory);

    assert.equal(
      discoveredVariant.inventory.quantityOnHand -
        discoveredVariant.inventory.quantityReserved,
      4,
      "Available stock should equal on-hand stock minus reserved stock.",
    );

    assert.equal(
      discoveredVariant.inventory.movements.length,
      1,
      "Opening stock movement was not recorded.",
    );
  } finally {
    if (auditProductId) {
      await prisma.product.deleteMany({
        where: {
          id: auditProductId,
        },
      });
    }
  }

  const productCountAfter = await prisma.product.count();

  assert.equal(
    productCountAfter,
    productCountBefore,
    "Temporary audit product was not removed cleanly.",
  );

  const temporaryProduct = await prisma.product.findUnique({
    where: {
      slug: auditProductSlug,
    },
  });

  assert.equal(
    temporaryProduct,
    null,
    "Temporary catalogue audit data still exists.",
  );

  console.log("=== CATALOGUE FOUNDATION AUDIT ===");
  console.log(`Storefronts: ${storefronts.length}`);
  console.log(`Approved categories: ${approvedCategoryCount}`);
  console.log("");

  for (const storefront of storefronts) {
    const expected =
      expectedCategories[
        storefront.code as keyof typeof expectedCategories
      ];

    console.log(
      `${storefront.code} | ${storefront.name} | ${expected.length} approved categories`,
    );
  }

  console.log("");
  console.log("PASS: Product relationship round-trip completed.");
  console.log("PASS: Variant options and SKU prefix validated.");
  console.log("PASS: Storefront currency pricing validated.");
  console.log("PASS: Exact stock and stock movement tracking validated.");
  console.log("PASS: Temporary audit records removed.");
  console.log("PASS: Catalogue foundation audit completed.");
}

audit()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("FAIL: Catalogue foundation audit failed.");
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
