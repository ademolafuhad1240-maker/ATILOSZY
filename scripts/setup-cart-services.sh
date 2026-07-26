#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2f-b-details.log"
: >"$DETAIL_LOG"

run_quiet() {
  local label="$1"
  shift

  echo
  echo "=== $label ==="

  if "$@" >>"$DETAIL_LOG" 2>&1; then
    echo "PASS: $label"
  else
    echo "FAIL: $label"
    echo
    echo "=== FAILURE LOG TAIL ==="
    tail -n 140 "$DETAIL_LOG"
    exit 1
  fi
}

echo "=== VERIFY CLEAN CHECKPOINT ==="

EXPECTED_BRANCH="feat/commerce-foundation"
CURRENT_BRANCH="$(git branch --show-current)"

if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "Expected branch: $EXPECTED_BRANCH"
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

UNEXPECTED_CHANGES="$(
  git status --porcelain |
  grep -v '^?? scripts/setup-cart-services.sh$' ||
  true
)"

if [ -n "$UNEXPECTED_CHANGES" ]; then
  echo "Unexpected repository changes exist:"
  printf '%s\n' "$UNEXPECTED_CHANGES"
  exit 1
fi

echo "Branch: $CURRENT_BRANCH"
echo "Starting commit: $(git rev-parse --short HEAD)"
echo "PASS: Working tree is clean."

echo
echo "=== VERIFY CART FOUNDATION ==="

python - <<'PY'
from pathlib import Path

schema = Path(
    "prisma/schema.prisma"
).read_text(
    encoding="utf-8",
)

required = [
    "enum CartStatus {",
    "model Cart {",
    "model CartItem {",
    "@@unique([cartId, productVariantId])",
    "carts              Cart[]",
]

for value in required:
    if value not in schema:
        raise RuntimeError(
            f"Required cart foundation value is missing: {value}"
        )

migration_files = list(
    Path("prisma/migrations").glob(
        "*_cart_foundation/migration.sql"
    )
)

if len(migration_files) != 1:
    raise RuntimeError(
        "Expected exactly one cart-foundation migration."
    )

migration = migration_files[0].read_text(
    encoding="utf-8",
)

for value in [
    "carts_one_active_per_customer_storefront",
    "cart_items_quantity_positive",
    "cart_items_unit_price_nonnegative",
]:
    if value not in migration:
        raise RuntimeError(
            f"Cart migration constraint is missing: {value}"
        )

print(
    "PASS: Cart schema and database constraints are available."
)
PY

echo
echo "=== CREATE CART SERVICE DIRECTORY ==="

mkdir -p src/server/cart

echo
echo "=== CREATE CART ERRORS ==="

cat > src/server/cart/errors.ts <<'TS'
export type CartErrorCode =
  | "VALIDATION"
  | "CUSTOMER_UNAVAILABLE"
  | "CART_NOT_FOUND"
  | "CART_INACTIVE"
  | "ITEM_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "PRICE_UNAVAILABLE"
  | "QUANTITY_LIMIT"
  | "INSUFFICIENT_STOCK"
  | "CONFLICT";

export class CartServiceError extends Error {
  readonly code: CartErrorCode;

  readonly details:
    | Record<string, unknown>
    | undefined;

  constructor(
    code: CartErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);

    this.name = "CartServiceError";
    this.code = code;
    this.details = details;
  }
}

export function isPrismaErrorCode(
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
TS

echo
echo "=== CREATE CART TYPES ==="

cat > src/server/cart/types.ts <<'TS'
import type {
  CartStatus,
} from "../../generated/prisma/client";

export interface CartIdentityInput {
  storefrontCode: string;
  userId: string;
}

export interface AddCartItemInput
  extends CartIdentityInput {
  productVariantId: string;
  quantity: number;
}

export interface UpdateCartItemQuantityInput
  extends CartIdentityInput {
  cartItemId: string;
  quantity: number;
}

export interface RemoveCartItemInput
  extends CartIdentityInput {
  cartItemId: string;
}

export interface CartItemView {
  id: string;
  storefrontProductId: string;
  productVariantId: string;
  storefrontPriceId: string;
  quantity: number;
  unitPrice: string;
  compareAtUnitPrice: string | null;
  lineTotal: string;
  productName: string;
  variantTitle: string;
  sku: string;
}

export interface CartView {
  id: string;
  storefrontId: string;
  storefrontCode: string;
  userId: string;
  currencyCode: string;
  status: CartStatus;
  expiresAt: string | null;
  itemCount: number;
  uniqueItemCount: number;
  subtotal: string;
  compareAtSubtotal: string | null;
  savings: string;
  items: CartItemView[];
  createdAt: string;
  updatedAt: string;
}

export type CartValidationIssueCode =
  | "PRODUCT_UNAVAILABLE"
  | "PRICE_UNAVAILABLE"
  | "QUANTITY_LIMIT"
  | "INSUFFICIENT_STOCK";

export interface CartValidationIssue {
  cartItemId: string;
  productVariantId: string;
  code: CartValidationIssueCode;
  message: string;
  availableQuantity?: number | null;
  maximumQuantity?: number | null;
}

export interface CartValidationResult {
  valid: boolean;
  cart: CartView;
  issues: CartValidationIssue[];
}
TS

echo
echo "=== CREATE CART VALIDATION ==="

cat > src/server/cart/validation.ts <<'TS'
import {
  CartServiceError,
} from "./errors";

export function normalizeStorefrontCode(
  value: string,
): string {
  const normalized =
    value.trim().toUpperCase();

  if (
    normalized.length < 2 ||
    normalized.length > 12 ||
    !/^[A-Z0-9_-]+$/.test(
      normalized,
    )
  ) {
    throw new CartServiceError(
      "VALIDATION",
      "The storefront code is invalid.",
    );
  }

  return normalized;
}

export function requireIdentifier(
  value: string,
  label: string,
): string {
  const normalized = value.trim();

  if (
    normalized.length < 1 ||
    normalized.length > 191
  ) {
    throw new CartServiceError(
      "VALIDATION",
      `${label} is invalid.`,
    );
  }

  return normalized;
}

export function requireCartQuantity(
  value: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 999
  ) {
    throw new CartServiceError(
      "VALIDATION",
      "Cart quantity must be a whole number between 1 and 999.",
    );
  }

  return value;
}
TS

