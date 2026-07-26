#!/usr/bin/env bash

set -Eeuo pipefail

trap 'echo; echo "PHASE 2B FAILED on line $LINENO"; echo "Command: $BASH_COMMAND"' ERR

echo "=== VERIFY ENVIRONMENT ==="

test "$(git branch --show-current)" = "feat/commerce-foundation"
test -f .env
docker inspect sorvyra-postgres >/dev/null

echo "Branch: $(git branch --show-current)"
echo "PostgreSQL container found."

echo
echo "=== CREATE STOREFRONT DATABASE MODELS ==="

cat > prisma/schema.prisma <<'EOF'
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum StorefrontStatus {
  DRAFT
  ACTIVE
  PAUSED
  ARCHIVED
}

enum StorefrontKind {
  RETAIL
  SERVICE_HYBRID
}

model Currency {
  code          String       @id @db.VarChar(3)
  name          String       @unique
  symbol        String       @db.VarChar(12)
  decimalPlaces Int          @default(2)
  countries     Country[]
  storefronts   Storefront[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@map("currencies")
}

model Country {
  code             String       @id @db.VarChar(2)
  name             String       @unique
  phoneCallingCode String       @db.VarChar(8)
  defaultLocale    String       @db.VarChar(16)
  defaultTimezone  String       @db.VarChar(64)
  currencyCode     String       @db.VarChar(3)
  currency         Currency     @relation(fields: [currencyCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  storefronts      Storefront[]
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@index([currencyCode])
  @@map("countries")
}

model Storefront {
  id            String                        @id @default(cuid())
  key           String                        @unique @db.VarChar(50)
  code          String                        @unique @db.VarChar(3)
  slug          String                        @unique @db.VarChar(80)
  name          String
  shortName     String
  description   String
  route         String                        @unique
  locationLabel String
  locale        String                        @db.VarChar(16)
  timezone      String                        @db.VarChar(64)
  logoPath      String?
  coverImage    String?
  kind          StorefrontKind
  status        StorefrontStatus              @default(ACTIVE)
  countryCode   String                        @db.VarChar(2)
  currencyCode  String                        @db.VarChar(3)
  country       Country                       @relation(fields: [countryCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  currency      Currency                      @relation(fields: [currencyCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  contact       StorefrontContact?
  fulfilment    StorefrontFulfilmentSettings?
  createdAt     DateTime                      @default(now())
  updatedAt     DateTime                      @updatedAt

  @@index([countryCode, status])
  @@index([currencyCode])
  @@map("storefronts")
}

model StorefrontContact {
  id                       String     @id @default(cuid())
  storefrontId             String     @unique
  email                    String?    @db.VarChar(254)
  phone                    String?    @db.VarChar(32)
  secondaryPhone           String?    @db.VarChar(32)
  whatsapp                 String?    @db.VarChar(32)
  secondaryWhatsapp        String?    @db.VarChar(32)
  whatsappUrl              String?
  addressLine1             String?
  addressLine2             String?
  city                     String
  stateOrProvince          String?
  postalCode               String?    @db.VarChar(32)
  businessHours            String?
  whatsappAvailable24Hours Boolean    @default(false)
  storefront               Storefront @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  createdAt                DateTime   @default(now())
  updatedAt                DateTime   @updatedAt

  @@map("storefront_contacts")
}

model StorefrontFulfilmentSettings {
  id                                   String     @id @default(cuid())
  storefrontId                         String     @unique
  pickupEnabled                        Boolean    @default(false)
  localDeliveryEnabled                 Boolean    @default(false)
  countrywideDeliveryEnabled           Boolean    @default(false)
  sameDayDeliveryEnabled               Boolean    @default(false)
  installationEnabled                  Boolean    @default(false)
  serviceQuoteEnabled                  Boolean    @default(false)
  deliveryCoverage                     String?
  pickupReservationMinutes             Int        @default(240)
  nearClosePickupExtensionEnabled      Boolean    @default(true)
  nearClosePickupCutoffMinutes          Int        @default(660)
  managerPickupExtensionEnabled        Boolean    @default(true)
  deliveryFeeQuotedAfterProductPayment Boolean    @default(true)
  deliveryQuoteValidityHours           Int        @default(24)
  deliveryCodeRequired                 Boolean    @default(true)
  cashOnDeliveryProductValueEnabled    Boolean    @default(false)
  splitShipmentsEnabled                Boolean    @default(false)
  storefront                           Storefront @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  createdAt                            DateTime   @default(now())
  updatedAt                            DateTime   @updatedAt

  @@map("storefront_fulfilment_settings")
}
EOF

echo
echo "=== CONFIGURE EXPLICIT PRISMA SEEDING ==="

cat > prisma.config.ts <<'EOF'
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },

  datasource: {
    url: env("DIRECT_URL"),
  },
});
EOF

echo
echo "=== CREATE IDEMPOTENT SEED DATA ==="

cat > prisma/seed.ts <<'EOF'
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  StorefrontKind,
  StorefrontStatus,
} from "../src/generated/prisma/client";

const connectionString =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required for seeding.");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const currencies = [
  {
    code: "NGN",
    name: "Nigerian naira",
    symbol: "₦",
    decimalPlaces: 2,
  },
  {
    code: "QAR",
    name: "Qatari riyal",
    symbol: "QAR",
    decimalPlaces: 2,
  },
] as const;

const countries = [
  {
    code: "NG",
    name: "Nigeria",
    phoneCallingCode: "+234",
    defaultLocale: "en-NG",
    defaultTimezone: "Africa/Lagos",
    currencyCode: "NGN",
  },
  {
    code: "QA",
    name: "Qatar",
    phoneCallingCode: "+974",
    defaultLocale: "en-QA",
    defaultTimezone: "Asia/Qatar",
    currencyCode: "QAR",
  },
] as const;

const storefrontDefinitions = [
  {
    store: {
      key: "atiloszy",
      code: "ATI",
      slug: "atiloszy",
      name: "ATILOSZY Varieties Store",
      shortName: "ATILOSZY",
      description:
        "Shoes, household products, useful gadgets, gifts and everyday essentials selected for modern living.",
      route: "/ng/atiloszy",
      locationLabel: "Osogbo, Osun State",
      locale: "en-NG",
      timezone: "Africa/Lagos",
      logoPath: "/brand/atiloszy-logo-original.png",
      coverImage:
        "https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=1400&auto=format&fit=crop&q=88",
      kind: StorefrontKind.RETAIL,
      status: StorefrontStatus.ACTIVE,
      countryCode: "NG",
      currencyCode: "NGN",
    },
    contact: {
      email: "ademolaololade@gmail.com",
      phone: "07074417879",
      secondaryPhone: "09152476326",
      whatsapp: "07074417879",
      secondaryWhatsapp: null,
      whatsappUrl: "https://wa.me/2347074417879",
      addressLine1:
        "Shop 1, Akilog Complex, opposite Al-Mitiqeey Mosque",
      addressLine2:
        "Ire Akari, Oke Ijetu, Ilesa Garage",
      city: "Osogbo",
      stateOrProvince: "Osun State",
      postalCode: null,
      businessHours: "Every day, 10:00 AM–6:00 PM",
      whatsappAvailable24Hours: true,
    },
    fulfilment: {
      pickupEnabled: true,
      localDeliveryEnabled: true,
      countrywideDeliveryEnabled: true,
      sameDayDeliveryEnabled: true,
      installationEnabled: false,
      serviceQuoteEnabled: false,
      deliveryCoverage:
        "Same-day delivery in Osogbo where available and nationwide delivery across Nigeria.",
      pickupReservationMinutes: 240,
      nearClosePickupExtensionEnabled: true,
      nearClosePickupCutoffMinutes: 660,
      managerPickupExtensionEnabled: true,
      deliveryFeeQuotedAfterProductPayment: true,
      deliveryQuoteValidityHours: 24,
      deliveryCodeRequired: true,
      cashOnDeliveryProductValueEnabled: false,
      splitShipmentsEnabled: false,
    },
  },
  {
    store: {
      key: "zee-beauty-fashion",
      code: "ZBF",
      slug: "zee-beauty-fashion",
      name: "ZEE Beauty & Fashion World",
      shortName: "ZEE Beauty & Fashion",
      description:
        "Beauty, fashion, personal care, household items and daily essentials in one welcoming store.",
      route: "/ng/zee-beauty-fashion",
      locationLabel: "Osogbo, Osun State",
      locale: "en-NG",
      timezone: "Africa/Lagos",
      logoPath: null,
      coverImage:
        "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1400&auto=format&fit=crop&q=88",
      kind: StorefrontKind.RETAIL,
      status: StorefrontStatus.ACTIVE,
      countryCode: "NG",
      currencyCode: "NGN",
    },
    contact: {
      email: "ademoladasola0@gmail.com",
      phone: "09159894953",
      secondaryPhone: null,
      whatsapp: "09159894953",
      secondaryWhatsapp: "07061007983",
      whatsappUrl: "https://wa.me/2349159894953",
      addressLine1: "Okinni, Olaoluwa Estate",
      addressLine2: null,
      city: "Osogbo",
      stateOrProvince: "Osun State",
      postalCode: null,
      businessHours: "Every day, 10:00 AM–6:00 PM",
      whatsappAvailable24Hours: true,
    },
    fulfilment: {
      pickupEnabled: true,
      localDeliveryEnabled: true,
      countrywideDeliveryEnabled: true,
      sameDayDeliveryEnabled: true,
      installationEnabled: false,
      serviceQuoteEnabled: false,
      deliveryCoverage:
        "Same-day delivery in Osogbo where available and nationwide delivery across Nigeria.",
      pickupReservationMinutes: 240,
      nearClosePickupExtensionEnabled: true,
      nearClosePickupCutoffMinutes: 660,
      managerPickupExtensionEnabled: true,
      deliveryFeeQuotedAfterProductPayment: true,
      deliveryQuoteValidityHours: 24,
      deliveryCodeRequired: true,
      cashOnDeliveryProductValueEnabled: false,
      splitShipmentsEnabled: false,
    },
  },
  {
    store: {
      key: "denald",
      code: "DEN",
      slug: "denald",
      name: "DENALD Solar | CCTV | Computer",
      shortName: "DENALD",
      description:
        "Solar products, CCTV systems, computer solutions and professional installation services.",
      route: "/ng/denald",
      locationLabel: "Ibadan, Oyo State",
      locale: "en-NG",
      timezone: "Africa/Lagos",
      logoPath: "/brand/denald-logo-clean.png",
      coverImage:
        "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=1400&auto=format&fit=crop&q=88",
      kind: StorefrontKind.SERVICE_HYBRID,
      status: StorefrontStatus.ACTIVE,
      countryCode: "NG",
      currencyCode: "NGN",
    },
    contact: {
      email: "ademolaibraheem457@gmail.com",
      phone: "07061812252",
      secondaryPhone: null,
      whatsapp: "08186710526",
      secondaryWhatsapp: null,
      whatsappUrl: "https://wa.me/2348186710526",
      addressLine1: null,
      addressLine2: null,
      city: "Ibadan",
      stateOrProvince: "Oyo State",
      postalCode: null,
      businessHours:
        "Service appointments and WhatsApp enquiries available",
      whatsappAvailable24Hours: true,
    },
    fulfilment: {
      pickupEnabled: true,
      localDeliveryEnabled: true,
      countrywideDeliveryEnabled: true,
      sameDayDeliveryEnabled: false,
      installationEnabled: true,
      serviceQuoteEnabled: true,
      deliveryCoverage:
        "Oyo State service coverage with nationwide product delivery where available.",
      pickupReservationMinutes: 240,
      nearClosePickupExtensionEnabled: true,
      nearClosePickupCutoffMinutes: 660,
      managerPickupExtensionEnabled: true,
      deliveryFeeQuotedAfterProductPayment: true,
      deliveryQuoteValidityHours: 24,
      deliveryCodeRequired: true,
      cashOnDeliveryProductValueEnabled: false,
      splitShipmentsEnabled: false,
    },
  },
  {
    store: {
      key: "zee-comfort-hub",
      code: "ZCH",
      slug: "zee-comfort-hub",
      name: "Zee COMFORT HUB",
      shortName: "Zee COMFORT HUB",
      description:
        "Comfort-focused underwear, sleepwear, leggings, loungewear and everyday essentials for women and men.",
      route: "/qa/zee-comfort-hub",
      locationLabel: "Fareej Abdul Aziz, Doha",
      locale: "en-QA",
      timezone: "Asia/Qatar",
      logoPath: "/brand/zee-comfort-hub-logo.png",
      coverImage:
        "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1400&auto=format&fit=crop&q=88",
      kind: StorefrontKind.RETAIL,
      status: StorefrontStatus.ACTIVE,
      countryCode: "QA",
      currencyCode: "QAR",
    },
    contact: {
      email: "ademolazynab781@gmail.com",
      phone: "+974 3097 5465",
      secondaryPhone: null,
      whatsapp: "+974 3097 5465",
      secondaryWhatsapp: null,
      whatsappUrl: "https://wa.me/97430975465",
      addressLine1: "Fareej Abdul Aziz",
      addressLine2: null,
      city: "Doha",
      stateOrProvince: null,
      postalCode: null,
      businessHours: "Every day, 10:00 AM–6:00 PM",
      whatsappAvailable24Hours: true,
    },
    fulfilment: {
      pickupEnabled: true,
      localDeliveryEnabled: true,
      countrywideDeliveryEnabled: true,
      sameDayDeliveryEnabled: false,
      installationEnabled: false,
      serviceQuoteEnabled: false,
      deliveryCoverage:
        "Pickup in Doha and delivery throughout Qatar.",
      pickupReservationMinutes: 240,
      nearClosePickupExtensionEnabled: true,
      nearClosePickupCutoffMinutes: 660,
      managerPickupExtensionEnabled: true,
      deliveryFeeQuotedAfterProductPayment: true,
      deliveryQuoteValidityHours: 24,
      deliveryCodeRequired: true,
      cashOnDeliveryProductValueEnabled: false,
      splitShipmentsEnabled: false,
    },
  },
] as const;

async function seed() {
  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: {
        code: currency.code,
      },
      update: currency,
      create: currency,
    });
  }

  for (const country of countries) {
    await prisma.country.upsert({
      where: {
        code: country.code,
      },
      update: country,
      create: country,
    });
  }

  for (const definition of storefrontDefinitions) {
    const storefront = await prisma.storefront.upsert({
      where: {
        key: definition.store.key,
      },
      update: definition.store,
      create: definition.store,
    });

    await prisma.storefrontContact.upsert({
      where: {
        storefrontId: storefront.id,
      },
      update: definition.contact,
      create: {
        storefrontId: storefront.id,
        ...definition.contact,
      },
    });

    await prisma.storefrontFulfilmentSettings.upsert({
      where: {
        storefrontId: storefront.id,
      },
      update: definition.fulfilment,
      create: {
        storefrontId: storefront.id,
        ...definition.fulfilment,
      },
    });
  }
}

