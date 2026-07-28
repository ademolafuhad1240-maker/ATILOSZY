import "server-only";

import {
  OrderFulfilmentAction,
  OrderFulfilmentMethod,
  OrderFulfilmentStatus,
  OrderPaymentStatus,
  OrderStatus,
  PickupReservationStatus,
  Prisma,
  StockMovementType,
  StorefrontStaffRole,
  StorefrontStaffStatus,
  StorefrontStatus,
  UserStatus,
} from "@/generated/prisma/client";
import {
  prisma,
} from "@/lib/prisma";

import {
  isPrismaErrorCode,
  StaffOrderServiceError,
} from "./errors";
import type {
  ListStaffOrdersInput,
  ListStaffOrdersResult,
  StaffOrderQueue,
  StaffOrderView,
  TransitionStaffOrderInput,
  TransitionStaffOrderResult,
} from "./types";
import {
  normalizeIdentifier,
  normalizeNote,
  normalizeOrderLimit,
  normalizeOrderNumber,
  normalizeStaffOrderQueue,
  normalizeStorefrontCode,
} from "./validation";

const orderInclude = {
  storefront: {
    select: {
      code: true,
      fulfilment: {
        select: {
          deliveryFeeQuotedAfterProductPayment:
            true,
        },
      },
    },
  },
  items: {
    orderBy: {
      createdAt: "asc",
    },
  },
  addresses: {
    orderBy: {
      createdAt: "asc",
    },
  },
  fulfilmentEvents: {
    orderBy: {
      createdAt: "desc",
    },
    take: 25,
  },
} satisfies Prisma.OrderInclude;

type StaffOrderRecord =
  Prisma.OrderGetPayload<{
    include: typeof orderInclude;
  }>;

interface StaffContext {
  membershipId: string;
  storefrontId: string;
  storefrontCode: string;
  userId: string;
  email: string;
  role: StorefrontStaffRole;
}

interface TransitionTarget {
  orderStatus: OrderStatus;
  fulfilmentStatus:
    OrderFulfilmentStatus;
}

function staffView(
  context: StaffContext,
) {
  return {
    role: context.role,
    storefrontCode:
      context.storefrontCode,
  };
}

function deliveryPaymentRequired(
  order: StaffOrderRecord,
): boolean {
  const hasDelivery =
    order.fulfilmentMethod ===
      OrderFulfilmentMethod
        .DELIVERY ||
    order.fulfilmentMethod ===
      OrderFulfilmentMethod
        .DELIVERY_AND_INSTALLATION;

  return (
    hasDelivery &&
    (
      order.storefront
        .fulfilment
        ?.deliveryFeeQuotedAfterProductPayment ??
      true
    ) &&
    order.deliveryPaymentStatus !==
      OrderPaymentStatus.PAID
  );
}

