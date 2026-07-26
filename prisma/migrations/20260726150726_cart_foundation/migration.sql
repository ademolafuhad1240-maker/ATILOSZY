/*
  Warnings:

  - A unique constraint covering the columns `[id,storefrontProductId]` on the table `product_variants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,productVariantId,currencyCode]` on the table `storefront_prices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,storefrontId]` on the table `storefront_products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,currencyCode]` on the table `storefronts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED', 'EXPIRED');

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "storefrontProductId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "storefrontPriceId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "compareAtUnitPrice" DECIMAL(18,2),
    "productNameSnapshot" TEXT NOT NULL,
    "variantTitleSnapshot" TEXT NOT NULL,
    "skuSnapshot" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carts_storefrontId_userId_status_idx" ON "carts"("storefrontId", "userId", "status");

-- CreateIndex
CREATE INDEX "carts_userId_createdAt_idx" ON "carts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "carts_status_expiresAt_idx" ON "carts"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "carts_id_storefrontId_currencyCode_key" ON "carts"("id", "storefrontId", "currencyCode");

-- CreateIndex
CREATE INDEX "cart_items_cartId_createdAt_idx" ON "cart_items"("cartId", "createdAt");

-- CreateIndex
CREATE INDEX "cart_items_storefrontId_storefrontProductId_idx" ON "cart_items"("storefrontId", "storefrontProductId");

-- CreateIndex
CREATE INDEX "cart_items_productVariantId_idx" ON "cart_items"("productVariantId");

-- CreateIndex
CREATE INDEX "cart_items_storefrontPriceId_idx" ON "cart_items"("storefrontPriceId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_productVariantId_key" ON "cart_items"("cartId", "productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_id_storefrontProductId_key" ON "product_variants"("id", "storefrontProductId");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_prices_id_productVariantId_currencyCode_key" ON "storefront_prices"("id", "productVariantId", "currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_products_id_storefrontId_key" ON "storefront_products"("id", "storefrontId");

-- CreateIndex
CREATE UNIQUE INDEX "storefronts_id_currencyCode_key" ON "storefronts"("id", "currencyCode");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_storefrontId_currencyCode_fkey" FOREIGN KEY ("storefrontId", "currencyCode") REFERENCES "storefronts"("id", "currencyCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_storefrontId_fkey" FOREIGN KEY ("userId", "storefrontId") REFERENCES "users"("id", "storefrontId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_storefrontId_currencyCode_fkey" FOREIGN KEY ("cartId", "storefrontId", "currencyCode") REFERENCES "carts"("id", "storefrontId", "currencyCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_storefrontProductId_storefrontId_fkey" FOREIGN KEY ("storefrontProductId", "storefrontId") REFERENCES "storefront_products"("id", "storefrontId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productVariantId_storefrontProductId_fkey" FOREIGN KEY ("productVariantId", "storefrontProductId") REFERENCES "product_variants"("id", "storefrontProductId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_storefrontPriceId_productVariantId_currencyCode_fkey" FOREIGN KEY ("storefrontPriceId", "productVariantId", "currencyCode") REFERENCES "storefront_prices"("id", "productVariantId", "currencyCode") ON DELETE RESTRICT ON UPDATE CASCADE;

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
