import {
  randomBytes,
  randomInt,
} from "node:crypto";

import {
  CartStatus,
  DeliveryFeeQuoteStatus,
  OrderAddressType,
  OrderFulfilmentMethod,
  OrderPaymentMethod,
  OrderPaymentPurpose,
  OrderPaymentStatus,
  OrderStatus,
  PickupReservationStatus,
  ProductStatus,
  StorefrontProductStatus,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  createCatalogProduct,
} from "../src/server/catalog";
import {
  addCartItem,
  clearActiveCart,
  getOrCreateActiveCart,
} from "../src/server/cart";
import {
  normalizeEmail,
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectRejected(
  label: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  let rejected = false;

  try {
    await operation();
  } catch {
    rejected = true;
  }

  assertCondition(
    rejected,
    `${label} was unexpectedly accepted.`,
  );

  console.log(
    `PASS: ${label} is database-enforced.`,
  );
}

async function categorySlugFor(
  storefrontKey: string,
): Promise<string> {
  const category =
    await prisma.category.findFirst({
      where: {
        storefront: {
          key: storefrontKey,
        },
      },
      select: {
        slug: true,
      },
    });

  assertCondition(
    category,
    `No category exists for ${storefrontKey}.`,
  );

  return category.slug;
}

async function createAuditProduct(
  input: {
    storefrontKey: string;
    prefix: string;
    token: string;
    amount: string;
    name: string;
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
      `order-foundation-${input.token}`,
    name: input.name,
    shortDescription:
      "Temporary order foundation audit product.",
    description:
      "Automatically removed after the order foundation audit.",
    brand:
      "SORVYRA Order Audit",
    productStatus:
      ProductStatus.ACTIVE,
    listingStatus:
      StorefrontProductStatus.ACTIVE,
    publishedAt: new Date(
      Date.now() - 60_000,
    ),
    maxPerOrder: 8,
    isDemo: true,
    variant: {
      sku:
        `${input.prefix}-ORDER-${input.token}`,
      title: "Audit variant",
      price: {
        amount: input.amount,
      },
      initialStock: 20,
      reorderLevel: 1,
      isTracked: true,
      allowBackorder: false,
    },
  });
}

