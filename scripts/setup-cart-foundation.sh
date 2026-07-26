#!/usr/bin/env bash

set -Eeuo pipefail

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
  grep -v '^?? scripts/setup-cart-foundation.sh$' ||
  true
)"

if [ -n "$UNEXPECTED_CHANGES" ]; then
  echo "Unexpected repository changes exist:"
  printf '%s\n' "$UNEXPECTED_CHANGES"
  exit 1
fi

echo "Branch: $CURRENT_BRANCH"
echo "Starting commit: $(git rev-parse --short HEAD)"
echo "PASS: No unexpected repository changes found."

echo
echo "=== VERIFY EXPECTED CATALOGUE FOUNDATION ==="

python - <<'PY'
from pathlib import Path

path = Path("prisma/schema.prisma")

content = path.read_text(
    encoding="utf-8",
)

required = [
    "model Storefront {",
    "model User {",
    "model StorefrontProduct {",
    "model ProductVariant {",
    "model StorefrontPrice {",
    "model Inventory {",
    "@@unique([id, storefrontId])",
]

for value in required:
    if value not in content:
        raise RuntimeError(
            f"Required schema foundation is missing: {value}"
        )

if "model Cart {" in content:
    raise RuntimeError(
        "A Cart model already exists. Stop and inspect before continuing."
    )

if "model CartItem {" in content:
    raise RuntimeError(
        "A CartItem model already exists. Stop and inspect before continuing."
    )

print(
    "PASS: Existing catalogue and customer foundations are available."
)
PY

echo
echo "=== ADD CART MODELS AND COMPOSITE RELATIONS ==="

python - <<'PY'
from pathlib import Path

path = Path("prisma/schema.prisma")

content = path.read_text(
    encoding="utf-8",
)

def replace_once(
    old: str,
    new: str,
    label: str,
) -> None:
    global content

    if old not in content:
        raise RuntimeError(
            f"Could not locate schema target for {label}."
        )

    content = content.replace(
        old,
        new,
        1,
    )

    print(f"Added {label}.")

replace_once(
    "model Currency {",
    """enum CartStatus {
  ACTIVE
  CHECKED_OUT
  ABANDONED
  EXPIRED
}

model Currency {""",
    "CartStatus enum",
)

replace_once(
    """  prices        StorefrontPrice[]
  createdAt""",
    """  prices        StorefrontPrice[]
  carts         Cart[]
  createdAt""",
    "currency-to-cart relation",
)

replace_once(
    """  phoneVerifications PhoneVerification[]
  createdAt""",
    """  phoneVerifications PhoneVerification[]
  carts              Cart[]
  createdAt""",
    "storefront-to-cart relation",
)

replace_once(
    """  phoneVerifications  PhoneVerification[]
  createdAt""",
    """  phoneVerifications  PhoneVerification[]
  carts               Cart[]
  createdAt""",
    "user-to-cart relation",
)

replace_once(
    """  variants       ProductVariant[]
  images         ProductImage[]
  createdAt""",
    """  variants       ProductVariant[]
  images         ProductImage[]
  cartItems      CartItem[]
  createdAt""",
    "storefront-product cart-item relation",
)

replace_once(
    """  inventory           Inventory?
  createdAt""",
    """  inventory           Inventory?
  cartItems           CartItem[]
  createdAt""",
    "variant cart-item relation",
)

replace_once(
    """  currency         Currency       @relation(fields: [currencyCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  createdAt""",
    """  currency         Currency       @relation(fields: [currencyCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  cartItems        CartItem[]
  createdAt""",
    "price cart-item relation",
)

replace_once(
    """  @@index([countryCode, status])
  @@index([currencyCode])""",
    """  @@unique([id, currencyCode])
  @@index([countryCode, status])
  @@index([currencyCode])""",
    "storefront composite currency identity",
)

replace_once(
    """  @@unique([storefrontId, productId])
  @@unique([storefrontId, slug])""",
    """  @@unique([id, storefrontId])
  @@unique([storefrontId, productId])
  @@unique([storefrontId, slug])""",
    "storefront-product composite identity",
)

replace_once(
    """  @@index([storefrontProductId, status])
  @@map("product_variants")""",
    """  @@unique([id, storefrontProductId])
  @@index([storefrontProductId, status])
  @@map("product_variants")""",
    "variant composite listing identity",
)

replace_once(
    """  @@index([productVariantId, isActive, startsAt, endsAt])
  @@index([currencyCode])""",
    """  @@unique([id, productVariantId, currencyCode])
  @@index([productVariantId, isActive, startsAt, endsAt])
  @@index([currencyCode])""",
    "price composite variant-currency identity",
)