echo
echo "=== CREATE SECURE CART SERVICES ==="

cat > src/server/cart/service.ts <<'TS'
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
TS

echo
echo "=== CREATE CART EXPORTS ==="

cat > src/server/cart/index.ts <<'TS'
export {
  CartServiceError,
  isPrismaErrorCode,
  type CartErrorCode,
} from "./errors";

export {
  addCartItem,
  clearActiveCart,
  getActiveCart,
  getOrCreateActiveCart,
  refreshActiveCart,
  removeCartItem,
  updateCartItemQuantity,
  validateActiveCart,
} from "./service";

export type {
  AddCartItemInput,
  CartIdentityInput,
  CartItemView,
  CartValidationIssue,
  CartValidationIssueCode,
  CartValidationResult,
  CartView,
  RemoveCartItemInput,
  UpdateCartItemQuantityInput,
} from "./types";
TS

echo
echo "=== CREATE CART SERVICE AUDIT ==="

cat > scripts/audit-cart-services.ts <<'TS'
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
      price: {
        amount: input.amount,
        compareAtAmount:
          input.amount ===
          "15000.00"
            ? "18000.00"
            : null,
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

    console.log(
      "PASS: Adding the same variant merges its cart quantity.",
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
      "60000.00",
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
      "15000.00",
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
TS

echo
echo "=== REGISTER CART SERVICE AUDIT ==="

npm pkg set \
  "scripts.db:audit:cart-services=node --env-file=.env --conditions=react-server --import tsx scripts/audit-cart-services.ts"

run_quiet \
  "VALIDATE DATABASE SCHEMA" \
  npm run db:validate

run_quiet \
  "GENERATE PRISMA CLIENT" \
  npm run db:generate

run_quiet \
  "VERIFY MIGRATION STATUS" \
  npx prisma migrate status

echo
echo "=== RUN SECURE CART SERVICE AUDIT ==="

if npm run db:audit:cart-services \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: Secure cart service audit"
else
  echo "FAIL: Secure cart service audit"
  exit 1
fi

run_quiet \
  "CART FOUNDATION REGRESSION AUDIT" \
  npm run db:audit:cart

run_quiet \
  "STOREFRONT FOUNDATION REGRESSION AUDIT" \
  npm run db:audit

run_quiet \
  "CATALOGUE FOUNDATION REGRESSION AUDIT" \
  npm run db:audit:catalog

run_quiet \
  "CATALOGUE SERVICE REGRESSION AUDIT" \
  npm run db:audit:services

run_quiet \
  "CUSTOMER IDENTITY REGRESSION AUDIT" \
  npm run db:audit:identity

run_quiet \
  "AUTHENTICATION SERVICE REGRESSION AUDIT" \
  npm run db:audit:auth

run_quiet \
  "AUTHENTICATION API REGRESSION AUDIT" \
  npm run db:audit:auth-api

run_quiet \
  "AUTHENTICATION PAGE REGRESSION AUDIT" \
  npm run db:audit:auth-ui

run_quiet \
  "RECOVERY SERVICE REGRESSION AUDIT" \
  npm run db:audit:recovery

run_quiet \
  "RECOVERY HTTP REGRESSION AUDIT" \
  npm run db:audit:recovery-http

run_quiet \
  "ESLINT" \
  npm run lint

run_quiet \
  "PRODUCTION BUILD" \
  npm run build

echo
echo "=== VERIFY CART SERVICE AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TS'
import { prisma } from "./src/lib/prisma";

const temporaryUsers =
  await prisma.user.count({
    where: {
      normalizedEmail: {
        contains:
          "cart-services-",
        endsWith:
          "@example.test",
      },
    },
  });

const temporaryProducts =
  await prisma.product.count({
    where: {
      slug: {
        contains:
          "cart-service-",
      },
    },
  });

if (
  temporaryUsers !== 0 ||
  temporaryProducts !== 0
) {
  throw new Error(
    [
      `${temporaryUsers} temporary customer(s) remain.`,
      `${temporaryProducts} temporary product(s) remain.`,
    ].join(" "),
  );
}

console.log(
  "PASS: No temporary cart service audit records remain.",
);

await prisma.$disconnect();
TS

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "Detailed validation log:"
echo "$DETAIL_LOG"

echo
echo "PHASE 2F-B SECURE CART SERVICES PASSED"
