import assert from "node:assert/strict";
import {
  randomBytes,
} from "node:crypto";

import {
  StockMovementType,
  StorefrontProductStatus,
  StorefrontStaffRole,
  StorefrontStaffStatus,
  UserStatus,
} from "../src/generated/prisma/client";
import {
  prisma,
} from "../src/lib/prisma";
import {
  adjustManagedCatalogStock,
  CatalogServiceError,
  createManagedCatalogProduct,
  getManagerCatalog,
  getPublicStorefrontProduct,
  updateManagedCatalogProduct,
} from "../src/server/catalog";

async function expectCatalogError(
  label: string,
  expectedCode:
    CatalogServiceError["code"],
  operation: () => Promise<unknown>,
): Promise<void> {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof
        CatalogServiceError &&
      error.code === expectedCode,
    `${label} did not return ${expectedCode}.`,
  );

  console.log(
    `PASS: ${label} returned ${expectedCode}.`,
  );
}

async function main(): Promise<void> {
  console.log(
    "=== SORVYRA CATALOGUE MANAGEMENT SERVICE AUDIT ===",
  );

  const token =
    randomBytes(7)
      .toString("hex")
      .toUpperCase();
  const lowerToken =
    token.toLowerCase();
  const listingSlug =
    `manager-audit-${lowerToken}`;
  const sku =
    `ATI-MGMT-${token}`;
  const userIds: string[] = [];
  let productId: string | null =
    null;
  const productCountBefore =
    await prisma.product.count();

  try {
    const [atiloszy, beauty] =
      await Promise.all([
        prisma.storefront
          .findUniqueOrThrow({
            where: {
              code: "ATI",
            },
            select: {
              id: true,
            },
          }),
        prisma.storefront
          .findUniqueOrThrow({
            where: {
              code: "ZBF",
            },
            select: {
              id: true,
            },
          }),
      ]);

    const manager =
      await prisma.user.create({
        data: {
          storefrontId:
            atiloszy.id,
          email:
            `catalog-manager-${lowerToken}@example.test`,
          normalizedEmail:
            `catalog-manager-${lowerToken}@example.test`,
          phone:
            `+23480${token.slice(0, 8).replace(/[A-F]/gu, "7")}`,
          normalizedPhone:
            `+23480${token.slice(0, 8).replace(/[A-F]/gu, "7")}`,
          passwordHash:
            "catalogue-audit-not-a-login-secret",
          status:
            UserStatus.ACTIVE,
          emailVerifiedAt:
            new Date(),
        },
      });
    const viewer =
      await prisma.user.create({
        data: {
          storefrontId:
            atiloszy.id,
          email:
            `catalog-viewer-${lowerToken}@example.test`,
          normalizedEmail:
            `catalog-viewer-${lowerToken}@example.test`,
          phone:
            `+23481${token.slice(0, 8).replace(/[A-F]/gu, "6")}`,
          normalizedPhone:
            `+23481${token.slice(0, 8).replace(/[A-F]/gu, "6")}`,
          passwordHash:
            "catalogue-audit-not-a-login-secret",
          status:
            UserStatus.ACTIVE,
          emailVerifiedAt:
            new Date(),
        },
      });
    const crossStore =
      await prisma.user.create({
        data: {
          storefrontId: beauty.id,
          email:
            `catalog-cross-${lowerToken}@example.test`,
          normalizedEmail:
            `catalog-cross-${lowerToken}@example.test`,
          phone:
            `+23482${token.slice(0, 8).replace(/[A-F]/gu, "5")}`,
          normalizedPhone:
            `+23482${token.slice(0, 8).replace(/[A-F]/gu, "5")}`,
          passwordHash:
            "catalogue-audit-not-a-login-secret",
          status:
            UserStatus.ACTIVE,
          emailVerifiedAt:
            new Date(),
        },
      });
    userIds.push(
      manager.id,
      viewer.id,
      crossStore.id,
    );

    const managerMembership =
      await prisma
        .storefrontStaffMembership
        .create({
          data: {
            userId: manager.id,
            storefrontId:
              atiloszy.id,
            role:
              StorefrontStaffRole
                .MANAGER,
            status:
              StorefrontStaffStatus
                .ACTIVE,
          },
        });
    await prisma
      .storefrontStaffMembership
      .createMany({
        data: [
          {
            userId: viewer.id,
            storefrontId:
              atiloszy.id,
            role:
              StorefrontStaffRole
                .VIEWER,
            status:
              StorefrontStaffStatus
                .ACTIVE,
          },
          {
            userId: crossStore.id,
            storefrontId:
              beauty.id,
            role:
              StorefrontStaffRole
                .MANAGER,
            status:
              StorefrontStaffStatus
                .ACTIVE,
          },
        ],
      });

    const baseFields = {
      storefrontCode: "ATI",
      categorySlug: "shoes",
      listingSlug,
      sku,
      name:
        "Temporary manager catalogue audit product",
      shortDescription:
        "Temporary product for the manager catalogue audit.",
      description:
        "This record is automatically removed after the audit completes.",
      brand: "SORVYRA Audit",
      listingStatus:
        StorefrontProductStatus.DRAFT,
      isFeatured: false,
      maxPerOrder: 4,
      imageUrl:
        "/brand/atiloszy-logo-original.png",
      imageAltText:
        "Temporary manager catalogue audit product",
      variantTitle: "Default",
      priceAmount: "1000.00",
      compareAtAmount:
        "1250.00",
      costAmount: "600.00",
      initialStock: 3,
      reorderLevel: 1,
      isTracked: true,
      allowBackorder: false,
    };

    await expectCatalogError(
      "viewer product creation",
      "MANAGER_ACCESS_REQUIRED",
      () =>
        createManagedCatalogProduct(
          {
            ...baseFields,
            userId: viewer.id,
          },
        ),
    );

    await expectCatalogError(
      "cross-store catalogue read",
      "MANAGER_ACCESS_REQUIRED",
      () =>
        getManagerCatalog({
          storefrontCode: "ATI",
          userId:
            crossStore.id,
        }),
    );

    const created =
      await createManagedCatalogProduct(
        {
          ...baseFields,
          userId: manager.id,
        },
      );
    productId = created.productId;

    assert.equal(
      created.currencyCode,
      "NGN",
    );
    assert.equal(
      created.storefrontCode,
      "ATI",
    );

    await updateManagedCatalogProduct({
      storefrontCode: "ATI",
      userId: manager.id,
      storefrontProductId:
        created.storefrontProductId,
      categorySlug: "shoes",
      name:
        "Updated manager catalogue audit product",
      shortDescription:
        "Published temporarily by the manager catalogue audit.",
      description:
        "This updated record is automatically removed after the audit.",
      brand: "SORVYRA Audit",
      listingStatus:
        StorefrontProductStatus.ACTIVE,
      isFeatured: true,
      maxPerOrder: 3,
      imageUrl:
        "/brand/atiloszy-logo-original.png",
      imageAltText:
        "Updated temporary audit product",
      variantTitle: "Standard",
      priceAmount: "1200.00",
      compareAtAmount:
        "1500.00",
      costAmount: "700.00",
      reorderLevel: 2,
      isTracked: true,
      allowBackorder: false,
    });

    const afterPurchase =
      await adjustManagedCatalogStock(
        {
          storefrontCode: "ATI",
          userId: manager.id,
          storefrontProductId:
            created.storefrontProductId,
          quantityDelta: 2,
          type:
            StockMovementType
              .PURCHASE,
          reason:
            "Temporary audit supplier delivery",
        },
      );
    const afterDamage =
      await adjustManagedCatalogStock(
        {
          storefrontCode: "ATI",
          userId: manager.id,
          storefrontProductId:
            created.storefrontProductId,
          quantityDelta: -1,
          type:
            StockMovementType.DAMAGE,
          reason:
            "Temporary audit damaged item",
        },
      );

    assert.equal(
      afterPurchase.quantityOnHand,
      5,
    );
    assert.equal(
      afterDamage.quantityOnHand,
      4,
    );

    const managed =
      await getManagerCatalog({
        storefrontCode: "ATI",
        userId: manager.id,
      });
    const managedProduct =
      managed.products.find(
        (product) =>
          product.id ===
          created.storefrontProductId,
      );

    assert.ok(managedProduct);
    assert.equal(
      managed.storefront.currencyCode,
      "NGN",
    );
    assert.equal(
      managedProduct.variant.price
        .amount,
      "1200",
    );
    assert.equal(
      managedProduct.variant.inventory
        .availableQuantity,
      4,
    );

    const publicProduct =
      await getPublicStorefrontProduct(
        "atiloszy",
        listingSlug,
      );
    assert.ok(publicProduct);
    assert.equal(
      publicProduct.currencyCode,
      "NGN",
    );
    assert.equal(
      publicProduct.primaryImageUrl,
      "/brand/atiloszy-logo-original.png",
    );

    const [
      priceCount,
      auditMovementCount,
    ] = await Promise.all([
      prisma.storefrontPrice.count({
        where: {
          productVariantId:
            created.variantId,
        },
      }),
      prisma.stockMovement.count({
        where: {
          inventory: {
            productVariantId:
              created.variantId,
          },
          referenceType:
            "MANAGER_CATALOG",
          referenceId:
            managerMembership.id,
        },
      }),
    ]);

    assert.equal(
      priceCount,
      2,
      "The prior price was not preserved.",
    );
    assert.equal(
      auditMovementCount,
      3,
      "Manager opening stock and adjustments were not attributed to the membership.",
    );

    console.log(
      "PASS: Manager product creation derived storefront and NGN currency on the server.",
    );
    console.log(
      "PASS: Product update preserved price history and published the managed image.",
    );
    console.log(
      "PASS: Stock changes were atomic and attributed to the active manager membership.",
    );
  } finally {
    if (productId) {
      await prisma.product.deleteMany({
        where: {
          id: productId,
        },
      });
    }

    if (userIds.length > 0) {
      await prisma
        .storefrontStaffMembership
        .deleteMany({
          where: {
            userId: {
              in: userIds,
            },
          },
        });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });
    }

    const productCountAfter =
      await prisma.product.count();
    assert.equal(
      productCountAfter,
      productCountBefore,
      "The temporary managed product was not removed.",
    );
    console.log(
      "PASS: Temporary catalogue-management audit records removed.",
    );
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "FAIL: Catalogue management service audit failed.",
  );
  console.error(error);
  process.exitCode = 1;
});