function availableActions(
  order: StaffOrderRecord,
  role: StorefrontStaffRole,
): OrderFulfilmentAction[] {
  if (
    role ===
      StorefrontStaffRole.VIEWER ||
    order.productPaymentStatus !==
      OrderPaymentStatus.PAID
  ) {
    return [];
  }

  if (
    order.status ===
      OrderStatus.PAID &&
    order.fulfilmentStatus ===
      OrderFulfilmentStatus
        .NOT_STARTED
  ) {
    return deliveryPaymentRequired(
      order,
    )
      ? []
      : [
          OrderFulfilmentAction
            .CONFIRM,
        ];
  }

  if (
    order.status ===
      OrderStatus.CONFIRMED &&
    order.fulfilmentStatus ===
      OrderFulfilmentStatus
        .NOT_STARTED
  ) {
    return [
      OrderFulfilmentAction
        .START_PREPARING,
    ];
  }

  if (
    order.status !==
    OrderStatus.PROCESSING
  ) {
    return [];
  }

  if (
    order.fulfilmentStatus ===
    OrderFulfilmentStatus
      .PREPARING
  ) {
    switch (
      order.fulfilmentMethod
    ) {
      case OrderFulfilmentMethod
        .PICKUP:
        return [
          OrderFulfilmentAction
            .MARK_READY_FOR_PICKUP,
        ];

      case OrderFulfilmentMethod
        .DELIVERY:
      case OrderFulfilmentMethod
        .DELIVERY_AND_INSTALLATION:
        return [
          OrderFulfilmentAction
            .MARK_OUT_FOR_DELIVERY,
        ];

      case OrderFulfilmentMethod
        .INSTALLATION:
        return [
          OrderFulfilmentAction
            .START_INSTALLATION,
        ];
    }
  }

  if (
    order.fulfilmentStatus ===
      OrderFulfilmentStatus
        .READY_FOR_PICKUP &&
    order.fulfilmentMethod ===
      OrderFulfilmentMethod
        .PICKUP
  ) {
    return [
      OrderFulfilmentAction
        .COMPLETE,
    ];
  }

  if (
    order.fulfilmentStatus ===
      OrderFulfilmentStatus
        .OUT_FOR_DELIVERY
  ) {
    return order.fulfilmentMethod ===
      OrderFulfilmentMethod
        .DELIVERY_AND_INSTALLATION
      ? [
          OrderFulfilmentAction
            .START_INSTALLATION,
        ]
      : [
          OrderFulfilmentAction
            .COMPLETE,
        ];
  }

  if (
    order.fulfilmentStatus ===
    OrderFulfilmentStatus
      .INSTALLATION_IN_PROGRESS
  ) {
    return [
      OrderFulfilmentAction
        .COMPLETE,
    ];
  }

  return [];
}

function holdReason(
  order: StaffOrderRecord,
  role: StorefrontStaffRole,
): StaffOrderView["holdReason"] {
  if (
    role ===
    StorefrontStaffRole.VIEWER
  ) {
    return "VIEW_ONLY";
  }

  if (
    order.status ===
      OrderStatus.PAID &&
    order.fulfilmentStatus ===
      OrderFulfilmentStatus
        .NOT_STARTED &&
    deliveryPaymentRequired(
      order,
    )
  ) {
    return "DELIVERY_PAYMENT_REQUIRED";
  }

  return null;
}

function orderView(
  order: StaffOrderRecord,
  role: StorefrontStaffRole,
): StaffOrderView {
  return {
    orderNumber:
      order.orderNumber,
    storefrontCode:
      order.storefront.code,
    currencyCode:
      order.currencyCode,
    status: order.status,
    fulfilmentMethod:
      order.fulfilmentMethod,
    fulfilmentStatus:
      order.fulfilmentStatus,
    productPaymentStatus:
      order.productPaymentStatus,
    deliveryPaymentStatus:
      order.deliveryPaymentStatus,
    productTotal:
      order.productTotal.toFixed(
        2,
      ),
    deliveryFeeTotal:
      order.deliveryFeeTotal.toFixed(
        2,
      ),
    grandTotal:
      order.grandTotal.toFixed(
        2,
      ),
    customerName:
      order.customerName,
    customerEmail:
      order.customerEmail,
    customerPhone:
      order.customerPhone,
    customerNote:
      order.customerNote,
    placedAt:
      order.placedAt.toISOString(),
    paidAt:
      order.paidAt
        ?.toISOString() ?? null,
    confirmedAt:
      order.confirmedAt
        ?.toISOString() ?? null,
    completedAt:
      order.completedAt
        ?.toISOString() ?? null,
    availableActions:
      availableActions(
        order,
        role,
      ),
    holdReason:
      holdReason(
        order,
        role,
      ),
    items: order.items.map(
      (item) => ({
        id: item.id,
        productName:
          item.productName,
        variantTitle:
          item.variantTitle,
        sku: item.sku,
        quantity: item.quantity,
        lineTotal:
          item.lineTotal.toFixed(
            2,
          ),
      }),
    ),
    addresses:
      order.addresses.map(
        (address) => ({
          id: address.id,
          type: address.type,
          recipientName:
            address.recipientName,
          phone: address.phone,
          email: address.email,
          countryCode:
            address.countryCode,
          state: address.state,
          city: address.city,
          postalCode:
            address.postalCode,
          addressLine1:
            address.addressLine1,
          addressLine2:
            address.addressLine2,
          deliveryNotes:
            address.deliveryNotes,
        }),
      ),
    events:
      order.fulfilmentEvents.map(
        (event) => ({
          id: event.id,
          action: event.action,
          actorRole:
            event.actorRole,
          fromOrderStatus:
            event
              .fromOrderStatus,
          toOrderStatus:
            event.toOrderStatus,
          fromFulfilmentStatus:
            event
              .fromFulfilmentStatus,
          toFulfilmentStatus:
            event
              .toFulfilmentStatus,
          note: event.note,
          createdAt:
            event.createdAt
              .toISOString(),
        }),
      ),
  };
}

