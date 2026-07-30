import "server-only";

import {
  CartStatus,
  OrderAddressType,
  OrderFulfilmentMethod,
  OrderFulfilmentStatus,
  OrderPaymentPurpose,
  OrderPaymentStatus,
  OrderStatus,
  Prisma,
  ProductStatus,
  ProductVariantStatus,
  StorefrontProductStatus,
  StorefrontStatus,
  UserStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import {
  CheckoutServiceError,
  isPrismaErrorCode,
} from "./errors";
import {
  generateOrderNumber,
} from "./order-number";
import type {
  CancelCheckoutOrderInput,
  CheckoutOrderView,
  CreateCheckoutOrderInput,
  GetCheckoutOrderInput,
  NormalizedCheckoutAddress,
} from "./types";
import {
  normalizeCheckoutAddress,
  normalizeFulfilmentMethod,
  normalizeOrderNumber,
  normalizeStorefrontCode,
  optionalText,
  requireIdentifier,
} from "./validation";

const orderInclude = {
  storefront: {
    select: {
      code: true,
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
  payments: {
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.OrderInclude;

const checkoutCartInclude = {
  items: {
    orderBy: {
      createdAt: "asc",
    },
    include: {
      storefrontProduct: {
        include: {
          product: true,
        },
      },
      productVariant: {
        include: {
          inventory: true,
        },
      },
      storefrontPrice: true,
    },
  },
} satisfies Prisma.CartInclude;

type OrderRecord =
  Prisma.OrderGetPayload<{
    include: typeof orderInclude;
  }>;

type CheckoutCartRecord =
  Prisma.CartGetPayload<{
    include:
      typeof checkoutCartInclude;
  }>;

interface CheckoutContext {
  storefrontId: string;
  storefrontCode: string;
  storefrontCountryCode: string;
  currencyCode: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  supportsPickup: boolean;
  supportsDelivery: boolean;
  supportsInstallation: boolean;
}

interface LockedCartRow {
  id: string;
  storefrontId: string;
  userId: string;
  currencyCode: string;
  status: CartStatus;
  expiresAt: Date | null;
}

interface InventoryReservationRow {
  inventoryId: string;
  isTracked: boolean;
  allowBackorder: boolean;
  quantityOnHand: number;
  quantityReserved: number;
}

function moneyToMinorUnits(
  value: {
    toFixed(
      decimalPlaces: number,
    ): string;
  },
): bigint {
  const fixed = value.toFixed(2);

  const negative =
    fixed.startsWith("-");

  const unsigned = negative
    ? fixed.slice(1)
    : fixed;

  const [
    whole,
    fraction = "00",
  ] = unsigned.split(".");

  const units =
    BigInt(whole) * 100n +
    BigInt(
      fraction
        .padEnd(2, "0")
        .slice(0, 2),
    );

  return negative
    ? -units
    : units;
}

function formatMinorUnits(
  value: bigint,
): string {
  const negative = value < 0n;

  const absolute = negative
    ? -value
    : value;

  const whole = absolute / 100n;

  const fraction = (
    absolute % 100n
  )
    .toString()
    .padStart(2, "0");

  return `${
    negative ? "-" : ""
  }${whole}.${fraction}`;
}

function optionalMoneyEquals(
  left: {
    toFixed(
      decimalPlaces: number,
    ): string;
  } | null,
  right: {
    toFixed(
      decimalPlaces: number,
    ): string;
  } | null,
): boolean {
  if (
    left === null ||
    right === null
  ) {
    return (
      left === null &&
      right === null
    );
  }

  return (
    left.toFixed(2) ===
    right.toFixed(2)
  );
}

function buildOrderView(
  order: OrderRecord,
): CheckoutOrderView {
  return {
    id: order.id,
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
    productSubtotal:
      order.productSubtotal.toFixed(
        2,
      ),
    discountTotal:
      order.discountTotal.toFixed(
        2,
      ),
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
    cancellationReason:
      order.cancellationReason,
    placedAt:
      order.placedAt.toISOString(),
    paidAt:
      order.paidAt?.toISOString() ??
      null,
    confirmedAt:
      order.confirmedAt
        ?.toISOString() ?? null,
    completedAt:
      order.completedAt
        ?.toISOString() ?? null,
    cancelledAt:
      order.cancelledAt
        ?.toISOString() ?? null,
    items: order.items.map(
      (item) => ({
        id: item.id,
        productName:
          item.productName,
        variantTitle:
          item.variantTitle,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice:
          item.unitPrice.toFixed(2),
        compareAtUnitPrice:
          item.compareAtUnitPrice
            ?.toFixed(2) ?? null,
        lineSubtotal:
          item.lineSubtotal.toFixed(
            2,
          ),
        discountTotal:
          item.discountTotal.toFixed(
            2,
          ),
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
    payments:
      order.payments.map(
        (payment) => ({
          id: payment.id,
          purpose:
            payment.purpose,
          method: payment.method,
          status: payment.status,
          amount:
            payment.amount.toFixed(
              2,
            ),
          initiatedAt:
            payment.initiatedAt
              .toISOString(),
          paidAt:
            payment.paidAt
              ?.toISOString() ??
            null,
        }),
      ),
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

  throw new CheckoutServiceError(
    "ORDER_CONFLICT",
    "The checkout could not be completed.",
  );
}

async function resolveCheckoutContext(
  transaction:
    Prisma.TransactionClient,
  storefrontCodeInput: string,
  userIdInput: string,
): Promise<CheckoutContext> {
  const storefrontCode =
    normalizeStorefrontCode(
      storefrontCodeInput,
    );

  const userId = requireIdentifier(
    userIdInput,
    "Customer",
  );

  const storefront =
    await transaction.storefront.findFirst(
      {
        where: {
          code: storefrontCode,
          status:
            StorefrontStatus.ACTIVE,
        },
        select: {
          id: true,
          code: true,
          countryCode: true,
          currencyCode: true,
          fulfilment: {
            select: {
              pickupEnabled: true,
              localDeliveryEnabled:
                true,
              countrywideDeliveryEnabled:
                true,
              sameDayDeliveryEnabled:
                true,
              installationEnabled:
                true,
            },
          },
        },
      },
    );

  if (
    !storefront ||
    !storefront.fulfilment
  ) {
    throw new CheckoutServiceError(
      "STOREFRONT_UNAVAILABLE",
      "The storefront is unavailable for checkout.",
    );
  }

  const user =
    await transaction.user.findFirst({
      where: {
        id: userId,
        storefrontId:
          storefront.id,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        emailVerifiedAt: {
          not: null,
        },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

  if (
    !user ||
    !user.customer
  ) {
    throw new CheckoutServiceError(
      "CUSTOMER_UNAVAILABLE",
      "The storefront customer account is unavailable.",
    );
  }

  const legalName = [
    user.customer.firstName,
    user.customer.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const customerName =
    user.customer.displayName
      ?.trim() ||
    legalName;

  if (!customerName) {
    throw new CheckoutServiceError(
      "CUSTOMER_UNAVAILABLE",
      "The customer profile does not contain a usable name.",
    );
  }

  return {
    storefrontId:
      storefront.id,
    storefrontCode:
      storefront.code,
    storefrontCountryCode:
      storefront.countryCode,
    currencyCode:
      storefront.currencyCode,
    userId: user.id,
    customerName,
    customerEmail:
      user.email,
    customerPhone:
      user.phone,
    supportsPickup:
      storefront.fulfilment
        .pickupEnabled,
    supportsDelivery:
      storefront.fulfilment
        .localDeliveryEnabled ||
      storefront.fulfilment
        .countrywideDeliveryEnabled ||
      storefront.fulfilment
        .sameDayDeliveryEnabled,
    supportsInstallation:
      storefront.fulfilment
        .installationEnabled,
  };
}

function enforceFulfilmentPolicy(
  context: CheckoutContext,
  method:
    OrderFulfilmentMethod,
): void {
  const supported =
    method ===
    OrderFulfilmentMethod.PICKUP
      ? context.supportsPickup
      : method ===
          OrderFulfilmentMethod.DELIVERY
        ? context.supportsDelivery
        : method ===
            OrderFulfilmentMethod.INSTALLATION
          ? context
              .supportsInstallation
          : context
              .supportsDelivery &&
            context
              .supportsInstallation;

  if (!supported) {
    throw new CheckoutServiceError(
      "FULFILMENT_UNAVAILABLE",
      "The selected fulfilment method is not available for this storefront.",
    );
  }
}

function methodNeedsAddress(
  method:
    OrderFulfilmentMethod,
): boolean {
  return (
    method ===
      OrderFulfilmentMethod.DELIVERY ||
    method ===
      OrderFulfilmentMethod.INSTALLATION ||
    method ===
      OrderFulfilmentMethod
        .DELIVERY_AND_INSTALLATION
  );
}

function addressTypeFor(
  method:
    OrderFulfilmentMethod,
): OrderAddressType {
  return method ===
    OrderFulfilmentMethod.INSTALLATION
    ? OrderAddressType.INSTALLATION
    : OrderAddressType.DELIVERY;
}

async function lockCart(
  transaction:
    Prisma.TransactionClient,
  cartId: string,
): Promise<LockedCartRow | null> {
  const rows =
    await transaction.$queryRaw<
      LockedCartRow[]
    >(Prisma.sql`
      SELECT
        id,
        "storefrontId",
        "userId",
        "currencyCode",
        status,
        "expiresAt"
      FROM carts
      WHERE id = ${cartId}
      FOR UPDATE
    `);

  return rows[0] ?? null;
}

async function reserveInventory(
  transaction:
    Prisma.TransactionClient,
  input: {
    storefrontId: string;
    productVariantId: string;
    quantity: number;
  },
): Promise<void> {
  const rows =
    await transaction.$queryRaw<
      InventoryReservationRow[]
    >(Prisma.sql`
      UPDATE inventories
      SET
        "quantityReserved" =
          CASE
            WHEN "isTracked"
            THEN
              "quantityReserved" +
              ${input.quantity}
            ELSE
              "quantityReserved"
          END,
        "updatedAt" =
          CURRENT_TIMESTAMP
      WHERE
        "storefrontId" =
          ${input.storefrontId}
        AND "productVariantId" =
          ${input.productVariantId}
        AND (
          NOT "isTracked"
          OR "allowBackorder"
          OR (
            "quantityOnHand" -
            "quantityReserved"
          ) >= ${input.quantity}
        )
      RETURNING
        id AS "inventoryId",
        "isTracked",
        "allowBackorder",
        "quantityOnHand",
        "quantityReserved"
    `);

  if (rows[0]) {
    return;
  }

  const inventory =
    await transaction.inventory.findFirst(
      {
        where: {
          storefrontId:
            input.storefrontId,
          productVariantId:
            input.productVariantId,
        },
      },
    );

  if (!inventory) {
    throw new CheckoutServiceError(
      "PRODUCT_UNAVAILABLE",
      "Inventory is unavailable for a product in the cart.",
    );
  }

  const availableQuantity =
    inventory.quantityOnHand -
    inventory.quantityReserved;

  throw new CheckoutServiceError(
    "INSUFFICIENT_STOCK",
    "A product in the cart no longer has enough available stock.",
    {
      productVariantId:
        input.productVariantId,
      availableQuantity:
        Math.max(
          availableQuantity,
          0,
        ),
    },
  );
}

async function releaseInventory(
  transaction:
    Prisma.TransactionClient,
  input: {
    storefrontId: string;
    productVariantId: string;
    quantity: number;
  },
): Promise<void> {
  const rows =
    await transaction.$queryRaw<
      InventoryReservationRow[]
    >(Prisma.sql`
      UPDATE inventories
      SET
        "quantityReserved" =
          CASE
            WHEN "isTracked"
            THEN
              "quantityReserved" -
              ${input.quantity}
            ELSE
              "quantityReserved"
          END,
        "updatedAt" =
          CURRENT_TIMESTAMP
      WHERE
        "storefrontId" =
          ${input.storefrontId}
        AND "productVariantId" =
          ${input.productVariantId}
        AND (
          NOT "isTracked"
          OR "quantityReserved" >=
            ${input.quantity}
        )
      RETURNING
        id AS "inventoryId",
        "isTracked",
        "allowBackorder",
        "quantityOnHand",
        "quantityReserved"
    `);

  if (!rows[0]) {
    throw new CheckoutServiceError(
      "ORDER_CONFLICT",
      "Reserved inventory could not be released safely.",
      {
        productVariantId:
          input.productVariantId,
      },
    );
  }
}

function validateCheckoutItem(
  item:
    CheckoutCartRecord["items"][number],
  context: CheckoutContext,
  now: Date,
): void {
  if (
    item.storefrontId !==
      context.storefrontId ||
    item.currencyCode !==
      context.currencyCode ||
    item.storefrontProduct
      .storefrontId !==
      context.storefrontId
  ) {
    throw new CheckoutServiceError(
      "CART_CHANGED",
      "The cart contains a product from another storefront or currency.",
    );
  }

  if (
    item.storefrontProduct
      .product.status !==
      ProductStatus.ACTIVE ||
    item.storefrontProduct.status !==
      StorefrontProductStatus.ACTIVE ||
    item.productVariant.status !==
      ProductVariantStatus.ACTIVE
  ) {
    throw new CheckoutServiceError(
      "PRODUCT_UNAVAILABLE",
      "A product in the cart is no longer available.",
      {
        productVariantId:
          item.productVariantId,
      },
    );
  }

  const maximumQuantity =
    item.storefrontProduct
      .maxPerOrder;

  if (
    maximumQuantity !== null &&
    item.quantity >
      maximumQuantity
  ) {
    throw new CheckoutServiceError(
      "QUANTITY_LIMIT",
      `A maximum of ${maximumQuantity} may be ordered for ${item.productNameSnapshot}.`,
      {
        productVariantId:
          item.productVariantId,
        maximumQuantity,
      },
    );
  }

  const price =
    item.storefrontPrice;

  if (
    !price.isActive ||
    price.currencyCode !==
      context.currencyCode ||
    price.productVariantId !==
      item.productVariantId ||
    (
      price.startsAt !== null &&
      price.startsAt > now
    ) ||
    (
      price.endsAt !== null &&
      price.endsAt <= now
    )
  ) {
    throw new CheckoutServiceError(
      "CART_CHANGED",
      "A price in the cart is no longer current. Refresh the cart before checking out.",
      {
        productVariantId:
          item.productVariantId,
      },
    );
  }

  if (
    price.amount.toFixed(2) !==
      item.unitPrice.toFixed(2) ||
    !optionalMoneyEquals(
      price.compareAtAmount,
      item.compareAtUnitPrice,
    )
  ) {
    throw new CheckoutServiceError(
      "CART_CHANGED",
      "A product price changed after it was added to the cart. Refresh the cart before checking out.",
      {
        productVariantId:
          item.productVariantId,
      },
    );
  }

  if (
    !item.productVariant
      .inventory
  ) {
    throw new CheckoutServiceError(
      "PRODUCT_UNAVAILABLE",
      "Inventory is unavailable for a product in the cart.",
    );
  }
}

async function loadOrderView(
  transaction:
    Prisma.TransactionClient,
  orderId: string,
): Promise<CheckoutOrderView> {
  const order =
    await transaction.order.findUnique({
      where: {
        id: orderId,
      },
      include: orderInclude,
    });

  if (!order) {
    throw new CheckoutServiceError(
      "ORDER_NOT_FOUND",
      "The order was not found.",
    );
  }

  return buildOrderView(order);
}

export async function createCheckoutOrder(
  input: CreateCheckoutOrderInput,
): Promise<CheckoutOrderView> {
  const cartId = requireIdentifier(
    input.cartId,
    "Cart",
  );

  const fulfilmentMethod =
    normalizeFulfilmentMethod(
      input.fulfilmentMethod,
    );

  const deliveryAddress =
    input.deliveryAddress
      ? normalizeCheckoutAddress(
          input.deliveryAddress,
        )
      : null;

  const billingAddress =
    input.billingAddress
      ? normalizeCheckoutAddress(
          input.billingAddress,
        )
      : null;

  const customerNote =
    optionalText(
      input.customerNote,
      "Customer note",
      1000,
    );

  return runSerializable(
    async (transaction) => {
      const context =
        await resolveCheckoutContext(
          transaction,
          input.storefrontCode,
          input.userId,
        );

      enforceFulfilmentPolicy(
        context,
        fulfilmentMethod,
      );

      if (
        methodNeedsAddress(
          fulfilmentMethod,
        ) &&
        deliveryAddress === null
      ) {
        throw new CheckoutServiceError(
          "ADDRESS_REQUIRED",
          "A delivery or installation address is required for this fulfilment method.",
        );
      }

      if (
        deliveryAddress !== null &&
        deliveryAddress
          .countryCode !==
          context
            .storefrontCountryCode
      ) {
        throw new CheckoutServiceError(
          "ADDRESS_UNAVAILABLE",
          "The fulfilment address must be in the storefront country.",
        );
      }

      const lockedCart =
        await lockCart(
          transaction,
          cartId,
        );

      if (
        !lockedCart ||
        lockedCart.storefrontId !==
          context.storefrontId ||
        lockedCart.userId !==
          context.userId ||
        lockedCart.currencyCode !==
          context.currencyCode
      ) {
        throw new CheckoutServiceError(
          "CART_NOT_FOUND",
          "The cart was not found.",
        );
      }

      const existingOrder =
        await transaction.order.findUnique(
          {
            where: {
              cartId,
            },
            include: orderInclude,
          },
        );

      if (existingOrder) {
        if (
          existingOrder
            .storefrontId !==
            context.storefrontId ||
          existingOrder.userId !==
            context.userId
        ) {
          throw new CheckoutServiceError(
            "ORDER_CONFLICT",
            "The cart is already associated with another order.",
          );
        }

        return buildOrderView(
          existingOrder,
        );
      }

      if (
        lockedCart.status !==
        CartStatus.ACTIVE
      ) {
        throw new CheckoutServiceError(
          "CART_NOT_ACTIVE",
          "The cart is no longer active.",
        );
      }

      const now = new Date();

      if (
        lockedCart.expiresAt !==
          null &&
        lockedCart.expiresAt <=
          now
      ) {
        throw new CheckoutServiceError(
          "CART_EXPIRED",
          "The cart has expired.",
        );
      }

      const cart =
        await transaction.cart.findUnique(
          {
            where: {
              id: cartId,
            },
            include:
              checkoutCartInclude,
          },
        );

      if (!cart) {
        throw new CheckoutServiceError(
          "CART_NOT_FOUND",
          "The cart was not found.",
        );
      }

      if (
        cart.items.length === 0
      ) {
        throw new CheckoutServiceError(
          "EMPTY_CART",
          "The cart does not contain any products.",
        );
      }

      let productSubtotal = 0n;

      for (
        const item of cart.items
      ) {
        validateCheckoutItem(
          item,
          context,
          now,
        );

        const lineSubtotal =
          moneyToMinorUnits(
            item.unitPrice,
          ) *
          BigInt(item.quantity);

        productSubtotal +=
          lineSubtotal;

        await reserveInventory(
          transaction,
          {
            storefrontId:
              context.storefrontId,
            productVariantId:
              item.productVariantId,
            quantity:
              item.quantity,
          },
        );
      }

      if (
        productSubtotal <= 0n
      ) {
        throw new CheckoutServiceError(
          "CART_CHANGED",
          "The cart total must be greater than zero.",
        );
      }

      const orderNumber =
        generateOrderNumber(
          context.storefrontCode,
        );

      let orderId: string;

      try {
        const createdOrder =
          await transaction.order.create(
            {
              data: {
                orderNumber,
                storefrontId:
                  context.storefrontId,
                userId:
                  context.userId,
                currencyCode:
                  context.currencyCode,
                cartId:
                  cart.id,
                status:
                  OrderStatus
                    .PENDING_PAYMENT,
                fulfilmentMethod,
                fulfilmentStatus:
                  OrderFulfilmentStatus
                    .NOT_STARTED,
                productPaymentStatus:
                  OrderPaymentStatus
                    .PENDING,
                deliveryPaymentStatus:
                  OrderPaymentStatus
                    .NOT_REQUIRED,
                productSubtotal:
                  formatMinorUnits(
                    productSubtotal,
                  ),
                discountTotal:
                  "0.00",
                productTotal:
                  formatMinorUnits(
                    productSubtotal,
                  ),
                deliveryFeeTotal:
                  "0.00",
                grandTotal:
                  formatMinorUnits(
                    productSubtotal,
                  ),
                customerName:
                  context.customerName,
                customerEmail:
                  context.customerEmail,
                customerPhone:
                  context.customerPhone,
                customerNote,
              },
              select: {
                id: true,
              },
            },
          );

        orderId =
          createdOrder.id;
      } catch (error) {
        if (
          isPrismaErrorCode(
            error,
            "P2002",
          )
        ) {
          throw new CheckoutServiceError(
            "ORDER_CONFLICT",
            "The order could not be created because the cart or order number was already used.",
          );
        }

        throw error;
      }

      await transaction.orderItem.createMany(
        {
          data: cart.items.map(
            (item) => {
              const lineSubtotal =
                moneyToMinorUnits(
                  item.unitPrice,
                ) *
                BigInt(
                  item.quantity,
                );

              return {
                orderId,
                storefrontId:
                  context
                    .storefrontId,
                currencyCode:
                  context
                    .currencyCode,
                storefrontProductId:
                  item
                    .storefrontProductId,
                productVariantId:
                  item
                    .productVariantId,
                storefrontPriceId:
                  item
                    .storefrontPriceId,
                productName:
                  item
                    .productNameSnapshot,
                variantTitle:
                  item
                    .variantTitleSnapshot,
                sku:
                  item.skuSnapshot,
                quantity:
                  item.quantity,
                unitPrice:
                  item.unitPrice,
                compareAtUnitPrice:
                  item
                    .compareAtUnitPrice,
                lineSubtotal:
                  formatMinorUnits(
                    lineSubtotal,
                  ),
                discountTotal:
                  "0.00",
                lineTotal:
                  formatMinorUnits(
                    lineSubtotal,
                  ),
              };
            },
          ),
        },
      );

      const addressRows: Array<{
        orderId: string;
        storefrontId: string;
        currencyCode: string;
        type: OrderAddressType;
        recipientName: string;
        phone: string;
        email: string | null;
        countryCode: string;
        state: string | null;
        city: string;
        postalCode: string | null;
        addressLine1: string;
        addressLine2: string | null;
        deliveryNotes:
          | string
          | null;
      }> = [];

      const appendAddress = (
        address:
          NormalizedCheckoutAddress,
        type: OrderAddressType,
      ) => {
        addressRows.push({
          orderId,
          storefrontId:
            context.storefrontId,
          currencyCode:
            context.currencyCode,
          type,
          recipientName:
            address.recipientName,
          phone: address.phone,
          email:
            address.email ??
            context.customerEmail,
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
        });
      };

      if (deliveryAddress) {
        appendAddress(
          deliveryAddress,
          addressTypeFor(
            fulfilmentMethod,
          ),
        );
      }

      if (billingAddress) {
        appendAddress(
          billingAddress,
          OrderAddressType.BILLING,
        );
      }

      if (
        addressRows.length > 0
      ) {
        await transaction.orderAddress.createMany(
          {
            data: addressRows,
          },
        );
      }

      await transaction.orderPayment.create(
        {
          data: {
            orderId,
            storefrontId:
              context.storefrontId,
            currencyCode:
              context.currencyCode,
            purpose:
              OrderPaymentPurpose
                .PRODUCT,
            status:
              OrderPaymentStatus
                .PENDING,
            amount:
              formatMinorUnits(
                productSubtotal,
              ),
            idempotencyKey:
              `checkout:${orderId}:product`,
          },
        },
      );

      await transaction.cart.update({
        where: {
          id: cart.id,
        },
        data: {
          status:
            CartStatus.CHECKED_OUT,
        },
      });

      return loadOrderView(
        transaction,
        orderId,
      );
    },
  );
}

export async function getCheckoutOrder(
  input: GetCheckoutOrderInput,
): Promise<CheckoutOrderView> {
  const orderNumber =
    normalizeOrderNumber(
      input.orderNumber,
    );

  return runSerializable(
    async (transaction) => {
      const context =
        await resolveCheckoutContext(
          transaction,
          input.storefrontCode,
          input.userId,
        );

      const order =
        await transaction.order.findFirst(
          {
            where: {
              orderNumber,
              storefrontId:
                context.storefrontId,
              userId:
                context.userId,
            },
            include: orderInclude,
          },
        );

      if (!order) {
        throw new CheckoutServiceError(
          "ORDER_NOT_FOUND",
          "The order was not found.",
        );
      }

      return buildOrderView(order);
    },
  );
}

export async function cancelPendingCheckoutOrder(
  input:
    CancelCheckoutOrderInput,
): Promise<CheckoutOrderView> {
  const orderNumber =
    normalizeOrderNumber(
      input.orderNumber,
    );

  const reason =
    optionalText(
      input.reason,
      "Cancellation reason",
      500,
    ) ??
    "Cancelled by the customer before payment.";

  return runSerializable(
    async (transaction) => {
      const context =
        await resolveCheckoutContext(
          transaction,
          input.storefrontCode,
          input.userId,
        );

      const locked =
        await transaction.$queryRaw<
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
            AND "userId" =
              ${context.userId}
          FOR UPDATE
        `);

      const lockedOrder =
        locked[0];

      if (!lockedOrder) {
        throw new CheckoutServiceError(
          "ORDER_NOT_FOUND",
          "The order was not found.",
        );
      }

      const order =
        await transaction.order.findUnique(
          {
            where: {
              id:
                lockedOrder.id,
            },
            include: {
              items: true,
            },
          },
        );

      if (!order) {
        throw new CheckoutServiceError(
          "ORDER_NOT_FOUND",
          "The order was not found.",
        );
      }

      if (
        order.status !==
          OrderStatus
            .PENDING_PAYMENT ||
        (
          order
            .productPaymentStatus !==
            OrderPaymentStatus
              .PENDING &&
          order
            .productPaymentStatus !==
            OrderPaymentStatus
              .FAILED
        )
      ) {
        throw new CheckoutServiceError(
          "ORDER_NOT_CANCELLABLE",
          "Only an unpaid order without an active payment can be cancelled.",
        );
      }

      for (
        const item of order.items
      ) {
        await releaseInventory(
          transaction,
          {
            storefrontId:
              context.storefrontId,
            productVariantId:
              item.productVariantId,
            quantity:
              item.quantity,
          },
        );
      }

      const cancelledAt =
        new Date();

      await transaction.orderPayment.updateMany(
        {
          where: {
            orderId: order.id,
            status: {
              in: [
                OrderPaymentStatus
                  .PENDING,
                OrderPaymentStatus
                  .PROCESSING,
              ],
            },
          },
          data: {
            status:
              OrderPaymentStatus
                .CANCELLED,
            cancelledAt,
          },
        },
      );

      await transaction.order.update({
        where: {
          id: order.id,
        },
        data: {
          status:
            OrderStatus.CANCELLED,
          fulfilmentStatus:
            OrderFulfilmentStatus
              .CANCELLED,
          productPaymentStatus:
            OrderPaymentStatus
              .CANCELLED,
          cancellationReason:
            reason,
          cancelledAt,
        },
      });

      await transaction.cart.update({
        where: {
          id: order.cartId,
        },
        data: {
          status:
            CartStatus.ABANDONED,
        },
      });

      return loadOrderView(
        transaction,
        order.id,
      );
    },
  );
}
