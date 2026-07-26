import {
  randomBytes,
  randomInt,
} from "node:crypto";

import {
  CartStatus,
  OrderFulfilmentMethod,
  OrderPaymentStatus,
  OrderStatus,
  ProductStatus,
  StorefrontProductStatus,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  registerCustomer,
  verifyCustomerEmail,
  verifyCustomerPhone,
} from "../src/server/auth";
import {
  addCartItem,
  getOrCreateActiveCart,
} from "../src/server/cart";
import {
  createCatalogProduct,
} from "../src/server/catalog";
import {
  cancelPendingCheckoutOrder,
  CheckoutServiceError,
  createCheckoutOrder,
  getCheckoutOrder,
} from "../src/server/checkout";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectCheckoutError(
  label: string,
  expectedCode:
    CheckoutServiceError["code"],
  operation: () => Promise<unknown>,
): Promise<void> {
  let discovered:
    | CheckoutServiceError
    | null = null;

  try {
    await operation();
  } catch (error) {
    if (
      error instanceof
      CheckoutServiceError
    ) {
      discovered = error;
    } else {
      throw error;
    }
  }

  assertCondition(
    discovered?.code ===
      expectedCode,
    `${label} did not return ${expectedCode}.`,
  );

  console.log(
    `PASS: ${label} returned ${expectedCode}.`,
  );
}

