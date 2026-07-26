import "dotenv/config";

import assert from "node:assert/strict";
import {
  randomBytes,
} from "node:crypto";

import {
  CartStatus,
  ProductStatus,
  StorefrontProductStatus,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  createCatalogProduct,
} from "../src/server/catalog";
import {
  normalizeEmail,
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

function hasPrismaCode(
  error: unknown,
  expectedCode: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === expectedCode
  );
}

async function categorySlugFor(
  storefrontKey: string,
): Promise<string> {
  const storefront =
    await prisma.storefront.findUniqueOrThrow({
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
    });

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
  },
) {
  const categorySlug =
    await categorySlugFor(
      input.storefrontKey,
    );

  return createCatalogProduct({
    storefrontKey:
      input.storefrontKey,
    categorySlug,
    listingSlug:
      `cart-foundation-${input.token}`,
    name:
      `Temporary ${input.storefrontKey} cart audit product`,
    shortDescription:
      "Temporary product for cart isolation testing.",
    description:
      "This product is deleted when the cart audit completes.",
    brand:
      "SORVYRA Cart Audit",
    productStatus:
      ProductStatus.ACTIVE,
    listingStatus:
      StorefrontProductStatus.ACTIVE,
    isDemo: true,
    publishedAt: new Date(
      Date.now() - 60_000,
    ),
    maxPerOrder: 10,
    variant: {
      sku:
        `${input.skuPrefix}-CART-${input.token}`,
      title: "Audit variant",
      price: {
        amount: input.amount,
        compareAtAmount:
          input.amount === "15000.00"
            ? "17500.00"
            : null,
      },
      initialStock: 10,
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
      lastName: "Audit",
      displayName:
        `${input.storefrontCode} Cart Audit`,
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

  const activated =
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

  assert.equal(
    activated.status,
    "ACTIVE",
  );

  return registration.user;
}

async function main(): Promise<void> {
  console.log(
    "=== CART FOUNDATION AUDIT ===",
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
    `cart-foundation-${token}@example.test`;

  const normalizedEmail =
    normalizeEmail(email);

  const phoneSuffix =
    `${Date.now()}`.slice(-7);

  const phone =
    `+234706${phoneSuffix}`;

  const password =
    `Cart-Foundation-Passphrase-${token}`;

  const createdProductIds:
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

    console.log(
      "PASS: Storefront-scoped audit customers activated.",
    );

    const atiProduct =
      await createAuditProduct({
        storefrontKey: "atiloszy",
        skuPrefix: "ATI",
        token: `${token}-ati`,
        amount: "15000.00",
      });

    const zbfProduct =
      await createAuditProduct({
        storefrontKey:
          "zee-beauty-fashion",
        skuPrefix: "ZBF",
        token: `${token}-zbf`,
        amount: "18000.00",
      });

    createdProductIds.push(
      atiProduct.productId,
      zbfProduct.productId,
    );

    const atiStore =
      await prisma.storefront.findUniqueOrThrow(
        {
          where: {
            code: "ATI",
          },
        },
      );

    const atiPrice =
      await prisma.storefrontPrice.findFirstOrThrow(
        {
          where: {
            productVariantId:
              atiProduct.variantId,
            currencyCode: "NGN",
            isActive: true,
          },
        },
      );

    const zbfPrice =
      await prisma.storefrontPrice.findFirstOrThrow(
        {
          where: {
            productVariantId:
              zbfProduct.variantId,
            currencyCode: "NGN",
            isActive: true,
          },
        },
      );

    const cart =
      await prisma.cart.create({
        data: {
          storefrontId:
            atiStore.id,
          userId: atiUser.id,
          currencyCode: "NGN",
          status:
            CartStatus.ACTIVE,
        },
      });

    assert.equal(
      cart.storefrontId,
      atiStore.id,
    );

    assert.equal(
      cart.currencyCode,
      "NGN",
    );

    console.log(
      "PASS: Storefront customer cart creation completed.",
    );

    const item =
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          storefrontId:
            atiStore.id,
          storefrontProductId:
            atiProduct
              .storefrontProductId,
          productVariantId:
            atiProduct.variantId,
          storefrontPriceId:
            atiPrice.id,
          currencyCode: "NGN",
          quantity: 2,
          unitPrice:
            atiPrice.amount,
          compareAtUnitPrice:
            atiPrice.compareAtAmount,
          productNameSnapshot:
            "Temporary atiloszy cart audit product",
          variantTitleSnapshot:
            "Audit variant",
          skuSnapshot:
            atiProduct.sku,
        },
      });

    assert.equal(
      item.quantity,
      2,
    );

    assert.equal(
      item.unitPrice.toFixed(2),
      "15000.00",
    );

    console.log(
      "PASS: Variant and price snapshots were stored in the cart.",
    );

    await assert.rejects(
      () =>
        prisma.cart.create({
          data: {
            storefrontId:
              atiStore.id,
            userId:
              atiUser.id,
            currencyCode:
              "NGN",
            status:
              CartStatus.ACTIVE,
          },
        }),
      (error: unknown) =>
        hasPrismaCode(
          error,
          "P2002",
        ),
      "A second active cart was accepted.",
    );

    console.log(
      "PASS: Only one active cart is allowed per storefront customer.",
    );

    await assert.rejects(
      () =>
        prisma.cart.create({
          data: {
            storefrontId:
              atiStore.id,
            userId:
              atiUser.id,
            currencyCode:
              "QAR",
            status:
              CartStatus.ABANDONED,
          },
        }),
      (error: unknown) =>
        hasPrismaCode(
          error,
          "P2003",
        ),
      "A cart used a currency that does not belong to its storefront.",
    );

    console.log(
      "PASS: Storefront currency isolation is database-enforced.",
    );

    await assert.rejects(
      () =>
        prisma.cart.create({
          data: {
            storefrontId:
              atiStore.id,
            userId:
              zbfUser.id,
            currencyCode:
              "NGN",
            status:
              CartStatus.ABANDONED,
          },
        }),
      (error: unknown) =>
        hasPrismaCode(
          error,
          "P2003",
        ),
      "A customer from another storefront was attached to the cart.",
    );

    console.log(
      "PASS: Cart customer storefront isolation is database-enforced.",
    );

    await assert.rejects(
      () =>
        prisma.cartItem.create({
          data: {
            cartId: cart.id,
            storefrontId:
              atiStore.id,
            storefrontProductId:
              zbfProduct
                .storefrontProductId,
            productVariantId:
              zbfProduct.variantId,
            storefrontPriceId:
              zbfPrice.id,
            currencyCode:
              "NGN",
            quantity: 1,
            unitPrice:
              zbfPrice.amount,
            compareAtUnitPrice:
              null,
            productNameSnapshot:
              "Invalid cross-store product",
            variantTitleSnapshot:
              "Invalid variant",
            skuSnapshot:
              zbfProduct.sku,
          },
        }),
      (error: unknown) =>
        hasPrismaCode(
          error,
          "P2003",
        ),
      "A product from another storefront was added to the cart.",
    );

    console.log(
      "PASS: Cart product storefront isolation is database-enforced.",
    );

    const currencyIsolationCart =
      await prisma.cart.create({
        data: {
          storefrontId:
            atiStore.id,
          userId:
            atiUser.id,
          currencyCode:
            "NGN",
          status:
            CartStatus.ABANDONED,
          abandonedAt:
            new Date(),
        },
      });

    const incompatiblePrice =
      await prisma.storefrontPrice.create(
        {
          data: {
            productVariantId:
              atiProduct.variantId,
            currencyCode: "QAR",
            amount: "100.00",
            isActive: false,
          },
        },
      );

    await assert.rejects(
      () =>
        prisma.cartItem.create({
          data: {
            cartId:
              currencyIsolationCart.id,
            storefrontId:
              atiStore.id,
            storefrontProductId:
              atiProduct
                .storefrontProductId,
            productVariantId:
              atiProduct.variantId,
            storefrontPriceId:
              incompatiblePrice.id,
            currencyCode:
              "NGN",
            quantity: 1,
            unitPrice:
              incompatiblePrice.amount,
            compareAtUnitPrice:
              null,
            productNameSnapshot:
              "Invalid currency snapshot",
            variantTitleSnapshot:
              "Invalid variant",
            skuSnapshot:
              atiProduct.sku,
          },
        }),
      (error: unknown) =>
        hasPrismaCode(
          error,
          "P2003",
        ),
      "A price in another currency was attached to the cart item.",
    );

    console.log(
      "PASS: Cart price currency isolation is database-enforced.",
    );

    await assert.rejects(
      () =>
        prisma.cartItem.create({
          data: {
            cartId: cart.id,
            storefrontId:
              atiStore.id,
            storefrontProductId:
              atiProduct
                .storefrontProductId,
            productVariantId:
              atiProduct.variantId,
            storefrontPriceId:
              atiPrice.id,
            currencyCode:
              "NGN",
            quantity: 1,
            unitPrice:
              atiPrice.amount,
            compareAtUnitPrice:
              atiPrice.compareAtAmount,
            productNameSnapshot:
              "Duplicate product",
            variantTitleSnapshot:
              "Duplicate variant",
            skuSnapshot:
              atiProduct.sku,
          },
        }),
      (error: unknown) =>
        hasPrismaCode(
          error,
          "P2002",
        ),
      "The same variant was inserted twice in one cart.",
    );

    console.log(
      "PASS: A variant has only one line per cart.",
    );

    await assert.rejects(
      () =>
        prisma.cartItem.update({
          where: {
            id: item.id,
          },
          data: {
            quantity: 0,
          },
        }),
      "A zero cart quantity was accepted.",
    );

    const quantityCheck =
      await prisma.cartItem.findUniqueOrThrow(
        {
          where: {
            id: item.id,
          },
        },
      );

    assert.equal(
      quantityCheck.quantity,
      2,
    );

    console.log(
      "PASS: Positive cart quantity is database-enforced.",
    );

    await prisma.storefrontPrice.update({
      where: {
        id: atiPrice.id,
      },
      data: {
        amount: "25000.00",
      },
    });

    const preservedSnapshot =
      await prisma.cartItem.findUniqueOrThrow(
        {
          where: {
            id: item.id,
          },
        },
      );

    assert.equal(
      preservedSnapshot
        .unitPrice
        .toFixed(2),
      "15000.00",
    );

    console.log(
      "PASS: Cart price snapshots survive catalogue price changes.",
    );

    const databaseConstraints =
      await prisma.$queryRawUnsafe<
        Array<{
          name: string;
        }>
      >(
        `
          SELECT conname AS name
          FROM pg_constraint
          WHERE conname IN (
            'cart_items_quantity_positive',
            'cart_items_unit_price_nonnegative',
            'cart_items_compare_price_nonnegative'
          )
          ORDER BY conname
        `,
      );

    assert.equal(
      databaseConstraints.length,
      3,
      "One or more cart check constraints are missing.",
    );

    const activeIndex =
      await prisma.$queryRawUnsafe<
        Array<{
          indexname: string;
        }>
      >(
        `
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname =
              'carts_one_active_per_customer_storefront'
        `,
      );

    assert.equal(
      activeIndex.length,
      1,
      "The active-cart partial unique index is missing.",
    );

    console.log(
      "PASS: PostgreSQL cart invariants are installed.",
    );
  } finally {
    await prisma.user.deleteMany({
      where: {
        normalizedEmail,
      },
    });

    if (createdProductIds.length > 0) {
      await prisma.product.deleteMany({
        where: {
          id: {
            in: createdProductIds,
          },
        },
      });
    }

    console.log(
      "PASS: Temporary cart foundation audit records removed.",
    );
  }

  console.log(
    "PASS: Cart foundation audit completed.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "FAIL: Cart foundation audit failed.",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
