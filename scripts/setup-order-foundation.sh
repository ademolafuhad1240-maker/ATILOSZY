#!/usr/bin/env bash

set -Eeuo pipefail

DETAIL_LOG="/tmp/sorvyra-phase-2g-a-details.log"
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
    tail -n 200 "$DETAIL_LOG"
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
  grep -v \
    '^?? scripts/setup-order-foundation.sh$' ||
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
echo "=== VERIFY REQUIRED FOUNDATIONS ==="

python - <<'PYVERIFY'
from pathlib import Path

schema = Path(
    "prisma/schema.prisma"
).read_text(
    encoding="utf-8",
)

required = [
    "model Currency {",
    "model Storefront {",
    "model User {",
    "model CustomerAddress {",
    "model StorefrontProduct {",
    "model ProductVariant {",
    "model StorefrontPrice {",
    "model Cart {",
    "model CartItem {",
    "@@unique([id, currencyCode])",
    "@@unique([id, storefrontId])",
    "@@unique([id, storefrontProductId])",
    "@@unique([id, productVariantId, currencyCode])",
]

for value in required:
    if value not in schema:
        raise RuntimeError(
            f"Required foundation is missing: {value}"
        )

for forbidden in [
    "model Order {",
    "model OrderItem {",
    "enum OrderStatus {",
]:
    if forbidden in schema:
        raise RuntimeError(
            f"Order foundation already appears to exist: {forbidden}"
        )

required_files = [
    Path("src/server/cart/index.ts"),
    Path("src/server/catalog/index.ts"),
    Path("src/server/auth/index.ts"),
    Path("scripts/audit-cart-foundation.ts"),
]

for path in required_files:
    if not path.exists():
        raise RuntimeError(
            f"Required file is missing: {path}"
        )

print(
    "PASS: Storefront, identity, catalogue and cart foundations are ready."
)
PYVERIFY

echo
echo "=== ADD ORDER ENUMS, MODELS AND RELATIONS ==="

python - <<'PYSCHEMA'
from pathlib import Path
import re

path = Path(
    "prisma/schema.prisma"
)

schema = path.read_text(
    encoding="utf-8",
)

def model_block(
    content: str,
    model_name: str,
) -> re.Match[str]:
    pattern = re.compile(
        rf"^model\s+{re.escape(model_name)}\s*\{{.*?^\}}",
        re.MULTILINE |
        re.DOTALL,
    )

    match = pattern.search(content)

    if not match:
        raise RuntimeError(
            f"Could not locate model {model_name}."
        )

    return match

def add_relation_field(
    content: str,
    model_name: str,
    field_name: str,
    field_definition: str,
) -> str:
    match = model_block(
        content,
        model_name,
    )

    block = match.group(0)

    if re.search(
        rf"^\s*{re.escape(field_name)}\s+",
        block,
        re.MULTILINE,
    ):
        raise RuntimeError(
            f"{model_name}.{field_name} already exists."
        )

    index_match = re.search(
        r"^\s*@@",
        block,
        re.MULTILINE,
    )

    if index_match:
        insertion = index_match.start()
    else:
        insertion = block.rfind("}")

    updated = (
        block[:insertion] +
        f"  {field_name} {field_definition}\n" +
        block[insertion:]
    )

    return (
        content[:match.start()] +
        updated +
        content[match.end():]
    )

relations = [
    (
        "Currency",
        "orders",
        "Order[]",
    ),
    (
        "Storefront",
        "orders",
        "Order[]",
    ),
    (
        "User",
        "orders",
        "Order[]",
    ),
    (
        "Cart",
        "order",
        "Order?",
    ),
    (
        "StorefrontProduct",
        "orderItems",
        "OrderItem[]",
    ),
    (
        "ProductVariant",
        "orderItems",
        "OrderItem[]",
    ),
    (
        "StorefrontPrice",
        "orderItems",
        "OrderItem[]",
    ),
]

for (
    model_name,
    field_name,
    field_definition,
) in relations:
    schema = add_relation_field(
        schema,
        model_name,
        field_name,
        field_definition,
    )

