import "server-only";

import {
  CartStatus,
  PriceType,
  ProductStatus,
  ProductVariantStatus,
  Prisma,
  StorefrontProductStatus,
  StorefrontStatus,
  UserStatus,
} from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma";

import {
  CartServiceError,
  isPrismaErrorCode,
} from "./errors";
import type {
  AddCartItemInput,
  CartIdentityInput,
  CartValidationIssue,
  CartValidationResult,
  CartView,
  RemoveCartItemInput,
  UpdateCartItemQuantityInput,
} from "./types";
import {
  normalizeStorefrontCode,
  requireCartQuantity,
  requireIdentifier,
} from "./validation";

const CART_LIFETIME_DAYS = 30;

const cartInclude = {
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
} satisfies Prisma.CartInclude;

type CartRecord =
  Prisma.CartGetPayload<{
    include: typeof cartInclude;
  }>;

interface CustomerContext {
  storefrontId: string;
  storefrontCode: string;
  currencyCode: string;
  userId: string;
}

function cartExpiryFrom(
  now: Date,
): Date {
  return new Date(
    now.getTime() +
      CART_LIFETIME_DAYS *
        24 *
        60 *
        60 *
        1000,
  );
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
      fraction.padEnd(2, "0").slice(
        0,
        2,
      ),
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

function buildCartView(
  cart: CartRecord,
): CartView {
  let itemCount = 0;

  let subtotal = 0n;

  let compareAtSubtotal = 0n;

  let hasCompareAtPrice = false;

  const items = cart.items.map(
    (item) => {
      itemCount += item.quantity;

      const unitMinor =
        moneyToMinorUnits(
          item.unitPrice,
        );

      const lineMinor =
        unitMinor *
        BigInt(item.quantity);

      subtotal += lineMinor;

      let compareAtUnitPrice:
        | string
        | null = null;

      if (
        item.compareAtUnitPrice !==
        null
      ) {
        const compareMinor =
          moneyToMinorUnits(
            item.compareAtUnitPrice,
          );

        compareAtSubtotal +=
          compareMinor *
          BigInt(item.quantity);

        compareAtUnitPrice =
          item.compareAtUnitPrice.toFixed(
            2,
          );

        hasCompareAtPrice = true;
      } else {
        compareAtSubtotal += lineMinor;
      }

      return {
        id: item.id,
        storefrontProductId:
          item.storefrontProductId,
        productVariantId:
          item.productVariantId,
        storefrontPriceId:
          item.storefrontPriceId,
        quantity: item.quantity,
        unitPrice:
          item.unitPrice.toFixed(2),
        compareAtUnitPrice,
        lineTotal:
          formatMinorUnits(
            lineMinor,
          ),
        productName:
          item.productNameSnapshot,
        variantTitle:
          item.variantTitleSnapshot,
        sku: item.skuSnapshot,
      };
    },
  );

  const savings =
    compareAtSubtotal > subtotal
      ? compareAtSubtotal - subtotal
      : 0n;

  return {
    id: cart.id,
    storefrontId:
      cart.storefrontId,
    storefrontCode:
      cart.storefront.code,
    userId: cart.userId,
    currencyCode:
      cart.currencyCode,
    status: cart.status,
    expiresAt:
      cart.expiresAt?.toISOString() ??
      null,
    itemCount,
    uniqueItemCount:
      cart.items.length,
    subtotal:
      formatMinorUnits(subtotal),
    compareAtSubtotal:
      hasCompareAtPrice
        ? formatMinorUnits(
            compareAtSubtotal,
          )
        : null,
    savings:
      formatMinorUnits(savings),
    items,
    createdAt:
      cart.createdAt.toISOString(),
    updatedAt:
      cart.updatedAt.toISOString(),
  };
}

async function resolveCustomerContext(
  transaction:
    Prisma.TransactionClient,
  input: CartIdentityInput,
): Promise<CustomerContext> {
  const storefrontCode =
    normalizeStorefrontCode(
      input.storefrontCode,
    );

  const userId = requireIdentifier(
    input.userId,
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
          currencyCode: true,
        },
      },
    );

  if (!storefront) {
    throw new CartServiceError(
      "CUSTOMER_UNAVAILABLE",
      "The storefront account is unavailable.",
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
        phoneVerifiedAt: {
          not: null,
        },
      },
      select: {
        id: true,
      },
    });

  if (!user) {
    throw new CartServiceError(
      "CUSTOMER_UNAVAILABLE",
      "The storefront customer account is unavailable.",
    );
  }

  return {
    storefrontId: storefront.id,
    storefrontCode:
      storefront.code,
    currencyCode:
      storefront.currencyCode,
    userId: user.id,
  };
}

