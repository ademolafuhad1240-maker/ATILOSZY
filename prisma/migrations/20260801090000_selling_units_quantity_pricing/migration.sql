ALTER TABLE "product_variants"
ADD COLUMN "sellingUnitLabel" VARCHAR(80) NOT NULL DEFAULT 'item',
ADD COLUMN "unitsPerSellingUnit" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "cart_items"
ADD COLUMN "sellingUnitLabelSnapshot" VARCHAR(80) NOT NULL DEFAULT 'item',
ADD COLUMN "unitsPerSellingUnitSnapshot" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "baseUnitPrice" DECIMAL(18,2),
ADD COLUMN "quantityDiscountMinimumSnapshot" INTEGER;

ALTER TABLE "order_items"
ADD COLUMN "sellingUnitLabel" VARCHAR(80) NOT NULL DEFAULT 'item',
ADD COLUMN "unitsPerSellingUnit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "quantityDiscountMinimum" INTEGER;

CREATE TABLE "storefront_price_tiers" (
  "id" TEXT NOT NULL,
  "storefrontPriceId" TEXT NOT NULL,
  "minimumQuantity" INTEGER NOT NULL,
  "unitAmount" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "storefront_price_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storefront_price_tiers_storefrontPriceId_minimumQuantity_key"
ON "storefront_price_tiers"("storefrontPriceId", "minimumQuantity");

CREATE INDEX "storefront_price_tiers_storefrontPriceId_minimumQuantity_idx"
ON "storefront_price_tiers"("storefrontPriceId", "minimumQuantity");

ALTER TABLE "storefront_price_tiers"
ADD CONSTRAINT "storefront_price_tiers_storefrontPriceId_fkey"
FOREIGN KEY ("storefrontPriceId") REFERENCES "storefront_prices"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_variants"
ADD CONSTRAINT "product_variants_unitsPerSellingUnit_check"
CHECK ("unitsPerSellingUnit" >= 1);

ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_unitsPerSellingUnitSnapshot_check"
CHECK ("unitsPerSellingUnitSnapshot" >= 1);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_unitsPerSellingUnit_check"
CHECK ("unitsPerSellingUnit" >= 1);

ALTER TABLE "storefront_price_tiers"
ADD CONSTRAINT "storefront_price_tiers_minimumQuantity_check"
CHECK ("minimumQuantity" >= 2);

ALTER TABLE "storefront_price_tiers"
ADD CONSTRAINT "storefront_price_tiers_unitAmount_check"
CHECK ("unitAmount" > 0);