addition = r'''

enum OrderStatus {
  PENDING_PAYMENT
  PAYMENT_PROCESSING
  PAID
  CONFIRMED
  PROCESSING
  COMPLETED
  CANCELLED
  REFUND_PENDING
  REFUNDED
}

enum OrderFulfilmentMethod {
  PICKUP
  DELIVERY
  INSTALLATION
  DELIVERY_AND_INSTALLATION
}

enum OrderFulfilmentStatus {
  NOT_STARTED
  AWAITING_DELIVERY_QUOTE
  DELIVERY_QUOTED
  SCHEDULED
  PREPARING
  READY_FOR_PICKUP
  OUT_FOR_DELIVERY
  INSTALLATION_IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum OrderPaymentPurpose {
  PRODUCT
  DELIVERY_FEE
  REFUND
}

enum OrderPaymentMethod {
  CARD
  BANK_TRANSFER
  USSD
  PAY_BY_BANK
  CASH
  PROVIDER_WALLET
  MANUAL_ADJUSTMENT
}

enum OrderPaymentStatus {
  NOT_REQUIRED
  PENDING
  PROCESSING
  PAID
  FAILED
  CANCELLED
  PARTIALLY_REFUNDED
  REFUNDED
}

enum OrderAddressType {
  DELIVERY
  BILLING
  INSTALLATION
}

enum DeliveryFeeQuoteStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
  CANCELLED
  PAID
}

enum PickupReservationStatus {
  ACTIVE
  EXTENDED
  COLLECTED
  EXPIRED
  CANCELLED
}

model Order {
  id                    String                  @id @default(cuid())
  orderNumber           String                  @unique @db.VarChar(40)
  storefrontId          String
  userId                String
  currencyCode          String                  @db.VarChar(3)
  cartId                String                  @unique
  status                OrderStatus             @default(PENDING_PAYMENT)
  fulfilmentMethod      OrderFulfilmentMethod
  fulfilmentStatus      OrderFulfilmentStatus   @default(NOT_STARTED)
  productPaymentStatus  OrderPaymentStatus      @default(PENDING)
  deliveryPaymentStatus OrderPaymentStatus      @default(NOT_REQUIRED)
  productSubtotal       Decimal                 @db.Decimal(18, 2)
  discountTotal         Decimal                 @default(0) @db.Decimal(18, 2)
  productTotal          Decimal                 @db.Decimal(18, 2)
  deliveryFeeTotal      Decimal                 @default(0) @db.Decimal(18, 2)
  grandTotal            Decimal                 @db.Decimal(18, 2)
  customerName          String                  @db.VarChar(160)
  customerEmail         String                  @db.VarChar(320)
  customerPhone         String                  @db.VarChar(32)
  customerNote          String?
  cancellationReason    String?
  placedAt              DateTime                @default(now())
  paidAt                DateTime?
  confirmedAt           DateTime?
  completedAt           DateTime?
  cancelledAt           DateTime?
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt
  storefront            Storefront              @relation(fields: [storefrontId, currencyCode], references: [id, currencyCode], onDelete: Restrict, onUpdate: Cascade)
  user                  User                    @relation(fields: [userId, storefrontId], references: [id, storefrontId], onDelete: Restrict, onUpdate: Cascade)
  currency              Currency                @relation(fields: [currencyCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  cart                  Cart                    @relation(fields: [cartId, storefrontId, currencyCode], references: [id, storefrontId, currencyCode], onDelete: Restrict, onUpdate: Cascade)
  items                 OrderItem[]
  addresses             OrderAddress[]
  payments              OrderPayment[]
  deliveryFeeQuotes     DeliveryFeeQuote[]
  pickupReservation     PickupReservation?
  deliveryVerification  DeliveryVerification?

  @@unique([id, storefrontId, currencyCode])
  @@unique([cartId, storefrontId, currencyCode])
  @@index([storefrontId, createdAt])
  @@index([storefrontId, status, createdAt])
  @@index([userId, createdAt])
  @@index([status, fulfilmentStatus])
  @@index([productPaymentStatus, deliveryPaymentStatus])
  @@map("orders")
}

model OrderItem {
  id                   String            @id @default(cuid())
  orderId              String
  storefrontId         String
  currencyCode         String            @db.VarChar(3)
  storefrontProductId  String
  productVariantId     String
  storefrontPriceId    String
  productName          String            @db.VarChar(240)
  variantTitle         String            @db.VarChar(240)
  sku                  String            @db.VarChar(120)
  quantity             Int
  unitPrice            Decimal           @db.Decimal(18, 2)
  compareAtUnitPrice   Decimal?          @db.Decimal(18, 2)
  lineSubtotal         Decimal           @db.Decimal(18, 2)
  discountTotal        Decimal           @default(0) @db.Decimal(18, 2)
  lineTotal            Decimal           @db.Decimal(18, 2)
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt
  order                Order             @relation(fields: [orderId, storefrontId, currencyCode], references: [id, storefrontId, currencyCode], onDelete: Cascade, onUpdate: Cascade)
  storefrontProduct    StorefrontProduct @relation(fields: [storefrontProductId, storefrontId], references: [id, storefrontId], onDelete: Restrict, onUpdate: Cascade)
  productVariant       ProductVariant    @relation(fields: [productVariantId, storefrontProductId], references: [id, storefrontProductId], onDelete: Restrict, onUpdate: Cascade)
  storefrontPrice      StorefrontPrice   @relation(fields: [storefrontPriceId, productVariantId, currencyCode], references: [id, productVariantId, currencyCode], onDelete: Restrict, onUpdate: Cascade)

  @@unique([orderId, productVariantId])
  @@index([orderId, createdAt])
  @@index([storefrontId, storefrontProductId])
  @@index([productVariantId])
  @@index([storefrontPriceId])
  @@map("order_items")
}

model OrderAddress {
  id              String           @id @default(cuid())
  orderId         String
  storefrontId    String
  currencyCode    String           @db.VarChar(3)
  type            OrderAddressType
  recipientName   String           @db.VarChar(160)
  phone           String           @db.VarChar(32)
  email           String?          @db.VarChar(320)
  countryCode     String           @db.VarChar(2)
  state           String?
  city            String
  postalCode      String?
  addressLine1    String
  addressLine2    String?
  deliveryNotes   String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  order           Order            @relation(fields: [orderId, storefrontId, currencyCode], references: [id, storefrontId, currencyCode], onDelete: Cascade, onUpdate: Cascade)

  @@unique([orderId, type])
  @@index([storefrontId, countryCode, city])
  @@map("order_addresses")
}

model OrderPayment {
  id                String               @id @default(cuid())
  orderId           String
  storefrontId      String
  currencyCode      String               @db.VarChar(3)
  purpose           OrderPaymentPurpose
  method            OrderPaymentMethod?
  status            OrderPaymentStatus   @default(PENDING)
  amount            Decimal              @db.Decimal(18, 2)
  provider          String?              @db.VarChar(80)
  providerReference String?              @db.VarChar(191)
  idempotencyKey    String?              @db.VarChar(191)
  failureCode       String?              @db.VarChar(120)
  failureMessage    String?
  providerMetadata  Json?
  initiatedAt       DateTime             @default(now())
  paidAt            DateTime?
  failedAt          DateTime?
  cancelledAt       DateTime?
  refundedAt        DateTime?
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt
  order             Order                @relation(fields: [orderId, storefrontId, currencyCode], references: [id, storefrontId, currencyCode], onDelete: Cascade, onUpdate: Cascade)

  @@unique([storefrontId, idempotencyKey])
  @@unique([provider, providerReference])
  @@index([orderId, purpose, status])
  @@index([storefrontId, createdAt])
  @@index([status, createdAt])
  @@map("order_payments")
}

model DeliveryFeeQuote {
  id           String                 @id @default(cuid())
  orderId      String
  storefrontId String
  currencyCode String                 @db.VarChar(3)
  amount       Decimal                @db.Decimal(18, 2)
  status       DeliveryFeeQuoteStatus @default(PENDING)
  note         String?
  quotedAt     DateTime               @default(now())
  expiresAt    DateTime
  acceptedAt   DateTime?
  rejectedAt   DateTime?
  cancelledAt  DateTime?
  paidAt       DateTime?
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt
  order        Order                  @relation(fields: [orderId, storefrontId, currencyCode], references: [id, storefrontId, currencyCode], onDelete: Cascade, onUpdate: Cascade)

  @@index([orderId, status, createdAt])
  @@index([status, expiresAt])
  @@map("delivery_fee_quotes")
}

model PickupReservation {
  id                    String                  @id @default(cuid())
  orderId               String                  @unique
  storefrontId          String
  currencyCode          String                  @db.VarChar(3)
  status                PickupReservationStatus @default(ACTIVE)
  originalReservedUntil DateTime
  reservedUntil         DateTime
  extensionCount        Int                     @default(0)
  extendedAt            DateTime?
  collectedAt           DateTime?
  cancelledAt           DateTime?
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt
  order                 Order                   @relation(fields: [orderId, storefrontId, currencyCode], references: [id, storefrontId, currencyCode], onDelete: Cascade, onUpdate: Cascade)

  @@unique([orderId, storefrontId, currencyCode])
  @@index([storefrontId, status, reservedUntil])
  @@index([status, reservedUntil])
  @@map("pickup_reservations")
}

model DeliveryVerification {
  id             String    @id @default(cuid())
  orderId        String    @unique
  storefrontId   String
  currencyCode   String    @db.VarChar(3)
  codeHash       String    @db.VarChar(128)
  expiresAt      DateTime
  failedAttempts Int       @default(0)
  lockedUntil    DateTime?
  feeCollectedAt DateTime?
  verifiedAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  order          Order     @relation(fields: [orderId, storefrontId, currencyCode], references: [id, storefrontId, currencyCode], onDelete: Cascade, onUpdate: Cascade)

  @@unique([orderId, storefrontId, currencyCode])
  @@index([storefrontId, expiresAt])
  @@index([verifiedAt])
  @@map("delivery_verifications")
}
'''