async function expireOldActiveCart(
  transaction:
    Prisma.TransactionClient,
  context: CustomerContext,
  now: Date,
): Promise<void> {
  await transaction.cart.updateMany({
    where: {
      storefrontId:
        context.storefrontId,
      userId: context.userId,
      status: CartStatus.ACTIVE,
      expiresAt: {
        lte: now,
      },
    },
    data: {
      status: CartStatus.EXPIRED,
    },
  });
}

async function findActiveCart(
  transaction:
    Prisma.TransactionClient,
  context: CustomerContext,
): Promise<CartRecord | null> {
  return transaction.cart.findFirst({
    where: {
      storefrontId:
        context.storefrontId,
      userId: context.userId,
      currencyCode:
        context.currencyCode,
      status: CartStatus.ACTIVE,
    },
    include: cartInclude,
    orderBy: {
      updatedAt: "desc",
    },
  });
}

async function ensureActiveCart(
  transaction:
    Prisma.TransactionClient,
  context: CustomerContext,
  now: Date,
): Promise<CartRecord> {
  await expireOldActiveCart(
    transaction,
    context,
    now,
  );

  const existing =
    await findActiveCart(
      transaction,
      context,
    );

  if (existing) {
    return existing;
  }

  try {
    return await transaction.cart.create({
      data: {
        storefrontId:
          context.storefrontId,
        userId: context.userId,
        currencyCode:
          context.currencyCode,
        status: CartStatus.ACTIVE,
        expiresAt:
          cartExpiryFrom(now),
      },
      include: cartInclude,
    });
  } catch (error) {
    if (
      !isPrismaErrorCode(
        error,
        "P2002",
      )
    ) {
      throw error;
    }

    const concurrentlyCreated =
      await findActiveCart(
        transaction,
        context,
      );

    if (concurrentlyCreated) {
      return concurrentlyCreated;
    }

    throw new CartServiceError(
      "CONFLICT",
      "The active cart could not be created.",
    );
  }
}

function chooseCurrentPrice<
  T extends {
    type: PriceType;
    startsAt: Date | null;
    updatedAt: Date;
  },
>(
  prices: readonly T[],
): T | null {
  if (prices.length === 0) {
    return null;
  }

  return [...prices].sort(
    (left, right) => {
      const typeDifference =
        (
          right.type ===
          PriceType.SALE
            ? 1
            : 0
        ) -
        (
          left.type ===
          PriceType.SALE
            ? 1
            : 0
        );

      if (typeDifference !== 0) {
        return typeDifference;
      }

      const startDifference =
        (
          right.startsAt?.getTime() ??
          0
        ) -
        (
          left.startsAt?.getTime() ??
          0
        );

      if (startDifference !== 0) {
        return startDifference;
      }

      return (
        right.updatedAt.getTime() -
        left.updatedAt.getTime()
      );
    },
  )[0] ?? null;
}