async function resolveStaffContext(
  transaction:
    Prisma.TransactionClient,
  storefrontCodeInput: string,
  userIdInput: string,
): Promise<StaffContext> {
  const storefrontCode =
    normalizeStorefrontCode(
      storefrontCodeInput,
    );

  const userId =
    normalizeIdentifier(
      userIdInput,
      "Staff user",
    );

  const membership =
    await transaction
      .storefrontStaffMembership
      .findFirst({
        where: {
          userId,
          status:
            StorefrontStaffStatus
              .ACTIVE,
          storefront: {
            code: storefrontCode,
            status:
              StorefrontStatus.ACTIVE,
          },
          user: {
            status:
              UserStatus.ACTIVE,
            deletedAt: null,
            emailVerifiedAt: {
              not: null,
            },
            phoneVerifiedAt: {
              not: null,
            },
          },
        },
        select: {
          id: true,
          storefrontId: true,
          role: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          storefront: {
            select: {
              code: true,
            },
          },
        },
      });

  if (!membership) {
    throw new StaffOrderServiceError(
      "STAFF_ACCESS_REQUIRED",
      "Active staff access is required for this storefront.",
    );
  }

  return {
    membershipId:
      membership.id,
    storefrontId:
      membership.storefrontId,
    storefrontCode:
      membership.storefront.code,
    userId:
      membership.user.id,
    email:
      membership.user.email,
    role:
      membership.role,
  };
}

