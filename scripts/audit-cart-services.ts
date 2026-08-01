import "dotenv/config";

import assert from "node:assert/strict";
import {
  randomBytes,
} from "node:crypto";

import {
  PriceType,
  ProductStatus,
  StorefrontProductStatus,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  createCatalogProduct,
} from "../src/server/catalog";
import {
  addCartItem,
  CartServiceError,
  clearActiveCart,
  getActiveCart,
  getOrCreateActiveCart,
  refreshActiveCart,
  removeCartItem,
  updateCartItemQuantity,
  validateActiveCart,
} from "../src/server/cart";
import {
  normalizeEmail,
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

async function expectCartError(
  operation: Promise<unknown>,
  expectedCode:
    CartServiceError["code"],
  message: string,
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    if (
      error instanceof
        CartServiceError &&
      error.code === expectedCode
    ) {
      return;
    }

    throw error;
  }

  throw new Error(message);
}

async function categorySlugFor(
  storefrontKey: string,
): Promise<string> {
  const storefront =
    await prisma.storefront.findUniqueOrThrow(
      {
        where: {
          key: storefrontKey,
        },
        select: {
          categories: {
            take: 1,
            select: {
              slug: true,
            },
          },
        },
      },
    );

  const category =
    storefront.categories[0];

  assert.ok(
    category,
    `No category exists for ${storefrontKey}.`,
  );

  return category.slug;
}

async function createAuditProduct(
  input: {
    storefrontKey: string;
    skuPrefix: string;
    token: string;
    amount: string;
    initialStock: number;
    maxPerOrder: number | null;
  },
) {
  return createCatalogProduct({
    storefrontKey:
      input.storefrontKey,
    categorySlug:
      await categorySlugFor(
        input.storefrontKey,
      ),
    listingSlug:
      `cart-service-${input.token}`,
    name:
      `Temporary ${input.storefrontKey} cart service product`,
    shortDescription:
      "Temporary cart service audit product.",
    description:
      "Automatically removed after the cart service audit.",
    brand:
      "SORVYRA Cart Service Audit",
    productStatus:
      ProductStatus.ACTIVE,
    listingStatus:
      StorefrontProductStatus.ACTIVE,
    publishedAt: new Date(
      Date.now() - 60_000,
    ),
    maxPerOrder:
      input.maxPerOrder,
    isDemo: true,
    variant: {
      sku:
        `${input.skuPrefix}-CSVC-${input.token}`,
      title: "Audit variant",
      sellingUnitLabel:
        input.amount ===
        "15000.00"
          ? "dozen"
          : "item",
      unitsPerSellingUnit:
        input.amount ===
        "15000.00"
          ? 12
          : 1,
      price: {
        amount: input.amount,
        compareAtAmount:
          input.amount ===
          "15000.00"
            ? "18000.00"
            : null,
        quantityTiers:
          input.amount ===
          "15000.00"
            ? [
                {
                  minimumQuantity: 3,
                  unitAmount:
                    "13000.00",
                },
              ]
            : [],
      },
      initialStock:
        input.initialStock,
      reorderLevel: 1,
      isTracked: true,
      allowBackorder: false,
    },
  });
}

async function activateCustomer(
  input: {
    storefrontCode: string;
    email: string;
    phone: string;
    password: string;
    tokenSecret: string;
  },
) {
  const registration =
    await registerCustomer({
      storefrontCode:
        input.storefrontCode,
      email: input.email,
      phone: input.phone,
      password: input.password,
      firstName: "Cart",
      lastName: "Service Audit",
      displayName:
        `${input.storefrontCode} Cart Service Audit`,
      marketingOptIn: false,
      termsAccepted: true,
      privacyAccepted: true,
      tokenSecret:
        input.tokenSecret,
    });

  await verifyCustomerEmail({
    storefrontCode:
      input.storefrontCode,
    token:
      registration
        .emailVerificationToken,
    tokenSecret:
      input.tokenSecret,
  });

  await verifyCustomerPhone({
    storefrontCode:
      input.storefrontCode,
    challengeId:
      registration.phoneChallengeId,
    code:
      registration
        .phoneVerificationCode,
    tokenSecret:
      input.tokenSecret,
  });

  return registration.user;
}