cart_models = """

model Cart {
  id           String     @id @default(cuid())
  storefrontId String
  userId       String
  currencyCode String     @db.VarChar(3)
  status       CartStatus @default(ACTIVE)
  expiresAt    DateTime?
  checkedOutAt DateTime?
  abandonedAt  DateTime?
  storefront   Storefront @relation(fields: [storefrontId, currencyCode], references: [id, currencyCode], onDelete: Cascade, onUpdate: Cascade)
  user         User       @relation(fields: [userId, storefrontId], references: [id, storefrontId], onDelete: Cascade, onUpdate: Cascade)
  currency     Currency   @relation(fields: [currencyCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  items        CartItem[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@unique([id, storefrontId, currencyCode])
  @@index([storefrontId, userId, status])
  @@index([userId, createdAt])
  @@index([status, expiresAt])
  @@map("carts")
}

model CartItem {
  id                  String            @id @default(cuid())
  cartId              String
  storefrontId        String
  storefrontProductId String
  productVariantId    String
  storefrontPriceId   String
  currencyCode        String            @db.VarChar(3)
  quantity            Int               @default(1)
  unitPrice           Decimal           @db.Decimal(18, 2)
  compareAtUnitPrice  Decimal?          @db.Decimal(18, 2)
  productNameSnapshot String
  variantTitleSnapshot String
  skuSnapshot         String            @db.VarChar(80)
  cart                Cart              @relation(fields: [cartId, storefrontId, currencyCode], references: [id, storefrontId, currencyCode], onDelete: Cascade, onUpdate: Cascade)
  storefrontProduct   StorefrontProduct @relation(fields: [storefrontProductId, storefrontId], references: [id, storefrontId], onDelete: Restrict, onUpdate: Cascade)
  productVariant      ProductVariant    @relation(fields: [productVariantId, storefrontProductId], references: [id, storefrontProductId], onDelete: Restrict, onUpdate: Cascade)
  storefrontPrice     StorefrontPrice   @relation(fields: [storefrontPriceId, productVariantId, currencyCode], references: [id, productVariantId, currencyCode], onDelete: Restrict, onUpdate: Cascade)
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  @@unique([cartId, productVariantId])
  @@index([cartId, createdAt])
  @@index([storefrontId, storefrontProductId])
  @@index([productVariantId])
  @@index([storefrontPriceId])
  @@map("cart_items")
}
"""

content = content.rstrip() + cart_models + "\n"

path.write_text(
    content,
    encoding="utf-8",
)

print("PASS: Cart schema foundation added.")
PY

echo
echo "=== FORMAT AND VALIDATE UPDATED SCHEMA ==="

npx prisma format
npm run db:validate

echo
echo "=== VERIFY COMPOSITE CART RELATIONS ==="

python - <<'PY'
from pathlib import Path

content = Path(
    "prisma/schema.prisma"
).read_text(
    encoding="utf-8",
)

required = [
    "enum CartStatus {",
    "model Cart {",
    "model CartItem {",
    "@@unique([id, currencyCode])",
    "@@unique([id, storefrontProductId])",
    "@@unique([id, productVariantId, currencyCode])",
    (
        "@relation(fields: [cartId, storefrontId, currencyCode], "
        "references: [id, storefrontId, currencyCode]"
    ),
    (
        "@relation(fields: [storefrontProductId, storefrontId], "
        "references: [id, storefrontId]"
    ),
    (
        "@relation(fields: [productVariantId, storefrontProductId], "
        "references: [id, storefrontProductId]"
    ),
    (
        "@relation(fields: [storefrontPriceId, productVariantId, currencyCode], "
        "references: [id, productVariantId, currencyCode]"
    ),
]

for value in required:
    if value not in content:
        raise RuntimeError(
            f"Cart isolation definition is missing: {value}"
        )

print(
    "PASS: Cart, storefront, variant, price and currency relations are composite."
)
PY

echo
echo "=== START POSTGRESQL ==="

npm run db:up

echo
echo "=== CREATE UNAPPLIED CART MIGRATION ==="

BEFORE_FILE="$(
  mktemp
)"

AFTER_FILE="$(
  mktemp
)"

find prisma/migrations \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -printf '%f\n' |
  sort >"$BEFORE_FILE"

npx prisma migrate dev \
  --name cart_foundation \
  --create-only

find prisma/migrations \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -printf '%f\n' |
  sort >"$AFTER_FILE"

NEW_MIGRATIONS="$(
  comm -13 \
    "$BEFORE_FILE" \
    "$AFTER_FILE"
)"

rm -f \
  "$BEFORE_FILE" \
  "$AFTER_FILE"

NEW_MIGRATION_COUNT="$(
  printf '%s\n' "$NEW_MIGRATIONS" |
  sed '/^$/d' |
  wc -l |
  tr -d ' '
)"

