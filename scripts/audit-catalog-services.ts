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
      isDemo: false,
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
