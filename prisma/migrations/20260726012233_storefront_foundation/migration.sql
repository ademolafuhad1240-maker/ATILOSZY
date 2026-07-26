-- CreateEnum
CREATE TYPE "StorefrontStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StorefrontKind" AS ENUM ('RETAIL', 'SERVICE_HYBRID');

-- CreateTable
CREATE TABLE "currencies" (
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" VARCHAR(12) NOT NULL,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "countries" (
    "code" VARCHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "phoneCallingCode" VARCHAR(8) NOT NULL,
    "defaultLocale" VARCHAR(16) NOT NULL,
    "defaultTimezone" VARCHAR(64) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "storefronts" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(50) NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "locationLabel" TEXT NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "logoPath" TEXT,
    "coverImage" TEXT,
    "kind" "StorefrontKind" NOT NULL,
    "status" "StorefrontStatus" NOT NULL DEFAULT 'ACTIVE',
    "countryCode" VARCHAR(2) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefronts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_contacts" (
    "id" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(32),
    "secondaryPhone" VARCHAR(32),
    "whatsapp" VARCHAR(32),
    "secondaryWhatsapp" VARCHAR(32),
    "whatsappUrl" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "stateOrProvince" TEXT,
    "postalCode" VARCHAR(32),
    "businessHours" TEXT,
    "whatsappAvailable24Hours" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_fulfilment_settings" (
    "id" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "localDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "countrywideDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sameDayDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "installationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serviceQuoteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deliveryCoverage" TEXT,
    "pickupReservationMinutes" INTEGER NOT NULL DEFAULT 240,
    "nearClosePickupExtensionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nearClosePickupCutoffMinutes" INTEGER NOT NULL DEFAULT 660,
    "managerPickupExtensionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryFeeQuotedAfterProductPayment" BOOLEAN NOT NULL DEFAULT true,
    "deliveryQuoteValidityHours" INTEGER NOT NULL DEFAULT 24,
    "deliveryCodeRequired" BOOLEAN NOT NULL DEFAULT true,
    "cashOnDeliveryProductValueEnabled" BOOLEAN NOT NULL DEFAULT false,
    "splitShipmentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_fulfilment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_name_key" ON "currencies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE INDEX "countries_currencyCode_idx" ON "countries"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "storefronts_key_key" ON "storefronts"("key");

-- CreateIndex
CREATE UNIQUE INDEX "storefronts_code_key" ON "storefronts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "storefronts_slug_key" ON "storefronts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "storefronts_route_key" ON "storefronts"("route");

-- CreateIndex
CREATE INDEX "storefronts_countryCode_status_idx" ON "storefronts"("countryCode", "status");

-- CreateIndex
CREATE INDEX "storefronts_currencyCode_idx" ON "storefronts"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_contacts_storefrontId_key" ON "storefront_contacts"("storefrontId");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_fulfilment_settings_storefrontId_key" ON "storefront_fulfilment_settings"("storefrontId");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefronts" ADD CONSTRAINT "storefronts_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_contacts" ADD CONSTRAINT "storefront_contacts_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_fulfilment_settings" ADD CONSTRAINT "storefront_fulfilment_settings_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
