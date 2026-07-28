import {
  randomBytes,
  randomInt,
} from "node:crypto";

import {
  OrderFulfilmentAction,
  OrderFulfilmentMethod,
  OrderPaymentPurpose,
  OrderPaymentStatus,
  OrderStatus,
  ProductStatus,
  StockMovementType,
  StorefrontProductStatus,
  StorefrontStaffRole,
} from "../src/generated/prisma/client";
import {
  prisma,
} from "../src/lib/prisma";
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
  createCheckoutOrder,
} from "../src/server/checkout";
import {
  listStaffOrders,
  StaffOrderServiceError,
  transitionStaffOrder,
} from "../src/server/operations";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectStaffError(
  label: string,
  expectedCode:
    StaffOrderServiceError["code"],
  operation: () => Promise<unknown>,
): Promise<void> {
  let discovered:
    | StaffOrderServiceError
    | null = null;

  try {
    await operation();
  } catch (error) {
    if (
      error instanceof
      StaffOrderServiceError
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
        `Staff-Audit-${input.token}-Password`,
      firstName:
        "Staff",
      lastName:
        `${input.storefrontCode} Audit`,
      displayName:
        `${input.storefrontCode} Staff Audit`,
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

async function markProductPaymentPaid(
  orderId: string,
): Promise<void> {
  const paidAt =
    new Date();

  await prisma.$transaction([
    prisma.orderPayment.updateMany(
      {
        where: {
          orderId,
          purpose:
            OrderPaymentPurpose
              .PRODUCT,
        },
        data: {
          status:
            OrderPaymentStatus
              .PAID,
          paidAt,
        },
      },
    ),
    prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status:
          OrderStatus.PAID,
        productPaymentStatus:
          OrderPaymentStatus
            .PAID,
        paidAt,
      },
    }),
  ]);
}

