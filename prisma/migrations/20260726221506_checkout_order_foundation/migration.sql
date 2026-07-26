-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderFulfilmentMethod" AS ENUM ('PICKUP', 'DELIVERY', 'INSTALLATION', 'DELIVERY_AND_INSTALLATION');

-- CreateEnum
CREATE TYPE "OrderFulfilmentStatus" AS ENUM ('NOT_STARTED', 'AWAITING_DELIVERY_QUOTE', 'DELIVERY_QUOTED', 'SCHEDULED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'INSTALLATION_IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderPaymentPurpose" AS ENUM ('PRODUCT', 'DELIVERY_FEE', 'REFUND');

-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'USSD', 'PAY_BY_BANK', 'CASH', 'PROVIDER_WALLET', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderAddressType" AS ENUM ('DELIVERY', 'BILLING', 'INSTALLATION');

-- CreateEnum
CREATE TYPE "DeliveryFeeQuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'PAID');

-- CreateEnum
CREATE TYPE "PickupReservationStatus" AS ENUM ('ACTIVE', 'EXTENDED', 'COLLECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" VARCHAR(40) NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "cartId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "fulfilmentMethod" "OrderFulfilmentMethod" NOT NULL,
    "fulfilmentStatus" "OrderFulfilmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "productPaymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryPaymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "productSubtotal" DECIMAL(18,2) NOT NULL,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "productTotal" DECIMAL(18,2) NOT NULL,
    "deliveryFeeTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,2) NOT NULL,
    "customerName" VARCHAR(160) NOT NULL,
    "customerEmail" VARCHAR(320) NOT NULL,
    "customerPhone" VARCHAR(32) NOT NULL,
    "customerNote" TEXT,
    "cancellationReason" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "storefrontProductId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "storefrontPriceId" TEXT NOT NULL,
    "productName" VARCHAR(240) NOT NULL,
    "variantTitle" VARCHAR(240) NOT NULL,
    "sku" VARCHAR(120) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "compareAtUnitPrice" DECIMAL(18,2),
    "lineSubtotal" DECIMAL(18,2) NOT NULL,
    "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_addresses" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "type" "OrderAddressType" NOT NULL,
    "recipientName" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "email" VARCHAR(320),
    "countryCode" VARCHAR(2) NOT NULL,
    "state" TEXT,
    "city" TEXT NOT NULL,
    "postalCode" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "deliveryNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "purpose" "OrderPaymentPurpose" NOT NULL,
    "method" "OrderPaymentMethod",
    "status" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(18,2) NOT NULL,
    "provider" VARCHAR(80),
    "providerReference" VARCHAR(191),
    "idempotencyKey" VARCHAR(191),
    "failureCode" VARCHAR(120),
    "failureMessage" TEXT,
    "providerMetadata" JSONB,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_fee_quotes" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "DeliveryFeeQuoteStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_fee_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_reservations" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "status" "PickupReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "originalReservedUntil" TIMESTAMP(3) NOT NULL,
    "reservedUntil" TIMESTAMP(3) NOT NULL,
    "extensionCount" INTEGER NOT NULL DEFAULT 0,
    "extendedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_verifications" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "codeHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "feeCollectedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_cartId_key" ON "orders"("cartId");

-- CreateIndex
CREATE INDEX "orders_storefrontId_createdAt_idx" ON "orders"("storefrontId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_storefrontId_status_createdAt_idx" ON "orders"("storefrontId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_fulfilmentStatus_idx" ON "orders"("status", "fulfilmentStatus");

-- CreateIndex
CREATE INDEX "orders_productPaymentStatus_deliveryPaymentStatus_idx" ON "orders"("productPaymentStatus", "deliveryPaymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "orders_id_storefrontId_currencyCode_key" ON "orders"("id", "storefrontId", "currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "orders_cartId_storefrontId_currencyCode_key" ON "orders"("cartId", "storefrontId", "currencyCode");

-- CreateIndex
CREATE INDEX "order_items_orderId_createdAt_idx" ON "order_items"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_storefrontId_storefrontProductId_idx" ON "order_items"("storefrontId", "storefrontProductId");

-- CreateIndex
CREATE INDEX "order_items_productVariantId_idx" ON "order_items"("productVariantId");

-- CreateIndex
CREATE INDEX "order_items_storefrontPriceId_idx" ON "order_items"("storefrontPriceId");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_orderId_productVariantId_key" ON "order_items"("orderId", "productVariantId");

-- CreateIndex
CREATE INDEX "order_addresses_storefrontId_countryCode_city_idx" ON "order_addresses"("storefrontId", "countryCode", "city");

-- CreateIndex
CREATE UNIQUE INDEX "order_addresses_orderId_type_key" ON "order_addresses"("orderId", "type");

-- CreateIndex
CREATE INDEX "order_payments_orderId_purpose_status_idx" ON "order_payments"("orderId", "purpose", "status");

-- CreateIndex
CREATE INDEX "order_payments_storefrontId_createdAt_idx" ON "order_payments"("storefrontId", "createdAt");

-- CreateIndex
CREATE INDEX "order_payments_status_createdAt_idx" ON "order_payments"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_storefrontId_idempotencyKey_key" ON "order_payments"("storefrontId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_provider_providerReference_key" ON "order_payments"("provider", "providerReference");

-- CreateIndex
CREATE INDEX "delivery_fee_quotes_orderId_status_createdAt_idx" ON "delivery_fee_quotes"("orderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "delivery_fee_quotes_status_expiresAt_idx" ON "delivery_fee_quotes"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_reservations_orderId_key" ON "pickup_reservations"("orderId");

-- CreateIndex
CREATE INDEX "pickup_reservations_storefrontId_status_reservedUntil_idx" ON "pickup_reservations"("storefrontId", "status", "reservedUntil");

-- CreateIndex
CREATE INDEX "pickup_reservations_status_reservedUntil_idx" ON "pickup_reservations"("status", "reservedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_reservations_orderId_storefrontId_currencyCode_key" ON "pickup_reservations"("orderId", "storefrontId", "currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_verifications_orderId_key" ON "delivery_verifications"("orderId");

-- CreateIndex
CREATE INDEX "delivery_verifications_storefrontId_expiresAt_idx" ON "delivery_verifications"("storefrontId", "expiresAt");

-- CreateIndex
CREATE INDEX "delivery_verifications_verifiedAt_idx" ON "delivery_verifications"("verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_verifications_orderId_storefrontId_currencyCode_key" ON "delivery_verifications"("orderId", "storefrontId", "currencyCode");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_storefrontId_currencyCode_fkey" FOREIGN KEY ("storefrontId", "currencyCode") REFERENCES "storefronts"("id", "currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_storefrontId_fkey" FOREIGN KEY ("userId", "storefrontId") REFERENCES "users"("id", "storefrontId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cartId_storefrontId_currencyCode_fkey" FOREIGN KEY ("cartId", "storefrontId", "currencyCode") REFERENCES "carts"("id", "storefrontId", "currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_storefrontId_currencyCode_fkey" FOREIGN KEY ("orderId", "storefrontId", "currencyCode") REFERENCES "orders"("id", "storefrontId", "currencyCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_storefrontProductId_storefrontId_fkey" FOREIGN KEY ("storefrontProductId", "storefrontId") REFERENCES "storefront_products"("id", "storefrontId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productVariantId_storefrontProductId_fkey" FOREIGN KEY ("productVariantId", "storefrontProductId") REFERENCES "product_variants"("id", "storefrontProductId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_storefrontPriceId_productVariantId_currencyCod_fkey" FOREIGN KEY ("storefrontPriceId", "productVariantId", "currencyCode") REFERENCES "storefront_prices"("id", "productVariantId", "currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_addresses" ADD CONSTRAINT "order_addresses_orderId_storefrontId_currencyCode_fkey" FOREIGN KEY ("orderId", "storefrontId", "currencyCode") REFERENCES "orders"("id", "storefrontId", "currencyCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_orderId_storefrontId_currencyCode_fkey" FOREIGN KEY ("orderId", "storefrontId", "currencyCode") REFERENCES "orders"("id", "storefrontId", "currencyCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_fee_quotes" ADD CONSTRAINT "delivery_fee_quotes_orderId_storefrontId_currencyCode_fkey" FOREIGN KEY ("orderId", "storefrontId", "currencyCode") REFERENCES "orders"("id", "storefrontId", "currencyCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_reservations" ADD CONSTRAINT "pickup_reservations_orderId_storefrontId_currencyCode_fkey" FOREIGN KEY ("orderId", "storefrontId", "currencyCode") REFERENCES "orders"("id", "storefrontId", "currencyCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_verifications" ADD CONSTRAINT "delivery_verifications_orderId_storefrontId_currencyCode_fkey" FOREIGN KEY ("orderId", "storefrontId", "currencyCode") REFERENCES "orders"("id", "storefrontId", "currencyCode") ON DELETE CASCADE ON UPDATE CASCADE;

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