async function main(): Promise<void> {
  console.log(
    "=== CHECKOUT AND ORDER FOUNDATION AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const token = randomBytes(8)
    .toString("hex")
    .toUpperCase();

  const lowerToken =
    token.toLowerCase();

  const atiEmail =
    `order-ati-${lowerToken}@example.test`;

  const zbfEmail =
    `order-zbf-${lowerToken}@example.test`;

  const normalizedEmails = [
    normalizeEmail(atiEmail),
    normalizeEmail(zbfEmail),
  ];

  const userIds: string[] = [];
  const productIds: string[] = [];

  try {
    const atiPassword =
      `Order-ATI-Passphrase-${token}`;

    const zbfPassword =
      `Order-ZBF-Passphrase-${token}`;

    const atiRegistration =
      await registerCustomer({
        storefrontCode: "ATI",
        email: atiEmail,
        phone:
          `+23480${randomInt(10_000_000, 99_999_999)}`,
        password: atiPassword,
        firstName: "Order",
        lastName: "ATI Audit",
        displayName:
          "ATI Order Audit",
        marketingOptIn: false,
        termsAccepted: true,
        privacyAccepted: true,
        tokenSecret,
      });

    const zbfRegistration =
      await registerCustomer({
        storefrontCode: "ZBF",
        email: zbfEmail,
        phone:
          `+23481${randomInt(10_000_000, 99_999_999)}`,
        password: zbfPassword,
        firstName: "Order",
        lastName: "ZBF Audit",
        displayName:
          "ZBF Order Audit",
        marketingOptIn: false,
        termsAccepted: true,
        privacyAccepted: true,
        tokenSecret,
      });

    userIds.push(
      atiRegistration.user.id,
      zbfRegistration.user.id,
    );

    await verifyCustomerEmail({
      storefrontCode: "ATI",
      token:
        atiRegistration
          .emailVerificationToken,
      tokenSecret,
    });

    await verifyCustomerPhone({
      storefrontCode: "ATI",
      challengeId:
        atiRegistration
          .phoneChallengeId,
      code:
        atiRegistration
          .phoneVerificationCode,
      tokenSecret,
    });

    await verifyCustomerEmail({
      storefrontCode: "ZBF",
      token:
        zbfRegistration
          .emailVerificationToken,
      tokenSecret,
    });

    await verifyCustomerPhone({
      storefrontCode: "ZBF",
      challengeId:
        zbfRegistration
          .phoneChallengeId,
      code:
        zbfRegistration
          .phoneVerificationCode,
      tokenSecret,
    });

    console.log(
      "PASS: Storefront-scoped audit customers activated.",
    );

    const atiProduct =
      await createAuditProduct({
        storefrontKey: "atiloszy",
        prefix: "ATI",
        token: lowerToken,
        amount: "15000.00",
        name:
          `Temporary order foundation ATI product ${token}`,
      });

    const zbfProduct =
      await createAuditProduct({
        storefrontKey:
          "zee-beauty-fashion",
        prefix: "ZBF",
        token: lowerToken,
        amount: "19000.00",
        name:
          `Temporary order foundation ZBF product ${token}`,
      });

    productIds.push(
      atiProduct.productId,
      zbfProduct.productId,
    );

    const atiStorefront =
      await prisma.storefront.findUniqueOrThrow(
        {
          where: {
            code: "ATI",
          },
        },
      );

    const zbfStorefront =
      await prisma.storefront.findUniqueOrThrow(
        {
          where: {
            code: "ZBF",
          },
        },
      );

    const atiVariant =
      await prisma.productVariant.findUniqueOrThrow(
        {
          where: {
            id:
              atiProduct.variantId,
          },
          select: {
            id: true,
            storefrontProductId:
              true,
            sku: true,
            title: true,
          },
        },
      );

    const zbfVariant =
      await prisma.productVariant.findUniqueOrThrow(
        {
          where: {
            id:
              zbfProduct.variantId,
          },
          select: {
            id: true,
            storefrontProductId:
              true,
            sku: true,
            title: true,
          },
        },
      );

    const atiPrice =
      await prisma.storefrontPrice.findFirstOrThrow(
        {
          where: {
            productVariantId:
              atiVariant.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            isActive: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      );

    const zbfPrice =
      await prisma.storefrontPrice.findFirstOrThrow(
        {
          where: {
            productVariantId:
              zbfVariant.id,
            currencyCode:
              zbfStorefront
                .currencyCode,
            isActive: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      );

    const atiCart =
      await getOrCreateActiveCart({
        storefrontCode: "ATI",
        userId:
          atiRegistration.user.id,
      });

    await addCartItem({
      storefrontCode: "ATI",
      userId:
        atiRegistration.user.id,
      productVariantId:
        atiVariant.id,
      quantity: 2,
    });

    const orderNumber =
      `ATI-${token}`;

    const order =
      await prisma.$transaction(
        async (transaction) => {
          const createdOrder =
            await transaction.order.create({
              data: {
                orderNumber,
                storefrontId:
                  atiStorefront.id,
                userId:
                  atiRegistration
                    .user.id,
                currencyCode:
                  atiStorefront
                    .currencyCode,
                cartId:
                  atiCart.id,
                status:
                  OrderStatus.PAID,
                fulfilmentMethod:
                  OrderFulfilmentMethod.DELIVERY,
                productPaymentStatus:
                  OrderPaymentStatus.PAID,
                deliveryPaymentStatus:
                  OrderPaymentStatus.PENDING,
                productSubtotal:
                  "30000.00",
                discountTotal:
                  "0.00",
                productTotal:
                  "30000.00",
                deliveryFeeTotal:
                  "0.00",
                grandTotal:
                  "30000.00",
                customerName:
                  "Order ATI Audit",
                customerEmail:
                  atiEmail,
                customerPhone:
                  "+2348000000000",
                paidAt:
                  new Date(),
              },
            });

          await transaction.orderItem.createMany({
            data: [
              {
                orderId:
                  createdOrder.id,
                storefrontId:
                  atiStorefront.id,
                currencyCode:
                  atiStorefront
                    .currencyCode,
                storefrontProductId:
                  atiVariant
                    .storefrontProductId,
                productVariantId:
                  atiVariant.id,
                storefrontPriceId:
                  atiPrice.id,
                productName:
                  `Temporary order foundation ATI product ${token}`,
                variantTitle:
                  atiVariant.title,
                sku:
                  atiVariant.sku,
                quantity: 2,
                unitPrice:
                  "15000.00",
                compareAtUnitPrice:
                  null,
                lineSubtotal:
                  "30000.00",
                discountTotal:
                  "0.00",
                lineTotal:
                  "30000.00",
              },
            ],
          });

          await transaction.orderAddress.createMany({
            data: [
              {
                orderId:
                  createdOrder.id,
                storefrontId:
                  atiStorefront.id,
                currencyCode:
                  atiStorefront
                    .currencyCode,
                type:
                  OrderAddressType.DELIVERY,
                recipientName:
                  "Order ATI Audit",
                phone:
                  "+2348000000000",
                email:
                  atiEmail,
                countryCode:
                  "NG",
                state:
                  "Osun",
                city:
                  "Osogbo",
                addressLine1:
                  "Temporary audit address",
                deliveryNotes:
                  "Temporary audit only",
              },
            ],
          });

          return transaction.order.findUniqueOrThrow({
            where: {
              id:
                createdOrder.id,
            },
            include: {
              items: true,
              addresses: true,
            },
          });
        },
      );

    assertCondition(
      order.items.length === 1 &&
        order.items[0]
          ?.quantity === 2,
      "The order item snapshot was not created.",
    );

    assertCondition(
      order.addresses.length === 1,
      "The delivery-address snapshot was not created.",
    );

    console.log(
      "PASS: Storefront order, item and address snapshots were created.",
    );

    await clearActiveCart({
      storefrontCode: "ATI",
      userId:
        atiRegistration.user.id,
    });

    await prisma.cart.update({
      where: {
        id: atiCart.id,
      },
      data: {
        status:
          CartStatus.CHECKED_OUT,
      },
    });

    await expectRejected(
      "one order per source cart",
      () =>
        prisma.order.create({
          data: {
            orderNumber:
              `ATI-${randomBytes(8).toString("hex").toUpperCase()}`,
            storefrontId:
              atiStorefront.id,
            userId:
              atiRegistration.user.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            cartId: atiCart.id,
            fulfilmentMethod:
              OrderFulfilmentMethod.PICKUP,
            productSubtotal:
              "100.00",
            productTotal:
              "100.00",
            grandTotal:
              "100.00",
            customerName:
              "Duplicate Cart",
            customerEmail:
              atiEmail,
            customerPhone:
              "+2348000000000",
          },
        }),
    );

    const secondCart =
      await prisma.cart.create({
        data: {
          storefrontId:
            atiStorefront.id,
          userId:
            atiRegistration.user.id,
          currencyCode:
            atiStorefront
              .currencyCode,
          status:
            CartStatus.ABANDONED,
          expiresAt: new Date(
            Date.now() +
              86_400_000,
          ),
        },
      });

    await expectRejected(
      "globally unique order numbers",
      () =>
        prisma.order.create({
          data: {
            orderNumber,
            storefrontId:
              atiStorefront.id,
            userId:
              atiRegistration.user.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            cartId:
              secondCart.id,
            fulfilmentMethod:
              OrderFulfilmentMethod.PICKUP,
            productSubtotal:
              "100.00",
            productTotal:
              "100.00",
            grandTotal:
              "100.00",
            customerName:
              "Duplicate Number",
            customerEmail:
              atiEmail,
            customerPhone:
              "+2348000000000",
          },
        }),
    );

    const invalidNumberCart =
      await prisma.cart.create({
        data: {
          storefrontId:
            atiStorefront.id,
          userId:
            atiRegistration.user.id,
          currencyCode:
            atiStorefront
              .currencyCode,
          status:
            CartStatus.ABANDONED,
          expiresAt: new Date(
            Date.now() +
              86_400_000,
          ),
        },
      });

    await expectRejected(
      "secure order-number formatting",
      () =>
        prisma.order.create({
          data: {
            orderNumber:
              "predictable-1",
            storefrontId:
              atiStorefront.id,
            userId:
              atiRegistration.user.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            cartId:
              invalidNumberCart.id,
            fulfilmentMethod:
              OrderFulfilmentMethod.PICKUP,
            productSubtotal:
              "100.00",
            productTotal:
              "100.00",
            grandTotal:
              "100.00",
            customerName:
              "Invalid Number",
            customerEmail:
              atiEmail,
            customerPhone:
              "+2348000000000",
          },
        }),
    );

    const crossStoreCart =
      await prisma.cart.create({
        data: {
          storefrontId:
            atiStorefront.id,
          userId:
            atiRegistration.user.id,
          currencyCode:
            atiStorefront
              .currencyCode,
          status:
            CartStatus.ABANDONED,
          expiresAt: new Date(
            Date.now() +
              86_400_000,
          ),
        },
      });

    await expectRejected(
      "order storefront and customer isolation",
      () =>
        prisma.order.create({
          data: {
            orderNumber:
              `ZBF-${randomBytes(8).toString("hex").toUpperCase()}`,
            storefrontId:
              zbfStorefront.id,
            userId:
              atiRegistration.user.id,
            currencyCode:
              zbfStorefront
                .currencyCode,
            cartId:
              crossStoreCart.id,
            fulfilmentMethod:
              OrderFulfilmentMethod.PICKUP,
            productSubtotal:
              "100.00",
            productTotal:
              "100.00",
            grandTotal:
              "100.00",
            customerName:
              "Cross Store",
            customerEmail:
              atiEmail,
            customerPhone:
              "+2348000000000",
          },
        }),
    );

    await expectRejected(
      "order-item product storefront isolation",
      () =>
        prisma.orderItem.create({
          data: {
            orderId: order.id,
            storefrontId:
              atiStorefront.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            storefrontProductId:
              zbfVariant
                .storefrontProductId,
            productVariantId:
              zbfVariant.id,
            storefrontPriceId:
              zbfPrice.id,
            productName:
              "Cross-store product",
            variantTitle:
              zbfVariant.title,
            sku:
              zbfVariant.sku,
            quantity: 1,
            unitPrice:
              "19000.00",
            lineSubtotal:
              "19000.00",
            lineTotal:
              "19000.00",
          },
        }),
    );

    await expectRejected(
      "duplicate order-address types",
      () =>
        prisma.orderAddress.create({
          data: {
            orderId: order.id,
            storefrontId:
              atiStorefront.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            type:
              OrderAddressType.DELIVERY,
            recipientName:
              "Duplicate Address",
            phone:
              "+2348000000000",
            countryCode: "NG",
            state: "Osun",
            city: "Osogbo",
            addressLine1:
              "Duplicate address",
          },
        }),
    );

    await expectRejected(
      "positive payment amounts",
      () =>
        prisma.orderPayment.create({
          data: {
            orderId: order.id,
            storefrontId:
              atiStorefront.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            purpose:
              OrderPaymentPurpose.PRODUCT,
            method:
              OrderPaymentMethod.CARD,
            status:
              OrderPaymentStatus.PENDING,
            amount: "0.00",
            idempotencyKey:
              `zero-${lowerToken}`,
          },
        }),
    );

    await prisma.orderPayment.create({
      data: {
        orderId: order.id,
        storefrontId:
          atiStorefront.id,
        currencyCode:
          atiStorefront
            .currencyCode,
        purpose:
          OrderPaymentPurpose.PRODUCT,
        method:
          OrderPaymentMethod.CARD,
        status:
          OrderPaymentStatus.PAID,
        amount: "30000.00",
        provider:
          "audit-provider",
        providerReference:
          `product-${lowerToken}`,
        idempotencyKey:
          `product-${lowerToken}`,
        paidAt: new Date(),
      },
    });

    console.log(
      "PASS: Product payment records support provider and idempotency references.",
    );

    const quoteExpiry =
      new Date(
        Date.now() +
          24 * 60 * 60 * 1000,
      );

    await prisma.deliveryFeeQuote.create({
      data: {
        orderId: order.id,
        storefrontId:
          atiStorefront.id,
        currencyCode:
          atiStorefront
            .currencyCode,
        amount: "2500.00",
        status:
          DeliveryFeeQuoteStatus.PENDING,
        expiresAt:
          quoteExpiry,
      },
    });

    await expectRejected(
      "one pending delivery quote per order",
      () =>
        prisma.deliveryFeeQuote.create({
          data: {
            orderId: order.id,
            storefrontId:
              atiStorefront.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            amount:
              "3000.00",
            status:
              DeliveryFeeQuoteStatus.PENDING,
            expiresAt:
              quoteExpiry,
          },
        }),
    );

    await prisma.deliveryFeeQuote.create({
      data: {
        orderId: order.id,
        storefrontId:
          atiStorefront.id,
        currencyCode:
          atiStorefront
            .currencyCode,
        amount: "2800.00",
        status:
          DeliveryFeeQuoteStatus.EXPIRED,
        expiresAt:
          quoteExpiry,
      },
    });

    console.log(
      "PASS: Delivery quote history remains available while pending quotes stay unique.",
    );

    const reservationStart =
      Date.now();

    await expectRejected(
      "single pickup-reservation extension",
      () =>
        prisma.pickupReservation.create({
          data: {
            orderId: order.id,
            storefrontId:
              atiStorefront.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            status:
              PickupReservationStatus.EXTENDED,
            originalReservedUntil:
              new Date(
                reservationStart +
                  4 * 60 * 60 * 1000,
              ),
            reservedUntil:
              new Date(
                reservationStart +
                  8 * 60 * 60 * 1000,
              ),
            extensionCount: 2,
          },
        }),
    );

    await prisma.pickupReservation.create({
      data: {
        orderId: order.id,
        storefrontId:
          atiStorefront.id,
        currencyCode:
          atiStorefront
            .currencyCode,
        status:
          PickupReservationStatus.EXTENDED,
        originalReservedUntil:
          new Date(
            reservationStart +
              4 * 60 * 60 * 1000,
          ),
        reservedUntil:
          new Date(
            reservationStart +
              8 * 60 * 60 * 1000,
          ),
        extensionCount: 1,
        extendedAt: new Date(),
      },
    });

    console.log(
      "PASS: Pickup reservation and one-extension foundation completed.",
    );

    const verification =
      await prisma.deliveryVerification.create({
        data: {
          orderId: order.id,
          storefrontId:
            atiStorefront.id,
          currencyCode:
            atiStorefront
              .currencyCode,
          codeHash:
            randomBytes(32)
              .toString("hex"),
          expiresAt: new Date(
            Date.now() +
              60 * 60 * 1000,
          ),
          feeCollectedAt:
            new Date(),
          verifiedAt:
            new Date(),
        },
      });

    assertCondition(
      verification.codeHash.length >=
        64,
      "The delivery verification was not stored as a hash.",
    );

    await expectRejected(
      "one delivery verification record per order",
      () =>
        prisma.deliveryVerification.create({
          data: {
            orderId: order.id,
            storefrontId:
              atiStorefront.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            codeHash:
              randomBytes(32)
                .toString("hex"),
            expiresAt:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ),
          },
        }),
    );

    await expectRejected(
      "fee collection before delivery-code verification",
      async () => {
        await prisma.deliveryVerification.delete({
          where: {
            orderId:
              order.id,
          },
        });

        await prisma.deliveryVerification.create({
          data: {
            orderId: order.id,
            storefrontId:
              atiStorefront.id,
            currencyCode:
              atiStorefront
                .currencyCode,
            codeHash:
              randomBytes(32)
                .toString("hex"),
            expiresAt:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ),
            verifiedAt:
              new Date(),
          },
        });
      },
    );

    await prisma.deliveryVerification.create({
      data: {
        orderId: order.id,
        storefrontId:
          atiStorefront.id,
        currencyCode:
          atiStorefront
            .currencyCode,
        codeHash:
          randomBytes(32)
            .toString("hex"),
        expiresAt:
          new Date(
            Date.now() +
              60 * 60 * 1000,
          ),
        feeCollectedAt:
          new Date(),
      },
    });

    console.log(
      "PASS: Hashed delivery verification and fee-collection ordering completed.",
    );

    const originalSnapshotName =
      order.items[0]
        ?.productName;

    await prisma.product.update({
      where: {
        id:
          atiProduct.productId,
      },
      data: {
        name:
          `Changed catalogue name ${token}`,
      },
    });

    const storedItem =
      await prisma.orderItem.findFirstOrThrow(
        {
          where: {
            orderId: order.id,
          },
        },
      );

    assertCondition(
      storedItem.productName ===
        originalSnapshotName,
      "Order item snapshots changed with the catalogue.",
    );

    console.log(
      "PASS: Order snapshots survive later catalogue changes.",
    );

    await expectRejected(
      "ordered-product deletion protection",
      () =>
        prisma.product.delete({
          where: {
            id:
              atiProduct.productId,
          },
        }),
    );

    const constraintRows =
      await prisma.$queryRawUnsafe<
        Array<{
          conname: string;
        }>
      >(
        `
        SELECT conname
        FROM pg_constraint
        WHERE conname IN (
          'orders_order_number_format_check',
          'orders_money_nonnegative_check',
          'orders_product_total_check',
          'orders_grand_total_check',
          'order_items_quantity_positive_check',
          'order_items_money_nonnegative_check',
          'order_items_totals_check',
          'order_payments_amount_positive_check',
          'delivery_fee_quotes_amount_nonnegative_check',
          'delivery_fee_quotes_expiry_check',
          'pickup_reservations_extension_count_check',
          'pickup_reservations_window_check',
          'delivery_verifications_attempts_check',
          'delivery_verifications_expiry_check',
          'delivery_verifications_fee_before_verification_check'
        )
        `,
      );

    assertCondition(
      constraintRows.length ===
        15,
      `Expected 15 order constraints; found ${constraintRows.length}.`,
    );

    const indexRows =
      await prisma.$queryRawUnsafe<
        Array<{
          indexname: string;
        }>
      >(
        `
        SELECT indexname
        FROM pg_indexes
        WHERE indexname =
          'delivery_fee_quotes_one_pending_per_order'
        `,
      );

    assertCondition(
      indexRows.length === 1,
      "The pending delivery-quote index is missing.",
    );

    console.log(
      "PASS: PostgreSQL order invariants are installed.",
    );

    console.log(
      "PASS: Checkout and order foundation audit completed.",
    );
  } finally {
    if (userIds.length > 0) {
      await prisma.order.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });

      await prisma.cart.deleteMany({
        where: {
          userId: {
            in: userIds,
          },
        },
      });
    }

    await prisma.user.deleteMany({
      where: {
        normalizedEmail: {
          in:
            normalizedEmails,
        },
      },
    });

    await prisma.customerAccount.deleteMany({
      where: {
        normalizedEmail: {
          in:
            normalizedEmails,
        },
      },
    });

    if (productIds.length > 0) {
      await prisma.product.deleteMany({
        where: {
          id: {
            in:
              productIds,
          },
        },
      });
    }

    console.log(
      "PASS: Temporary order foundation audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