seed()
  .then(async () => {
    console.log("SORVYRA storefront foundation seeded successfully.");
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Storefront seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
EOF

echo
echo "=== CREATE FOUNDATION AUDIT ==="

cat > scripts/audit-storefront-foundation.ts <<'EOF'
import "dotenv/config";

import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required.");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function audit() {
  const currencies = await prisma.currency.findMany({
    orderBy: {
      code: "asc",
    },
  });

  const countries = await prisma.country.findMany({
    include: {
      currency: true,
    },
    orderBy: {
      code: "asc",
    },
  });

  const storefronts = await prisma.storefront.findMany({
    include: {
      country: true,
      currency: true,
      contact: true,
      fulfilment: true,
    },
    orderBy: {
      code: "asc",
    },
  });

  assert.equal(
    currencies.length,
    2,
    "Expected exactly two currencies.",
  );

  assert.equal(
    countries.length,
    2,
    "Expected exactly two countries.",
  );

  assert.equal(
    storefronts.length,
    4,
    "Expected exactly four storefronts.",
  );

  const expectedCodes = new Set([
    "ATI",
    "ZBF",
    "DEN",
    "ZCH",
  ]);

  const discoveredCodes = new Set(
    storefronts.map((storefront) => storefront.code),
  );

  assert.deepEqual(
    discoveredCodes,
    expectedCodes,
    "Storefront codes do not match the approved architecture.",
  );

  for (const storefront of storefronts) {
    assert.ok(
      storefront.contact,
      `${storefront.code} is missing contact settings.`,
    );

    assert.ok(
      storefront.fulfilment,
      `${storefront.code} is missing fulfilment settings.`,
    );

    assert.equal(
      storefront.country.currencyCode,
      storefront.currencyCode,
      `${storefront.code} currency does not match its country.`,
    );
  }

  console.log("=== STOREFRONT FOUNDATION AUDIT ===");
  console.log(`Currencies: ${currencies.length}`);
  console.log(`Countries: ${countries.length}`);
  console.log(`Storefronts: ${storefronts.length}`);
  console.log("");

  for (const storefront of storefronts) {
    console.log(
      [
        storefront.code,
        storefront.name,
        storefront.countryCode,
        storefront.currencyCode,
        storefront.route,
        storefront.status,
      ].join(" | "),
    );
  }

  console.log("");
  console.log("PASS: Storefront foundation audit completed.");
}

audit()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("FAIL: Storefront foundation audit failed.");
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
EOF

echo
echo "=== ADD DATABASE COMMANDS ==="

npm pkg set \
  scripts.db:seed="prisma db seed" \
  scripts.db:audit="tsx scripts/audit-storefront-foundation.ts"

echo
echo "=== FORMAT AND VALIDATE SCHEMA ==="

npx prisma format
npm run db:validate

echo
echo "=== CREATE AND APPLY MIGRATION ==="

npx prisma migrate dev \
  --name storefront_foundation

echo
echo "=== GENERATE CLIENT ==="

npm run db:generate

echo
echo "=== SEED APPROVED STOREFRONTS ==="

npm run db:seed

echo
echo "=== AUDIT SEEDED DATA ==="

npm run db:audit

echo
echo "=== APPLICATION VALIDATION ==="

npm run lint
npm run build

echo
echo "=== DATABASE TABLES ==="

docker exec sorvyra-postgres \
  psql \
  -U sorvyra \
  -d sorvyra_commerce \
  -c "\dt"

echo
echo "=== PHASE 2B CHANGES ==="

git status --short

echo
echo "PHASE 2B SETUP COMPLETED"