schema = (
    schema.rstrip() +
    addition +
    "\n"
)

path.write_text(
    schema,
    encoding="utf-8",
)

print(
    "PASS: Added order, payment, address, delivery and pickup models."
)
PYSCHEMA

run_quiet \
  "FORMAT UPDATED PRISMA SCHEMA" \
  npx prisma format

run_quiet \
  "VALIDATE UPDATED PRISMA SCHEMA" \
  npm run db:validate

echo
echo "=== VERIFY ORDER SCHEMA ==="

python - <<'PYVERIFYSCHEMA'
from pathlib import Path

schema = Path(
    "prisma/schema.prisma"
).read_text(
    encoding="utf-8",
)

normalized_schema = " ".join(
    schema.split()
)

required = [
    "enum OrderStatus {",
    "enum OrderFulfilmentMethod {",
    "enum OrderPaymentStatus {",
    "enum DeliveryFeeQuoteStatus {",
    "model Order {",
    "model OrderItem {",
    "model OrderAddress {",
    "model OrderPayment {",
    "model DeliveryFeeQuote {",
    "model PickupReservation {",
    "model DeliveryVerification {",
    "@@unique([id, storefrontId, currencyCode])",
    "@@unique([orderId, productVariantId])",
    "cart                  Cart",
    "orderItems OrderItem[]",
]