async function categorySlugFor(
  storefrontKey: string,
): Promise<string> {
  const category =
    await prisma.category.findFirst({
      where: {
        storefront: {
          key:
            storefrontKey,
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

async function activateCustomer(
  input: {
    storefrontCode: string;
    email: string;
    phone: string;
    token: string;
    tokenSecret: string;
  },
) {
  const registration =
    await registerCustomer({
      storefrontCode:
        input.storefrontCode,
      email: input.email,
      phone: input.phone,
      password:
        `Checkout-Audit-${input.token}-Password`,
      firstName:
        "Checkout",
      lastName:
        `${input.storefrontCode} Audit`,
      displayName:
        `${input.storefrontCode} Checkout Audit`,
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
      registration
        .phoneChallengeId,
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
    "=== SECURE CHECKOUT SERVICE AUDIT ===",
  );

  const tokenSecret =
    process.env.AUTH_TOKEN_SECRET;

  assertCondition(
    tokenSecret &&
      tokenSecret.length >= 32,
    "AUTH_TOKEN_SECRET is missing or too short.",
  );

  const token =
    randomBytes(8)
      .toString("hex")
      .toUpperCase();

  const lowerToken =
    token.toLowerCase();

  const atiEmail =
    `checkout-ati-${lowerToken}@example.test`;

  const zbfEmail =
    `checkout-zbf-${lowerToken}@example.test`;

  const userIds: string[] = [];
  const productIds: string[] = [];
  const variantIds: string[] = [];

  try {
    const atiUser =
      await activateCustomer({
        storefrontCode: "ATI",
        email: atiEmail,
        phone:
          `+23480${randomInt(
            10_000_000,
            99_999_999,
          )}`,
        token,
        tokenSecret,
      });

    const zbfUser =
      await activateCustomer({
        storefrontCode: "ZBF",
        email: zbfEmail,
        phone:
          `+23481${randomInt(
            10_000_000,
            99_999_999,
          )}`,
        token,
        tokenSecret,
      });

    userIds.push(
      atiUser.id,
      zbfUser.id,
    );

    console.log(
      "PASS: Storefront-scoped checkout customers activated.",
    );

    const product =
      await createCatalogProduct({
        storefrontKey:
          "atiloszy",
        categorySlug:
          await categorySlugFor(
            "atiloszy",
          ),
        listingSlug:
          `checkout-service-${lowerToken}`,
        name:
          `Temporary checkout service product ${token}`,
        shortDescription:
          "Temporary secure checkout audit product.",
        description:
          "Automatically removed after the secure checkout service audit.",
        brand:
          "SORVYRA Checkout Audit",
        productStatus:
          ProductStatus.ACTIVE,
        listingStatus:
          StorefrontProductStatus.ACTIVE,
        publishedAt:
          new Date(
            Date.now() -
              60_000,
          ),
        maxPerOrder: 8,
        isDemo: true,
        variant: {
          sku:
            `ATI-CHECKOUT-${token}`,
          title:
            "Checkout audit variant",
          price: {
            amount:
              "15000.00",
          },
          initialStock: 10,
          reorderLevel: 1,
          isTracked: true,
          allowBackorder: false,
        },
      });

    productIds.push(
      product.productId,
    );

    variantIds.push(
      product.variantId,
    );

    const price =
      await prisma.storefrontPrice.findFirstOrThrow(
        {
          where: {
            productVariantId:
              product.variantId,
            isActive: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      );

    const inventoryBefore =
      await prisma.inventory.findFirstOrThrow(
        {
          where: {
            productVariantId:
              product.variantId,
          },
        },
      );

    const firstCart =
      await getOrCreateActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    await addCartItem({
      storefrontCode: "ATI",
      userId: atiUser.id,
      productVariantId:
        product.variantId,
      quantity: 2,
    });

    const checkoutInput = {
      storefrontCode: "ATI",
      userId: atiUser.id,
      cartId: firstCart.id,
      fulfilmentMethod:
        OrderFulfilmentMethod.DELIVERY,
      deliveryAddress: {
        recipientName:
          "Checkout ATI Audit",
        phone:
          "+2348000000000",
        email: atiEmail,
        countryCode: "NG",
        state: "Osun",
        city: "Osogbo",
        addressLine1:
          "Temporary checkout audit address",
        deliveryNotes:
          "Temporary audit only",
      },
    };

    const firstOrder =
      await createCheckoutOrder(
        checkoutInput,
      );

    assertCondition(
      firstOrder.status ===
        OrderStatus
          .PENDING_PAYMENT,
      "The checkout order does not have pending-payment status.",
    );

    assertCondition(
      firstOrder.productPaymentStatus ===
        OrderPaymentStatus.PENDING,
      "The product payment is not pending.",
    );

    assertCondition(
      firstOrder.productTotal ===
        "30000.00" &&
        firstOrder.grandTotal ===
          "30000.00",
      "The order totals are incorrect.",
    );

    assertCondition(
      firstOrder.items.length === 1 &&
        firstOrder.items[0]
          ?.quantity === 2,
      "The order item snapshot is incorrect.",
    );

    assertCondition(
      firstOrder.addresses.length ===
        1,
      "The delivery address snapshot is missing.",
    );

    assertCondition(
      firstOrder.payments.length ===
        1 &&
        firstOrder.payments[0]
          ?.amount ===
          "30000.00",
      "The pending product payment record is incorrect.",
    );

    const storedFirstCart =
      await prisma.cart.findUniqueOrThrow(
        {
          where: {
            id: firstCart.id,
          },
        },
      );

    assertCondition(
      storedFirstCart.status ===
        CartStatus.CHECKED_OUT,
      "The source cart was not marked as checked out.",
    );

    const inventoryReserved =
      await prisma.inventory.findFirstOrThrow(
        {
          where: {
            productVariantId:
              product.variantId,
          },
        },
      );

    assertCondition(
      inventoryReserved
        .quantityReserved ===
        inventoryBefore
          .quantityReserved +
          2,
      "Checkout did not reserve inventory.",
    );

    console.log(
      "PASS: Checkout atomically created order snapshots, payment, cart state and inventory reservation.",
    );

    const repeatedOrder =
      await createCheckoutOrder(
        checkoutInput,
      );

    assertCondition(
      repeatedOrder.id ===
        firstOrder.id,
      "Repeated checkout created another order.",
    );

    console.log(
      "PASS: Repeated checkout for the same cart is idempotent.",
    );

    const fetchedOrder =
      await getCheckoutOrder({
        storefrontCode: "ATI",
        userId: atiUser.id,
        orderNumber:
          firstOrder.orderNumber,
      });

    assertCondition(
      fetchedOrder.id ===
        firstOrder.id,
      "The customer order lookup returned the wrong order.",
    );

    await expectCheckoutError(
      "cross-store order lookup",
      "ORDER_NOT_FOUND",
      () =>
        getCheckoutOrder({
          storefrontCode: "ZBF",
          userId: zbfUser.id,
          orderNumber:
            firstOrder.orderNumber,
        }),
    );

    await expectCheckoutError(
      "cross-store cart checkout",
      "CART_NOT_FOUND",
      () =>
        createCheckoutOrder({
          storefrontCode: "ZBF",
          userId: zbfUser.id,
          cartId: firstCart.id,
          fulfilmentMethod:
            OrderFulfilmentMethod
              .PICKUP,
        }),
    );

    const cancelledOrder =
      await cancelPendingCheckoutOrder(
        {
          storefrontCode: "ATI",
          userId: atiUser.id,
          orderNumber:
            firstOrder.orderNumber,
          reason:
            "Checkout service audit cancellation.",
        },
      );

    assertCondition(
      cancelledOrder.status ===
        OrderStatus.CANCELLED &&
        cancelledOrder
          .productPaymentStatus ===
          OrderPaymentStatus
            .CANCELLED,
      "The unpaid order was not cancelled correctly.",
    );

    const inventoryReleased =
      await prisma.inventory.findFirstOrThrow(
        {
          where: {
            productVariantId:
              product.variantId,
          },
        },
      );

    assertCondition(
      inventoryReleased
        .quantityReserved ===
        inventoryBefore
          .quantityReserved,
      "Cancelling the unpaid order did not release inventory.",
    );

    console.log(
      "PASS: Cancelling an unpaid checkout releases reserved inventory.",
    );

    const secondCart =
      await getOrCreateActiveCart({
        storefrontCode: "ATI",
        userId: atiUser.id,
      });

    await addCartItem({
      storefrontCode: "ATI",
      userId: atiUser.id,
      productVariantId:
        product.variantId,
      quantity: 1,
    });

    await expectCheckoutError(
      "delivery without an address",
      "ADDRESS_REQUIRED",
      () =>
        createCheckoutOrder({
          storefrontCode: "ATI",
          userId: atiUser.id,
          cartId:
            secondCart.id,
          fulfilmentMethod:
            OrderFulfilmentMethod
              .DELIVERY,
        }),
    );

    await expectCheckoutError(
      "unsupported installation fulfilment",
      "FULFILMENT_UNAVAILABLE",
      () =>
        createCheckoutOrder({
          storefrontCode: "ATI",
          userId: atiUser.id,
          cartId:
            secondCart.id,
          fulfilmentMethod:
            OrderFulfilmentMethod
              .INSTALLATION,
          deliveryAddress: {
            recipientName:
              "Checkout ATI Audit",
            phone:
              "+2348000000000",
            countryCode: "NG",
            state: "Osun",
            city: "Osogbo",
            addressLine1:
              "Temporary audit address",
          },
        }),
    );

    await prisma.storefrontPrice.update(
      {
        where: {
          id: price.id,
        },
        data: {
          amount:
            "16000.00",
        },
      },
    );

    await expectCheckoutError(
      "changed price checkout",
      "CART_CHANGED",
      () =>
        createCheckoutOrder({
          storefrontCode: "ATI",
          userId: atiUser.id,
          cartId:
            secondCart.id,
          fulfilmentMethod:
            OrderFulfilmentMethod
              .PICKUP,
        }),
    );

    await prisma.storefrontPrice.update(
      {
        where: {
          id: price.id,
        },
        data: {
          amount:
            "15000.00",
        },
      },
    );

    const secondOrder =
      await createCheckoutOrder({
        storefrontCode: "ATI",
        userId: atiUser.id,
        cartId: secondCart.id,
        fulfilmentMethod:
          OrderFulfilmentMethod
            .PICKUP,
      });

    await prisma.order.update({
      where: {
        id: secondOrder.id,
      },
      data: {
        status:
          OrderStatus.PAID,
        productPaymentStatus:
          OrderPaymentStatus.PAID,
        paidAt: new Date(),
      },
    });

    await expectCheckoutError(
      "paid-order cancellation",
      "ORDER_NOT_CANCELLABLE",
      () =>
        cancelPendingCheckoutOrder(
          {
            storefrontCode:
              "ATI",
            userId:
              atiUser.id,
            orderNumber:
              secondOrder
                .orderNumber,
          },
        ),
    );

    console.log(
      "PASS: Secure checkout service audit completed.",
    );
  } finally {
    if (
      variantIds.length > 0
    ) {
      await prisma.inventory.updateMany(
        {
          where: {
            productVariantId: {
              in: variantIds,
            },
          },
          data: {
            quantityReserved: 0,
          },
        },
      );
    }

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
        id: {
          in: userIds,
        },
      },
    });

    if (
      productIds.length > 0
    ) {
      await prisma.product.deleteMany({
        where: {
          id: {
            in: productIds,
          },
        },
      });
    }

    console.log(
      "PASS: Temporary checkout service audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