async function resolveSellableVariant(
  transaction:
    Prisma.TransactionClient,
  input: {
    context: CustomerContext;
    productVariantId: string;
    requestedQuantity: number;
    now: Date;
  },
) {
  const productVariantId =
    requireIdentifier(
      input.productVariantId,
      "Product variant",
    );

  const variant =
    await transaction.productVariant.findFirst(
      {
        where: {
          id: productVariantId,
          status:
            ProductVariantStatus.ACTIVE,
          storefrontProduct: {
            storefrontId:
              input.context.storefrontId,
            status:
              StorefrontProductStatus.ACTIVE,
            product: {
              status:
                ProductStatus.ACTIVE,
            },
            AND: [
              {
                OR: [
                  {
                    availableFrom:
                      null,
                  },
                  {
                    availableFrom: {
                      lte: input.now,
                    },
                  },
                ],
              },
              {
                OR: [
                  {
                    availableUntil:
                      null,
                  },
                  {
                    availableUntil: {
                      gt: input.now,
                    },
                  },
                ],
              },
            ],
          },
        },
        include: {
          storefrontProduct: {
            include: {
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
          prices: {
            where: {
              currencyCode:
                input.context
                  .currencyCode,
              isActive: true,
              AND: [
                {
                  OR: [
                    {
                      startsAt: null,
                    },
                    {
                      startsAt: {
                        lte:
                          input.now,
                      },
                    },
                  ],
                },
                {
                  OR: [
                    {
                      endsAt: null,
                    },
                    {
                      endsAt: {
                        gt:
                          input.now,
                      },
                    },
                  ],
                },
              ],
            },
          },
          inventory: true,
        },
      },
    );

  if (!variant) {
    throw new CartServiceError(
      "PRODUCT_UNAVAILABLE",
      "The selected product variant is unavailable.",
    );
  }

  const price = chooseCurrentPrice(
    variant.prices,
  );

  if (!price) {
    throw new CartServiceError(
      "PRICE_UNAVAILABLE",
      "The selected product does not have a current storefront price.",
    );
  }

  const maximumQuantity =
    variant.storefrontProduct
      .maxPerOrder;

  if (
    maximumQuantity !== null &&
    input.requestedQuantity >
      maximumQuantity
  ) {
    throw new CartServiceError(
      "QUANTITY_LIMIT",
      `A maximum of ${maximumQuantity} may be ordered for this product.`,
      {
        maximumQuantity,
      },
    );
  }

  const inventory =
    variant.inventory;

  if (!inventory) {
    throw new CartServiceError(
      "PRODUCT_UNAVAILABLE",
      "Inventory is unavailable for the selected product.",
    );
  }

  const availableQuantity =
    inventory.quantityOnHand -
    inventory.quantityReserved;

  if (
    inventory.isTracked &&
    !inventory.allowBackorder &&
    input.requestedQuantity >
      availableQuantity
  ) {
    throw new CartServiceError(
      "INSUFFICIENT_STOCK",
      "The requested quantity is not currently available.",
      {
        availableQuantity:
          Math.max(
            availableQuantity,
            0,
          ),
      },
    );
  }

  return {
    variant,
    price,
    availableQuantity:
      inventory.isTracked
        ? Math.max(
            availableQuantity,
            0,
          )
        : null,
  };
}

async function loadCartById(
  transaction:
    Prisma.TransactionClient,
  cartId: string,
): Promise<CartRecord> {
  const cart =
    await transaction.cart.findUnique({
      where: {
        id: cartId,
      },
      include: cartInclude,
    });

  if (!cart) {
    throw new CartServiceError(
      "CART_NOT_FOUND",
      "The cart was not found.",
    );
  }

  return cart;
}

async function touchCart(
  transaction:
    Prisma.TransactionClient,
  cartId: string,
  now: Date,
): Promise<void> {
  await transaction.cart.update({
    where: {
      id: cartId,
    },
    data: {
      expiresAt:
        cartExpiryFrom(now),
    },
  });
}

export async function getOrCreateActiveCart(
  input: CartIdentityInput,
): Promise<CartView> {
  return prisma.$transaction(
    async (transaction) => {
      const context =
        await resolveCustomerContext(
          transaction,
          input,
        );

      const cart =
        await ensureActiveCart(
          transaction,
          context,
          new Date(),
        );

      return buildCartView(cart);
    },
  );
}

export async function getActiveCart(
  input: CartIdentityInput,
): Promise<CartView | null> {
  return prisma.$transaction(
    async (transaction) => {
      const context =
        await resolveCustomerContext(
          transaction,
          input,
        );

      const now = new Date();

      await expireOldActiveCart(
        transaction,
        context,
        now,
      );

      const cart =
        await findActiveCart(
          transaction,
          context,
        );

      return cart
        ? buildCartView(cart)
        : null;
    },
  );
}

export async function addCartItem(
  input: AddCartItemInput,
): Promise<CartView> {
  return prisma.$transaction(
    async (transaction) => {
      const quantity =
        requireCartQuantity(
          input.quantity,
        );

      const context =
        await resolveCustomerContext(
          transaction,
          input,
        );

      const now = new Date();

      const cart =
        await ensureActiveCart(
          transaction,
          context,
          now,
        );

      const productVariantId =
        requireIdentifier(
          input.productVariantId,
          "Product variant",
        );

      const existingItem =
        await transaction.cartItem.findFirst(
          {
            where: {
              cartId: cart.id,
              productVariantId,
            },
          },
        );

      const requestedQuantity =
        quantity +
        (
          existingItem?.quantity ??
          0
        );

      const sellable =
        await resolveSellableVariant(
          transaction,
          {
            context,
            productVariantId,
            requestedQuantity,
            now,
          },
        );

      const itemData = {
        storefrontId:
          context.storefrontId,
        storefrontProductId:
          sellable.variant
            .storefrontProductId,
        productVariantId:
          sellable.variant.id,
        storefrontPriceId:
          sellable.price.id,
        currencyCode:
          context.currencyCode,
        quantity:
          requestedQuantity,
        unitPrice:
          sellable.price.amount,
        compareAtUnitPrice:
          sellable.price
            .compareAtAmount,
        productNameSnapshot:
          sellable.variant
            .storefrontProduct
            .product.name,
        variantTitleSnapshot:
          sellable.variant.title,
        skuSnapshot:
          sellable.variant.sku,
      };

      if (existingItem) {
        await transaction.cartItem.update(
          {
            where: {
              id: existingItem.id,
            },
            data: itemData,
          },
        );
      } else {
        try {
          await transaction.cartItem.create(
            {
              data: {
                cartId: cart.id,
                ...itemData,
              },
            },
          );
        } catch (error) {
          if (
            isPrismaErrorCode(
              error,
              "P2002",
            )
          ) {
            throw new CartServiceError(
              "CONFLICT",
              "The cart changed while the item was being added. Please try again.",
            );
          }

          throw error;
        }
      }

      await touchCart(
        transaction,
        cart.id,
        now,
      );

      return buildCartView(
        await loadCartById(
          transaction,
          cart.id,
        ),
      );
    },
  );
}

export async function updateCartItemQuantity(
  input:
    UpdateCartItemQuantityInput,
): Promise<CartView> {
  return prisma.$transaction(
    async (transaction) => {
      const quantity =
        requireCartQuantity(
          input.quantity,
        );

      const context =
        await resolveCustomerContext(
          transaction,
          input,
        );

      const now = new Date();

      await expireOldActiveCart(
        transaction,
        context,
        now,
      );

      const cart =
        await findActiveCart(
          transaction,
          context,
        );

      if (!cart) {
        throw new CartServiceError(
          "CART_NOT_FOUND",
          "The active cart was not found.",
        );
      }

      const cartItemId =
        requireIdentifier(
          input.cartItemId,
          "Cart item",
        );

      const item =
        await transaction.cartItem.findFirst(
          {
            where: {
              id: cartItemId,
              cartId: cart.id,
              storefrontId:
                context.storefrontId,
            },
          },
        );

      if (!item) {
        throw new CartServiceError(
          "ITEM_NOT_FOUND",
          "The cart item was not found.",
        );
      }

      const sellable =
        await resolveSellableVariant(
          transaction,
          {
            context,
            productVariantId:
              item.productVariantId,
            requestedQuantity:
              quantity,
            now,
          },
        );

      await transaction.cartItem.update({
        where: {
          id: item.id,
        },
        data: {
          quantity,
          storefrontPriceId:
            sellable.price.id,
          unitPrice:
            sellable.price.amount,
          compareAtUnitPrice:
            sellable.price
              .compareAtAmount,
          productNameSnapshot:
            sellable.variant
              .storefrontProduct
              .product.name,
          variantTitleSnapshot:
            sellable.variant.title,
          skuSnapshot:
            sellable.variant.sku,
        },
      });

      await touchCart(
        transaction,
        cart.id,
        now,
      );

      return buildCartView(
        await loadCartById(
          transaction,
          cart.id,
        ),
      );
    },
  );
}

export async function removeCartItem(
  input: RemoveCartItemInput,
): Promise<CartView> {
  return prisma.$transaction(
    async (transaction) => {
      const context =
        await resolveCustomerContext(
          transaction,
          input,
        );

      const now = new Date();

      await expireOldActiveCart(
        transaction,
        context,
        now,
      );

      const cart =
        await findActiveCart(
          transaction,
          context,
        );

      if (!cart) {
        throw new CartServiceError(
          "CART_NOT_FOUND",
          "The active cart was not found.",
        );
      }

      const deleted =
        await transaction.cartItem.deleteMany(
          {
            where: {
              id: requireIdentifier(
                input.cartItemId,
                "Cart item",
              ),
              cartId: cart.id,
              storefrontId:
                context.storefrontId,
            },
          },
        );

      if (deleted.count !== 1) {
        throw new CartServiceError(
          "ITEM_NOT_FOUND",
          "The cart item was not found.",
        );
      }

      await touchCart(
        transaction,
        cart.id,
        now,
      );

      return buildCartView(
        await loadCartById(
          transaction,
          cart.id,
        ),
      );
    },
  );
}

export async function clearActiveCart(
  input: CartIdentityInput,
): Promise<CartView> {
  return prisma.$transaction(
    async (transaction) => {
      const context =
        await resolveCustomerContext(
          transaction,
          input,
        );

      const now = new Date();

      await expireOldActiveCart(
        transaction,
        context,
        now,
      );

      const cart =
        await findActiveCart(
          transaction,
          context,
        );

      if (!cart) {
        throw new CartServiceError(
          "CART_NOT_FOUND",
          "The active cart was not found.",
        );
      }

      await transaction.cartItem.deleteMany(
        {
          where: {
            cartId: cart.id,
          },
        },
      );

      await touchCart(
        transaction,
        cart.id,
        now,
      );

      return buildCartView(
        await loadCartById(
          transaction,
          cart.id,
        ),
      );
    },
  );
}

export async function refreshActiveCart(
  input: CartIdentityInput,
): Promise<CartView> {
  return prisma.$transaction(
    async (transaction) => {
      const context =
        await resolveCustomerContext(
          transaction,
          input,
        );

      const now = new Date();

      await expireOldActiveCart(
        transaction,
        context,
        now,
      );

      const cart =
        await findActiveCart(
          transaction,
          context,
        );

      if (!cart) {
        throw new CartServiceError(
          "CART_NOT_FOUND",
          "The active cart was not found.",
        );
      }

      for (const item of cart.items) {
        const sellable =
          await resolveSellableVariant(
            transaction,
            {
              context,
              productVariantId:
                item.productVariantId,
              requestedQuantity:
                item.quantity,
              now,
            },
          );

        await transaction.cartItem.update(
          {
            where: {
              id: item.id,
            },
            data: {
              storefrontPriceId:
                sellable.price.id,
              unitPrice:
                sellable.price.amount,
              compareAtUnitPrice:
                sellable.price
                  .compareAtAmount,
              productNameSnapshot:
                sellable.variant
                  .storefrontProduct
                  .product.name,
              variantTitleSnapshot:
                sellable.variant.title,
              skuSnapshot:
                sellable.variant.sku,
            },
          },
        );
      }

      await touchCart(
        transaction,
        cart.id,
        now,
      );

      return buildCartView(
        await loadCartById(
          transaction,
          cart.id,
        ),
      );
    },
  );
}

export async function validateActiveCart(
  input: CartIdentityInput,
): Promise<CartValidationResult> {
  return prisma.$transaction(
    async (transaction) => {
      const context =
        await resolveCustomerContext(
          transaction,
          input,
        );

      const now = new Date();

      await expireOldActiveCart(
        transaction,
        context,
        now,
      );

      const cart =
        await findActiveCart(
          transaction,
          context,
        );

      if (!cart) {
        throw new CartServiceError(
          "CART_NOT_FOUND",
          "The active cart was not found.",
        );
      }

      const issues:
        CartValidationIssue[] = [];

      for (const item of cart.items) {
        try {
          await resolveSellableVariant(
            transaction,
            {
              context,
              productVariantId:
                item.productVariantId,
              requestedQuantity:
                item.quantity,
              now,
            },
          );
        } catch (error) {
          if (
            !(error instanceof
              CartServiceError)
          ) {
            throw error;
          }

          if (
            ![
              "PRODUCT_UNAVAILABLE",
              "PRICE_UNAVAILABLE",
              "QUANTITY_LIMIT",
              "INSUFFICIENT_STOCK",
            ].includes(error.code)
          ) {
            throw error;
          }

          issues.push({
            cartItemId: item.id,
            productVariantId:
              item.productVariantId,
            code:
              error.code as
                CartValidationIssue["code"],
            message: error.message,
            availableQuantity:
              typeof error.details
                ?.availableQuantity ===
              "number"
                ? error.details
                    .availableQuantity
                : undefined,
            maximumQuantity:
              typeof error.details
                ?.maximumQuantity ===
              "number"
                ? error.details
                    .maximumQuantity
                : undefined,
          });
        }
      }

      return {
        valid: issues.length === 0,
        cart: buildCartView(cart),
        issues,
      };
    },
  );
}