for value in required:
    normalized_value = " ".join(
        value.split()
    )

    if normalized_value not in normalized_schema:
        raise RuntimeError(
            f"Updated order schema is missing: {value}"
        )

print(
    "PASS: Order foundation models and composite isolation relations are present."
)
PYVERIFYSCHEMA

echo
echo "=== START POSTGRESQL ==="

docker start \
  sorvyra-postgres \
  >/dev/null 2>&1 ||
  true

DATABASE_READY=0

for attempt in $(seq 1 30)
do
  if docker exec \
    sorvyra-postgres \
    pg_isready \
    -U sorvyra \
    -d sorvyra_commerce \
    >/dev/null 2>&1
  then
    DATABASE_READY=1
    break
  fi

  sleep 1
done

if [ "$DATABASE_READY" -ne 1 ]; then
  echo "PostgreSQL did not become ready."
  exit 1
fi

echo "PASS: PostgreSQL is ready."

echo
echo "=== CREATE UNAPPLIED ORDER MIGRATION ==="

run_quiet \
  "CREATE ORDER FOUNDATION MIGRATION" \
  npx prisma migrate dev \
    --name checkout_order_foundation \
    --create-only

MIGRATION_DIR="$(
  find prisma/migrations \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -name '*_checkout_order_foundation' |
  sort |
  tail -n 1
)"