if [ "$NEW_MIGRATION_COUNT" != "1" ]; then
  echo "Expected exactly one new migration."
  echo "Detected:"
  printf '%s\n' "$NEW_MIGRATIONS"
  exit 1
fi

MIGRATION_NAME="$(
  printf '%s\n' "$NEW_MIGRATIONS" |
  sed '/^$/d'
)"

MIGRATION_DIR="prisma/migrations/$MIGRATION_NAME"
MIGRATION_SQL="$MIGRATION_DIR/migration.sql"

test -f "$MIGRATION_SQL"

echo "Migration: $MIGRATION_NAME"

echo
echo "=== ADD POSTGRESQL CART INVARIANTS ==="

cat >>"$MIGRATION_SQL" <<'SQL'

-- Only one ACTIVE cart may exist for a customer in one storefront.
CREATE UNIQUE INDEX "carts_one_active_per_customer_storefront"
ON "carts" ("storefrontId", "userId")
WHERE "status" = 'ACTIVE';

-- Cart quantities and price snapshots must remain valid.
ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_quantity_positive"
CHECK ("quantity" > 0);

ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_unit_price_nonnegative"
CHECK ("unitPrice" >= 0);

ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_compare_price_nonnegative"
CHECK (
  "compareAtUnitPrice" IS NULL
  OR "compareAtUnitPrice" >= 0
);
SQL

echo "PASS: PostgreSQL cart invariants added."

echo
echo "=== VERIFY MIGRATION CONTENT ==="

python - "$MIGRATION_SQL" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])

content = path.read_text(
    encoding="utf-8",
)

required = [
    'CREATE TYPE "CartStatus"',
    'CREATE TABLE "carts"',
    'CREATE TABLE "cart_items"',
    (
        'CREATE UNIQUE INDEX '
        '"carts_one_active_per_customer_storefront"'
    ),
    (
        'CONSTRAINT '
        '"cart_items_quantity_positive"'
    ),
    (
        'CONSTRAINT '
        '"cart_items_unit_price_nonnegative"'
    ),
    (
        'CONSTRAINT '
        '"cart_items_compare_price_nonnegative"'
    ),
    (
        'FOREIGN KEY ("cartId", "storefrontId", "currencyCode")'
    ),
    (
        'FOREIGN KEY ("storefrontProductId", "storefrontId")'
    ),
    (
        'FOREIGN KEY ("productVariantId", "storefrontProductId")'
    ),
    (
        'FOREIGN KEY ("storefrontPriceId", "productVariantId", "currencyCode")'
    ),
]

for value in required:
    if value not in content:
        raise RuntimeError(
            f"Migration requirement is missing: {value}"
        )

print(
    "PASS: Migration contains all cart tables and isolation constraints."
)
PY

echo
echo "=== APPLY CART MIGRATION ==="

npx prisma migrate dev

echo
echo "=== GENERATE PRISMA CLIENT ==="

npm run db:generate

echo
echo "=== VERIFY MIGRATION STATUS ==="

npx prisma migrate status

echo
echo "=== CREATE CART FOUNDATION AUDIT ==="

cat > scripts/audit-cart-foundation.ts <<'TS'
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
TS

echo
echo "=== REGISTER CART FOUNDATION AUDIT ==="

npm pkg set \
  "scripts.db:audit:cart=node --env-file=.env --conditions=react-server --import tsx scripts/audit-cart-foundation.ts"

echo
echo "=== RUN CART FOUNDATION AUDIT ==="

npm run db:audit:cart

echo
echo "=== RUN DATABASE FOUNDATION REGRESSION AUDITS ==="

npm run db:audit
npm run db:audit:catalog
npm run db:audit:services
npm run db:audit:identity

echo
echo "=== RUN AUTHENTICATION REGRESSION AUDITS ==="

npm run db:audit:auth
npm run db:audit:auth-api
npm run db:audit:auth-ui
npm run db:audit:recovery
npm run db:audit:recovery-http

echo
echo "=== RUN APPLICATION VALIDATION ==="

npm run lint
npm run build

echo
echo "=== VERIFY CART AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TS'
import { prisma } from "./src/lib/prisma";

const temporaryUsers =
  await prisma.user.count({
    where: {
      normalizedEmail: {
        contains:
          "cart-foundation-",
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
          "cart-foundation-",
      },
    },
  });

if (
  temporaryUsers !== 0 ||
  temporaryProducts !== 0
) {
  throw new Error(
    [
      `${temporaryUsers} temporary cart user(s) remain.`,
      `${temporaryProducts} temporary cart product(s) remain.`,
    ].join(" "),
  );
}

console.log(
  "PASS: No temporary cart audit records remain.",
);

await prisma.$disconnect();
TS

echo
echo "=== VERIFY MIGRATION STATUS AGAIN ==="

npx prisma migrate status

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "PHASE 2F-A CART DATABASE FOUNDATION PASSED"