async function runSerializable<T>(
  operation: (
    transaction:
      Prisma.TransactionClient,
  ) => Promise<T>,
): Promise<T> {
  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(
        operation,
        {
          isolationLevel:
            Prisma
              .TransactionIsolationLevel
              .Serializable,
        },
      );
    } catch (error) {
      if (
        attempt < 3 &&
        isPrismaErrorCode(
          error,
          "P2034",
        )
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new StaffOrderServiceError(
    "ORDER_CONFLICT",
    "The order operation could not be completed safely.",
  );
}

function queueWhere(
  queue: StaffOrderQueue,
): Prisma.OrderWhereInput {
  switch (queue) {
    case "ACTIONABLE":
      return {
        status: {
          in: [
            OrderStatus.PAID,
            OrderStatus
              .CONFIRMED,
            OrderStatus
              .PROCESSING,
          ],
        },
      };

    case "COMPLETED":
      return {
        status:
          OrderStatus.COMPLETED,
      };

    case "ALL":
      return {};
  }
}

export async function listStaffOrders(
  input: ListStaffOrdersInput,
): Promise<ListStaffOrdersResult> {
  const queue =
    normalizeStaffOrderQueue(
      input.queue,
    );

  const limit =
    normalizeOrderLimit(
      input.limit,
    );

  return prisma.$transaction(
    async (transaction) => {
      const context =
        await resolveStaffContext(
          transaction,
          input.storefrontCode,
          input.userId,
        );

      const orders =
        await transaction.order
          .findMany({
            where: {
              storefrontId:
                context
                  .storefrontId,
              ...queueWhere(queue),
            },
            include: orderInclude,
            orderBy: {
              placedAt: "desc",
            },
            take: limit,
          });

      return {
        staff:
          staffView(context),
        queue,
        orders: orders.map(
          (order) =>
            orderView(
              order,
              context.role,
            ),
        ),
      };
    },
  );
}

function transitionTarget(
  action:
    OrderFulfilmentAction,
): TransitionTarget {
  switch (action) {
    case OrderFulfilmentAction
      .CONFIRM:
      return {
        orderStatus:
          OrderStatus.CONFIRMED,
        fulfilmentStatus:
          OrderFulfilmentStatus
            .NOT_STARTED,
      };

    case OrderFulfilmentAction
      .START_PREPARING:
      return {
        orderStatus:
          OrderStatus.PROCESSING,
        fulfilmentStatus:
          OrderFulfilmentStatus
            .PREPARING,
      };

    case OrderFulfilmentAction
      .MARK_READY_FOR_PICKUP:
      return {
        orderStatus:
          OrderStatus.PROCESSING,
        fulfilmentStatus:
          OrderFulfilmentStatus
            .READY_FOR_PICKUP,
      };

    case OrderFulfilmentAction
      .MARK_OUT_FOR_DELIVERY:
      return {
        orderStatus:
          OrderStatus.PROCESSING,
        fulfilmentStatus:
          OrderFulfilmentStatus
            .OUT_FOR_DELIVERY,
      };

    case OrderFulfilmentAction
      .START_INSTALLATION:
      return {
        orderStatus:
          OrderStatus.PROCESSING,
        fulfilmentStatus:
          OrderFulfilmentStatus
            .INSTALLATION_IN_PROGRESS,
      };

    case OrderFulfilmentAction
      .COMPLETE:
      return {
        orderStatus:
          OrderStatus.COMPLETED,
        fulfilmentStatus:
          OrderFulfilmentStatus
            .COMPLETED,
      };
  }
}

async function settleInventory(
  transaction:
    Prisma.TransactionClient,
  order: StaffOrderRecord,
): Promise<void> {
  for (
    const item of order.items
  ) {
    const inventory =
      await transaction.inventory
        .findFirst({
          where: {
            storefrontId:
              order.storefrontId,
            productVariantId:
              item.productVariantId,
          },
          select: {
            id: true,
            isTracked: true,
          },
        });

    if (!inventory) {
      throw new StaffOrderServiceError(
        "INVENTORY_CONFLICT",
        "A completed order item does not have storefront inventory.",
      );
    }

    if (!inventory.isTracked) {
      continue;
    }

    const updated =
      await transaction.inventory
        .updateMany({
          where: {
            id: inventory.id,
            storefrontId:
              order.storefrontId,
            quantityOnHand: {
              gte: item.quantity,
            },
            quantityReserved: {
              gte: item.quantity,
            },
          },
          data: {
            quantityOnHand: {
              decrement:
                item.quantity,
            },
            quantityReserved: {
              decrement:
                item.quantity,
            },
          },
        });

    if (updated.count !== 1) {
      throw new StaffOrderServiceError(
        "INVENTORY_CONFLICT",
        "Reserved inventory could not be settled for this order.",
      );
    }

    const settled =
      await transaction.inventory
        .findUniqueOrThrow({
          where: {
            id: inventory.id,
          },
          select: {
            quantityOnHand: true,
            quantityReserved:
              true,
          },
        });

    await transaction
      .stockMovement.create({
        data: {
          inventoryId:
            inventory.id,
          type:
            StockMovementType.SALE,
          quantityDelta:
            -item.quantity,
          quantityOnHandAfter:
            settled
              .quantityOnHand,
          quantityReservedAfter:
            settled
              .quantityReserved,
          reason:
            `Order ${order.orderNumber} completed.`,
          referenceType:
            "ORDER",
          referenceId:
            order.id,
        },
      });
  }
}

export async function transitionStaffOrder(
  input:
    TransitionStaffOrderInput,
): Promise<TransitionStaffOrderResult> {
  const orderNumber =
    normalizeOrderNumber(
      input.orderNumber,
    );

  const note =
    normalizeNote(
      input.note,
    );

  return runSerializable(
    async (transaction) => {
      const context =
        await resolveStaffContext(
          transaction,
          input.storefrontCode,
          input.userId,
        );

      if (
        context.role ===
        StorefrontStaffRole.VIEWER
      ) {
        throw new StaffOrderServiceError(
          "STAFF_ACTION_FORBIDDEN",
          "This staff role cannot change order fulfilment.",
        );
      }

      const lockedRows =
        await transaction
          .$queryRaw<
            Array<{
              id: string;
            }>
          >(Prisma.sql`
            SELECT id
            FROM orders
            WHERE
              "orderNumber" =
                ${orderNumber}
              AND "storefrontId" =
                ${context.storefrontId}
            FOR UPDATE
          `);

      if (
        lockedRows.length !== 1
      ) {
        throw new StaffOrderServiceError(
          "ORDER_NOT_FOUND",
          "The storefront order was not found.",
        );
      }

      const order =
        await transaction.order
          .findFirst({
            where: {
              id:
                lockedRows[0]?.id,
              storefrontId:
                context
                  .storefrontId,
            },
            include: orderInclude,
          });

      if (!order) {
        throw new StaffOrderServiceError(
          "ORDER_NOT_FOUND",
          "The storefront order was not found.",
        );
      }

      if (
        order.productPaymentStatus !==
        OrderPaymentStatus.PAID
      ) {
        throw new StaffOrderServiceError(
          "ORDER_NOT_PAID",
          "Only a verified paid order can enter fulfilment.",
        );
      }

      if (
        input.action ===
          OrderFulfilmentAction
            .CONFIRM &&
        deliveryPaymentRequired(
          order,
        )
      ) {
        throw new StaffOrderServiceError(
          "DELIVERY_PAYMENT_REQUIRED",
          "The delivery quote and payment must be completed before fulfilment.",
        );
      }

      if (
        !availableActions(
          order,
          context.role,
        ).includes(
          input.action,
        )
      ) {
        throw new StaffOrderServiceError(
          "INVALID_TRANSITION",
          "The requested fulfilment transition is not available for this order.",
        );
      }

      const target =
        transitionTarget(
          input.action,
        );

      if (
        input.action ===
        OrderFulfilmentAction
          .COMPLETE
      ) {
        await settleInventory(
          transaction,
          order,
        );
      }

      const changedAt =
        new Date();

      await transaction.order.update({
        where: {
          id: order.id,
        },
        data: {
          status:
            target.orderStatus,
          fulfilmentStatus:
            target
              .fulfilmentStatus,
          ...(
            input.action ===
            OrderFulfilmentAction
              .CONFIRM
              ? {
                  confirmedAt:
                    changedAt,
                }
              : {}
          ),
          ...(
            input.action ===
            OrderFulfilmentAction
              .COMPLETE
              ? {
                  completedAt:
                    changedAt,
                }
              : {}
          ),
        },
      });

      if (
        input.action ===
          OrderFulfilmentAction
            .COMPLETE &&
        order.fulfilmentMethod ===
          OrderFulfilmentMethod
            .PICKUP
      ) {
        await transaction
          .pickupReservation
          .updateMany({
            where: {
              orderId: order.id,
              status: {
                in: [
                  PickupReservationStatus
                    .ACTIVE,
                  PickupReservationStatus
                    .EXTENDED,
                ],
              },
            },
            data: {
              status:
                PickupReservationStatus
                  .COLLECTED,
              collectedAt:
                changedAt,
            },
          });
      }

      await transaction
        .orderFulfilmentEvent
        .create({
          data: {
            orderId:
              order.id,
            storefrontId:
              order.storefrontId,
            currencyCode:
              order.currencyCode,
            actorMembershipId:
              context
                .membershipId,
            actorEmail:
              context.email,
            actorRole:
              context.role,
            action:
              input.action,
            fromOrderStatus:
              order.status,
            toOrderStatus:
              target.orderStatus,
            fromFulfilmentStatus:
              order
                .fulfilmentStatus,
            toFulfilmentStatus:
              target
                .fulfilmentStatus,
            note,
          },
        });

      const updatedOrder =
        await transaction.order
          .findUniqueOrThrow({
            where: {
              id: order.id,
            },
            include:
              orderInclude,
          });

      return {
        staff:
          staffView(context),
        order:
          orderView(
            updatedOrder,
            context.role,
          ),
      };
    },
  );
}