if [ -z "$MIGRATION_DIR" ]; then
  echo "The order migration directory was not created."
  exit 1
fi

MIGRATION_FILE="$MIGRATION_DIR/migration.sql"

test -f "$MIGRATION_FILE"

echo "Migration: $MIGRATION_FILE"

echo
echo "=== ADD POSTGRESQL ORDER INVARIANTS ==="

cat >> "$MIGRATION_FILE" <<'SQL'

-- SORVYRA order and checkout invariants.

ALTER TABLE "orders"
ADD CONSTRAINT "orders_order_number_format_check"
CHECK (
  "orderNumber" ~ '^[A-Z]{3}-[A-Z0-9]{10,32}$'
);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_money_nonnegative_check"
CHECK (
  "productSubtotal" >= 0
  AND "discountTotal" >= 0
  AND "productTotal" >= 0
  AND "deliveryFeeTotal" >= 0
  AND "grandTotal" >= 0
);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_product_total_check"
CHECK (
  "discountTotal" <= "productSubtotal"
  AND "productTotal" =
    "productSubtotal" - "discountTotal"
);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_grand_total_check"
CHECK (
  "grandTotal" =
    "productTotal" + "deliveryFeeTotal"
);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_quantity_positive_check"
CHECK (
  "quantity" > 0
);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_money_nonnegative_check"
CHECK (
  "unitPrice" >= 0
  AND (
    "compareAtUnitPrice" IS NULL
    OR "compareAtUnitPrice" >= 0
  )
  AND "lineSubtotal" >= 0
  AND "discountTotal" >= 0
  AND "lineTotal" >= 0
);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_totals_check"
CHECK (
  "lineSubtotal" =
    "unitPrice" * "quantity"
  AND "discountTotal" <= "lineSubtotal"
  AND "lineTotal" =
    "lineSubtotal" - "discountTotal"
);

ALTER TABLE "order_payments"
ADD CONSTRAINT "order_payments_amount_positive_check"
CHECK (
  "amount" > 0
);

ALTER TABLE "delivery_fee_quotes"
ADD CONSTRAINT "delivery_fee_quotes_amount_nonnegative_check"
CHECK (
  "amount" >= 0
);

ALTER TABLE "delivery_fee_quotes"
ADD CONSTRAINT "delivery_fee_quotes_expiry_check"
CHECK (
  "expiresAt" > "createdAt"
);

CREATE UNIQUE INDEX
"delivery_fee_quotes_one_pending_per_order"
ON "delivery_fee_quotes" ("orderId")
WHERE "status" = 'PENDING';

ALTER TABLE "pickup_reservations"
ADD CONSTRAINT "pickup_reservations_extension_count_check"
CHECK (
  "extensionCount" BETWEEN 0 AND 1
);

ALTER TABLE "pickup_reservations"
ADD CONSTRAINT "pickup_reservations_window_check"
CHECK (
  "originalReservedUntil" > "createdAt"
  AND "reservedUntil" >= "originalReservedUntil"
);

ALTER TABLE "delivery_verifications"
ADD CONSTRAINT "delivery_verifications_attempts_check"
CHECK (
  "failedAttempts" >= 0
);

ALTER TABLE "delivery_verifications"
ADD CONSTRAINT "delivery_verifications_expiry_check"
CHECK (
  "expiresAt" > "createdAt"
);

ALTER TABLE "delivery_verifications"
ADD CONSTRAINT "delivery_verifications_fee_before_verification_check"
CHECK (
  "verifiedAt" IS NULL
  OR "feeCollectedAt" IS NOT NULL
);
SQL