async function main(): Promise<void> {
  console.log(
    "=== SECURE CART SERVICE AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assert.ok(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const token = randomBytes(7)
    .toString("hex");

  const email =
    `cart-services-${token}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phoneSuffix =
    `${Date.now()}`.slice(-7);

  const phone =
    `+234707${phoneSuffix}`;

  const password =
    `Cart-Service-Passphrase-${token}`;

  const productIds:
    string[] = [];

  try {
    const atiUser =
      await activateCustomer({
        storefrontCode: "ATI",
        email,
        phone,
        password,
        tokenSecret,
      });

    const zbfUser =
      await activateCustomer({
        storefrontCode: "ZBF",
        email,
        phone,
        password,
        tokenSecret,
      });

    const atiProduct =
      await createAuditProduct({
        storefrontKey: "atiloszy",
        skuPrefix: "ATI",
        token: `${token}-ati`,
        amount: "15000.00",
        initialStock: 10,
        maxPerOrder: 5,
      });

    const zbfProduct =
      await createAuditProduct({
        storefrontKey:
          "zee-beauty-fashion",
        skuPrefix: "ZBF",
        token: `${token}-zbf`,
        amount: "19000.00",
        initialStock: 10,
        maxPerOrder: 5,
      });

    productIds.push(
      atiProduct.productId,
      zbfProduct.productId,
    );

    const firstCart =
      await getOrCreateActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    const secondCart =
      await getOrCreateActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    assert.equal(
      firstCart.id,
      secondCart.id,
    );

    assert.equal(
      firstCart.currencyCode,
      "NGN",
    );

    console.log(
      "PASS: Active cart creation is idempotent.",
    );

    const afterFirstAdd =
      await addCartItem({
        storefrontCode: "ATI",
        userId: atiUser.id,
        productVariantId:
          atiProduct.variantId,
        quantity: 2,
      });

    assert.equal(
      afterFirstAdd.itemCount,
      2,
    );

    assert.equal(
      afterFirstAdd
        .items[0]
        .unitPrice,
      "15000.00",
    );

    assert.equal(
      afterFirstAdd.subtotal,
      "30000.00",
    );

    const afterMerge =
      await addCartItem({
        storefrontCode: "ATI",
        userId: atiUser.id,
        productVariantId:
          atiProduct.variantId,
        quantity: 1,
      });

    assert.equal(
      afterMerge.uniqueItemCount,
      1,
    );

    assert.equal(
      afterMerge.itemCount,
      3,
    );

    assert.equal(
      afterMerge.items[0]
        .unitPrice,
      "13000.00",
    );

    assert.equal(
      afterMerge.items[0]
        .sellingUnitLabel,
      "dozen",
    );

    assert.equal(
      afterMerge.items[0]
        .unitsPerSellingUnit,
      12,
    );

    assert.equal(
      afterMerge.items[0]
        .appliedMinimumQuantity,
      3,
    );

    assert.equal(
      afterMerge.subtotal,
      "39000.00",
    );

    console.log(
      "PASS: Adding the same selling unit merges quantity and activates the server-side price tier.",
    );

    const cartItem =
      afterMerge.items[0];

    const afterQuantityUpdate =
      await updateCartItemQuantity({
        storefrontCode: "ATI",
        userId: atiUser.id,
        cartItemId: cartItem.id,
        quantity: 4,
      });

    assert.equal(
      afterQuantityUpdate.itemCount,
      4,
    );

    assert.equal(
      afterQuantityUpdate.subtotal,
      "52000.00",
    );

    console.log(
      "PASS: Cart quantity updates and exact totals completed.",
    );

    await expectCartError(
      updateCartItemQuantity({
        storefrontCode: "ATI",
        userId: atiUser.id,
        cartItemId: cartItem.id,
        quantity: 6,
      }),
      "QUANTITY_LIMIT",
      "The product order limit was not enforced.",
    );

    console.log(
      "PASS: Product maximum-per-order limits are enforced.",
    );

    await expectCartError(
      getOrCreateActiveCart({
        storefrontCode: "ATI",
        userId: zbfUser.id,
      }),
      "CUSTOMER_UNAVAILABLE",
      "A customer crossed storefront boundaries.",
    );

    await expectCartError(
      addCartItem({
        storefrontCode: "ATI",
        userId: atiUser.id,
        productVariantId:
          zbfProduct.variantId,
        quantity: 1,
      }),
      "PRODUCT_UNAVAILABLE",
      "A product crossed storefront boundaries.",
    );

    console.log(
      "PASS: Customer and product storefront isolation completed.",
    );

    await prisma.inventory.update({
      where: {
        productVariantId:
          atiProduct.variantId,
      },
      data: {
        quantityOnHand: 3,
      },
    });

    const invalidCart =
      await validateActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    assert.equal(
      invalidCart.valid,
      false,
    );

    assert.equal(
      invalidCart.issues.length,
      1,
    );

    assert.equal(
      invalidCart.issues[0].code,
      "INSUFFICIENT_STOCK",
    );

    await expectCartError(
      updateCartItemQuantity({
        storefrontCode: "ATI",
        userId: atiUser.id,
        cartItemId: cartItem.id,
        quantity: 5,
      }),
      "INSUFFICIENT_STOCK",
      "Unavailable inventory was accepted.",
    );

    await prisma.inventory.update({
      where: {
        productVariantId:
          atiProduct.variantId,
      },
      data: {
        quantityOnHand: 10,
      },
    });

    const validCart =
      await validateActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    assert.equal(
      validCart.valid,
      true,
    );

    console.log(
      "PASS: Current inventory validation completed.",
    );

    const storefront =
      await prisma.storefront.findUniqueOrThrow(
        {
          where: {
            code: "ATI",
          },
        },
      );

    const salePrice =
      await prisma.storefrontPrice.create(
        {
          data: {
            productVariantId:
              atiProduct.variantId,
            currencyCode:
              storefront.currencyCode,
            type: PriceType.SALE,
            amount: "12000.00",
            compareAtAmount:
              "15000.00",
            isActive: true,
            startsAt: new Date(
              Date.now() - 60_000,
            ),
          },
        },
      );

    const beforeRefresh =
      await getActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    assert.ok(beforeRefresh);

    assert.equal(
      beforeRefresh.items[0]
        .unitPrice,
      "13000.00",
    );

    const afterRefresh =
      await refreshActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    assert.equal(
      afterRefresh.items[0]
        .storefrontPriceId,
      salePrice.id,
    );

    assert.equal(
      afterRefresh.items[0]
        .unitPrice,
      "12000.00",
    );

    assert.equal(
      afterRefresh.subtotal,
      "48000.00",
    );

    assert.equal(
      afterRefresh.savings,
      "12000.00",
    );

    console.log(
      "PASS: Current storefront prices refresh cart snapshots.",
    );

    const afterRemoval =
      await removeCartItem({
        storefrontCode: "ATI",
        userId: atiUser.id,
        cartItemId: cartItem.id,
      });

    assert.equal(
      afterRemoval.itemCount,
      0,
    );

    assert.equal(
      afterRemoval.subtotal,
      "0.00",
    );

    await addCartItem({
      storefrontCode: "ATI",
      userId: atiUser.id,
      productVariantId:
        atiProduct.variantId,
      quantity: 2,
    });

    const cleared =
      await clearActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    assert.equal(
      cleared.itemCount,
      0,
    );

    assert.equal(
      cleared.uniqueItemCount,
      0,
    );

    console.log(
      "PASS: Cart item removal and clearing completed.",
    );
  } finally {
    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    if (productIds.length > 0) {
      await prisma.product.deleteMany({
        where: {
          id: {
            in: productIds,
          },
        },
      });
    }

    console.log(
      "PASS: Temporary cart service audit records removed.",
    );
  }

  console.log(
    "PASS: Secure cart service audit completed.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "FAIL: Secure cart service audit failed.",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