async function main(): Promise<void> {
  console.log(
    "=== STOREFRONT STAFF ORDER SERVICE AUDIT ===",
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

  const userIds: string[] = [];
  const productIds: string[] = [];
  const membershipIds:
    string[] = [];

  try {
    const atiUser =
      await activateCustomer({
        storefrontCode: "ATI",
        email:
          `staff-ati-${lowerToken}@example.test`,
        phone:
          `+23482${randomInt(
            10_000_000,
            99_999_999,
          )}`,
        token,
        tokenSecret,
      });

    const zbfUser =
      await activateCustomer({
        storefrontCode: "ZBF",
        email:
          `staff-zbf-${lowerToken}@example.test`,
        phone:
          `+23483${randomInt(
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

    const atiMembership =
      await prisma
        .storefrontStaffMembership
        .create({
          data: {
            userId:
              atiUser.id,
            storefrontId:
              atiUser.storefrontId,
            role:
              StorefrontStaffRole
                .MANAGER,
          },
        });

    const zbfMembership =
      await prisma
        .storefrontStaffMembership
        .create({
          data: {
            userId:
              zbfUser.id,
            storefrontId:
              zbfUser.storefrontId,
            role:
              StorefrontStaffRole
                .MANAGER,
          },
        });

    membershipIds.push(
      atiMembership.id,
      zbfMembership.id,
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
          `staff-order-${lowerToken}`,
        name:
          `Temporary staff order product ${token}`,
        shortDescription:
          "Temporary staff order audit product.",
        description:
          "Automatically removed after the staff order audit.",
        brand:
          "SORVYRA Staff Audit",
        productStatus:
          ProductStatus.ACTIVE,
        listingStatus:
          StorefrontProductStatus
            .ACTIVE,
        publishedAt:
          new Date(
            Date.now() -
              60_000,
          ),
        maxPerOrder: 8,
        isDemo: true,
        variant: {
          sku:
            `ATI-STAFF-${token}`,
          title:
            "Staff audit variant",
          price: {
            amount:
              "12500.00",
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

    const inventoryBefore =
      await prisma.inventory
        .findFirstOrThrow({
          where: {
            productVariantId:
              product.variantId,
          },
        });

    const pickupCart =
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

    const pickupOrder =
      await createCheckoutOrder({
        storefrontCode: "ATI",
        userId: atiUser.id,
        cartId: pickupCart.id,
        fulfilmentMethod:
          OrderFulfilmentMethod
            .PICKUP,
      });

    await markProductPaymentPaid(
      pickupOrder.id,
    );

    const atiQueue =
      await listStaffOrders({
        storefrontCode: "ATI",
        userId: atiUser.id,
        queue: "ACTIONABLE",
      });

    assertCondition(
      atiQueue.orders.some(
        (order) =>
          order.orderNumber ===
          pickupOrder.orderNumber,
      ),
      "The paid pickup order is absent from its storefront staff queue.",
    );

    const zbfQueue =
      await listStaffOrders({
        storefrontCode: "ZBF",
        userId: zbfUser.id,
        queue: "ALL",
      });

    assertCondition(
      !zbfQueue.orders.some(
        (order) =>
          order.orderNumber ===
          pickupOrder.orderNumber,
      ),
      "A staff queue exposed an order from another storefront.",
    );

    console.log(
      "PASS: Staff queues enforce active storefront membership and cross-store isolation.",
    );

    await prisma
      .storefrontStaffMembership
      .update({
        where: {
          id:
            atiMembership.id,
        },
        data: {
          role:
            StorefrontStaffRole
              .VIEWER,
        },
      });

    await expectStaffError(
      "viewer fulfilment transition",
      "STAFF_ACTION_FORBIDDEN",
      () =>
        transitionStaffOrder({
          storefrontCode: "ATI",
          userId: atiUser.id,
          orderNumber:
            pickupOrder
              .orderNumber,
          action:
            OrderFulfilmentAction
              .CONFIRM,
        }),
    );

    await prisma
      .storefrontStaffMembership
      .update({
        where: {
          id:
            atiMembership.id,
        },
        data: {
          role:
            StorefrontStaffRole
              .FULFILMENT,
        },
      });

    for (
      const action of [
        OrderFulfilmentAction
          .CONFIRM,
        OrderFulfilmentAction
          .START_PREPARING,
        OrderFulfilmentAction
          .MARK_READY_FOR_PICKUP,
        OrderFulfilmentAction
          .COMPLETE,
      ]
    ) {
      await transitionStaffOrder({
        storefrontCode: "ATI",
        userId: atiUser.id,
        orderNumber:
          pickupOrder.orderNumber,
        action,
      });
    }

    const completed =
      await prisma.order
        .findUniqueOrThrow({
          where: {
            id: pickupOrder.id,
          },
          include: {
            fulfilmentEvents:
              true,
          },
        });

    const inventoryAfter =
      await prisma.inventory
        .findFirstOrThrow({
          where: {
            productVariantId:
              product.variantId,
          },
        });

    const saleMovement =
      await prisma.stockMovement
        .findFirst({
          where: {
            referenceType:
              "ORDER",
            referenceId:
              pickupOrder.id,
            type:
              StockMovementType.SALE,
          },
        });

    assertCondition(
      completed.status ===
        OrderStatus.COMPLETED &&
        completed
          .fulfilmentEvents
          .length === 4 &&
        inventoryAfter
          .quantityOnHand ===
          inventoryBefore
            .quantityOnHand -
            2 &&
        inventoryAfter
          .quantityReserved ===
          inventoryBefore
            .quantityReserved &&
        saleMovement
          ?.quantityDelta === -2,
      "Pickup completion did not persist its audit history and inventory sale.",
    );

    await expectStaffError(
      "repeated completion",
      "INVALID_TRANSITION",
      () =>
        transitionStaffOrder({
          storefrontCode: "ATI",
          userId: atiUser.id,
          orderNumber:
            pickupOrder
              .orderNumber,
          action:
            OrderFulfilmentAction
              .COMPLETE,
        }),
    );

    console.log(
      "PASS: Paid pickup fulfilment is monotonic, audited and settles reserved stock exactly once.",
    );

    const deliveryCart =
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

    const deliveryOrder =
      await createCheckoutOrder({
        storefrontCode: "ATI",
        userId: atiUser.id,
        cartId: deliveryCart.id,
        fulfilmentMethod:
          OrderFulfilmentMethod
            .DELIVERY,
        deliveryAddress: {
          recipientName:
            "Staff Delivery Audit",
          phone:
            "+2348000000000",
          email:
            `staff-delivery-${lowerToken}@example.test`,
          countryCode: "NG",
          state: "Osun",
          city: "Osogbo",
          addressLine1:
            "Temporary staff audit address",
        },
      });

    await markProductPaymentPaid(
      deliveryOrder.id,
    );

    await expectStaffError(
      "unpaid delivery-fee fulfilment",
      "DELIVERY_PAYMENT_REQUIRED",
      () =>
        transitionStaffOrder({
          storefrontCode: "ATI",
          userId: atiUser.id,
          orderNumber:
            deliveryOrder
              .orderNumber,
          action:
            OrderFulfilmentAction
              .CONFIRM,
        }),
    );

    console.log(
      "PASS: Delivery fulfilment fails closed until its quote and fee are verified paid.",
    );
  } finally {
    if (
      membershipIds.length > 0
    ) {
      await prisma
        .orderFulfilmentEvent
        .deleteMany({
          where: {
            actorMembershipId: {
              in: membershipIds,
            },
          },
        });

      await prisma
        .storefrontStaffMembership
        .deleteMany({
          where: {
            id: {
              in: membershipIds,
            },
          },
        });
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

      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });
    }

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
      "PASS: Temporary staff order audit records removed.",
    );

    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