echo "PASS: Added monetary, isolation, quote, pickup and delivery constraints."

run_quiet \
  "APPLY ORDER FOUNDATION MIGRATION" \
  npx prisma migrate dev

run_quiet \
  "GENERATE PRISMA CLIENT" \
  npm run db:generate

run_quiet \
  "VERIFY MIGRATION STATUS" \
  npx prisma migrate status

echo
echo "=== CREATE ORDER FOUNDATION AUDIT ==="

cat > scripts/audit-order-foundation.ts <<'TSAUDIT'
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
TSAUDIT

echo
echo "=== REGISTER ORDER FOUNDATION AUDIT ==="

npm pkg set \
  "scripts.db:audit:orders=node --env-file=.env --conditions=react-server --import tsx scripts/audit-order-foundation.ts"

echo
echo "=== RUN ORDER FOUNDATION AUDIT ==="

if npm run db:audit:orders \
  2>&1 |
  tee -a "$DETAIL_LOG"
then
  echo "PASS: Order foundation audit"
else
  echo "FAIL: Order foundation audit"
  exit 1
fi

run_quiet \
  "CART FOUNDATION REGRESSION AUDIT" \
  npm run db:audit:cart

run_quiet \
  "CART SERVICE REGRESSION AUDIT" \
  npm run db:audit:cart-services

run_quiet \
  "CART API REGRESSION AUDIT" \
  npm run db:audit:cart-api

run_quiet \
  "CATALOGUE SERVICE REGRESSION AUDIT" \
  npm run db:audit:services

run_quiet \
  "CUSTOMER IDENTITY REGRESSION AUDIT" \
  npm run db:audit:identity

run_quiet \
  "AUTHENTICATION API REGRESSION AUDIT" \
  npm run db:audit:auth-api

run_quiet \
  "LIVE CATALOGUE REGRESSION AUDIT" \
  npm run db:audit:live-catalog

run_quiet \
  "LEGACY CART RETIREMENT REGRESSION AUDIT" \
  npm run db:audit:legacy-cart-retirement

run_quiet \
  "ESLINT" \
  npm run lint

run_quiet \
  "PRODUCTION BUILD" \
  npm run build

echo
echo "=== VERIFY ORDER AUDIT CLEANUP ==="

node --env-file=.env \
  --conditions=react-server \
  --import tsx <<'TSCLEAN'
import { prisma } from "./src/lib/prisma";

const users =
  await prisma.user.count({
    where: {
      normalizedEmail: {
        contains:
          "order-",
        endsWith:
          "@example.test",
      },
    },
  });

const products =
  await prisma.product.count({
    where: {
      name: {
        contains:
          "order foundation",
        mode:
          "insensitive",
      },
    },
  });

const orders =
  await prisma.order.count({
    where: {
      customerEmail: {
        endsWith:
          "@example.test",
      },
    },
  });

if (
  users !== 0 ||
  products !== 0 ||
  orders !== 0
) {
  throw new Error(
    [
      `${users} temporary user(s) remain.`,
      `${products} temporary product(s) remain.`,
      `${orders} temporary order(s) remain.`,
    ].join(" "),
  );
}

console.log(
  "PASS: No temporary order foundation records remain.",
);

await prisma.$disconnect();
TSCLEAN

echo
echo "=== VERIFY NO TEST SERVER REMAINS ==="

if ps -ef |
  grep -E \
    '[n]ode_modules/next/dist/bin/next start' \
  >/tmp/sorvyra-phase-2g-a-server-check.txt
then
  echo "A temporary Next.js server remains:"
  cat \
    /tmp/sorvyra-phase-2g-a-server-check.txt
  exit 1
fi

echo "PASS: No temporary test server remains."

echo
echo "=== FINAL REPOSITORY VALIDATION ==="

git diff --check
git status --short

echo
echo "Detailed validation log:"
echo "$DETAIL_LOG"

echo
echo "PHASE 2G-A CHECKOUT AND ORDER DATABASE FOUNDATION PASSED"
