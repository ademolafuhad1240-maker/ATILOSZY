#!/usr/bin/env bash

set -Eeuo pipefail

trap 'echo; echo "PHASE 2C FAILED on line $LINENO"; echo "Command: $BASH_COMMAND"' ERR

echo "=== VERIFY ENVIRONMENT ==="

test "$(git branch --show-current)" = "feat/commerce-foundation"
test -f .env
docker inspect sorvyra-postgres >/dev/null

echo "Branch: $(git branch --show-current)"
echo "PostgreSQL container found."

echo
echo "=== CREATE CATALOGUE DATABASE MODELS ==="

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

enum CategoryStatus {
  ACTIVE
  HIDDEN
  ARCHIVED
}

enum ProductStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

enum StorefrontProductStatus {
  DRAFT
  ACTIVE
  HIDDEN
  ARCHIVED
}

enum ProductVariantStatus {
  ACTIVE
  INACTIVE
  DISCONTINUED
}

enum PriceType {
  REGULAR
  SALE
}

enum StockMovementType {
  OPENING_STOCK
  PURCHASE
  ADJUSTMENT
  RESERVATION
  RELEASE
  SALE
  RETURN
  DAMAGE
}

model Currency {
  code          String            @id @db.VarChar(3)
  name          String            @unique
  symbol        String            @db.VarChar(12)
  decimalPlaces Int               @default(2)
  countries     Country[]
  storefronts   Storefront[]
  prices        StorefrontPrice[]
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

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
  id                String                        @id @default(cuid())
  key               String                        @unique @db.VarChar(50)
  code              String                        @unique @db.VarChar(3)
  slug              String                        @unique @db.VarChar(80)
  name              String
  shortName         String
  description       String
  route             String                        @unique
  locationLabel     String
  locale            String                        @db.VarChar(16)
  timezone          String                        @db.VarChar(64)
  logoPath          String?
  coverImage        String?
  kind              StorefrontKind
  status            StorefrontStatus              @default(ACTIVE)
  countryCode       String                        @db.VarChar(2)
  currencyCode      String                        @db.VarChar(3)
  country           Country                       @relation(fields: [countryCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  currency          Currency                      @relation(fields: [currencyCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  contact           StorefrontContact?
  fulfilment        StorefrontFulfilmentSettings?
  categories        Category[]
  catalogueProducts StorefrontProduct[]
  inventories       Inventory[]
  createdAt         DateTime                      @default(now())
  updatedAt         DateTime                      @updatedAt

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

model Category {
  id                String                  @id @default(cuid())
  storefrontId      String
  parentId          String?
  slug              String                  @db.VarChar(100)
  name              String
  description       String?
  imageUrl          String?
  position          Int                     @default(0)
  status            CategoryStatus          @default(ACTIVE)
  storefront        Storefront              @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  parent            Category?               @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  children          Category[]              @relation("CategoryHierarchy")
  storefrontProducts StorefrontProduct[]
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt

  @@unique([storefrontId, slug])
  @@index([storefrontId, status, position])
  @@index([parentId])
  @@map("categories")
}

model Product {
  id                String              @id @default(cuid())
  slug              String              @unique @db.VarChar(140)
  name              String
  shortDescription  String?
  description       String?
  brand             String?
  status            ProductStatus       @default(DRAFT)
  storefrontProducts StorefrontProduct[]
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@index([status])
  @@map("products")
}

model StorefrontProduct {
  id             String                  @id @default(cuid())
  storefrontId   String
  productId      String
  categoryId     String?
  slug           String                  @db.VarChar(140)
  status         StorefrontProductStatus @default(DRAFT)
  isFeatured     Boolean                 @default(false)
  isDemo         Boolean                 @default(false)
  sortOrder      Int                     @default(0)
  maxPerOrder    Int?
  publishedAt    DateTime?
  availableFrom  DateTime?
  availableUntil DateTime?
  storefront     Storefront              @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  product        Product                 @relation(fields: [productId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  category       Category?               @relation(fields: [categoryId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  variants       ProductVariant[]
  images         ProductImage[]
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  @@unique([storefrontId, productId])
  @@unique([storefrontId, slug])
  @@index([storefrontId, status, isFeatured])
  @@index([categoryId])
  @@index([productId])
  @@map("storefront_products")
}

model ProductVariant {
  id                 String               @id @default(cuid())
  storefrontProductId String
  sku                String               @unique @db.VarChar(80)
  barcode            String?              @unique @db.VarChar(80)
  title              String
  status             ProductVariantStatus @default(ACTIVE)
  isDefault          Boolean              @default(false)
  weightGrams        Int?
  lengthMm           Int?
  widthMm            Int?
  heightMm           Int?
  storefrontProduct  StorefrontProduct    @relation(fields: [storefrontProductId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  options            VariantOption[]
  images             ProductImage[]
  prices             StorefrontPrice[]
  inventory          Inventory?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  @@index([storefrontProductId, status])
  @@map("product_variants")
}

model VariantOption {
  id               String         @id @default(cuid())
  productVariantId String
  name             String         @db.VarChar(80)
  value            String         @db.VarChar(120)
  position         Int            @default(0)
  productVariant   ProductVariant @relation(fields: [productVariantId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@unique([productVariantId, name])
  @@index([productVariantId, position])
  @@map("variant_options")
}

model ProductImage {
  id                 String            @id @default(cuid())
  storefrontProductId String
  variantId           String?
  url                 String
  altText             String?
  position            Int               @default(0)
  isPrimary           Boolean           @default(false)
  storefrontProduct   StorefrontProduct @relation(fields: [storefrontProductId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  variant             ProductVariant?   @relation(fields: [variantId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([storefrontProductId, position])
  @@index([variantId])
  @@map("product_images")
}

model StorefrontPrice {
  id               String         @id @default(cuid())
  productVariantId String
  currencyCode     String         @db.VarChar(3)
  type             PriceType      @default(REGULAR)
  amount           Decimal        @db.Decimal(18, 2)
  compareAtAmount  Decimal?       @db.Decimal(18, 2)
  costAmount       Decimal?       @db.Decimal(18, 2)
  startsAt         DateTime?
  endsAt           DateTime?
  isActive         Boolean        @default(true)
  productVariant   ProductVariant @relation(fields: [productVariantId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  currency         Currency       @relation(fields: [currencyCode], references: [code], onDelete: Restrict, onUpdate: Cascade)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([productVariantId, isActive, startsAt, endsAt])
  @@index([currencyCode])
  @@map("storefront_prices")
}

model Inventory {
  id                 String          @id @default(cuid())
  storefrontId       String
  productVariantId   String          @unique
  quantityOnHand     Int             @default(0)
  quantityReserved   Int             @default(0)
  reorderLevel       Int             @default(0)
  isTracked          Boolean         @default(true)
  allowBackorder     Boolean         @default(false)
  storefront         Storefront      @relation(fields: [storefrontId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  productVariant     ProductVariant  @relation(fields: [productVariantId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  movements          StockMovement[]
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  @@index([storefrontId])
  @@index([quantityOnHand, quantityReserved])
  @@map("inventories")
}

model StockMovement {
  id                    String            @id @default(cuid())
  inventoryId           String
  type                  StockMovementType
  quantityDelta         Int
  quantityOnHandAfter   Int
  quantityReservedAfter Int
  reason                String?
  referenceType         String?           @db.VarChar(80)
  referenceId           String?           @db.VarChar(160)
  inventory             Inventory         @relation(fields: [inventoryId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  createdAt             DateTime          @default(now())

  @@index([inventoryId, createdAt])
  @@index([referenceType, referenceId])
  @@map("stock_movements")
}
EOF

echo
echo "=== ADD APPROVED STOREFRONT CATEGORIES TO SEED ==="

python - <<'PY'
from pathlib import Path

path = Path("prisma/seed.ts")
content = path.read_text(encoding="utf-8")

category_block = '''
const categoryDefinitions = {
  atiloszy: [
    {
      slug: "shoes",
      name: "Shoes",
      description: "Everyday footwear and carefully selected shoes.",
      position: 1,
    },
    {
      slug: "household-essentials",
      name: "Household Essentials",
      description: "Useful products for everyday home life.",
      position: 2,
    },
    {
      slug: "useful-gadgets",
      name: "Useful Gadgets",
      description: "Practical gadgets and convenient accessories.",
      position: 3,
    },
    {
      slug: "gifts",
      name: "Gifts",
      description: "Thoughtful products for gifting occasions.",
      position: 4,
    },
    {
      slug: "everyday-essentials",
      name: "Everyday Essentials",
      description: "Reliable daily-use products.",
      position: 5,
    },
  ],
  "zee-beauty-fashion": [
    {
      slug: "beauty",
      name: "Beauty",
      description: "Beauty products selected for everyday routines.",
      position: 1,
    },
    {
      slug: "fashion",
      name: "Fashion",
      description: "Fashion pieces and wearable essentials.",
      position: 2,
    },
    {
      slug: "personal-care",
      name: "Personal Care",
      description: "Personal-care products for daily use.",
      position: 3,
    },
    {
      slug: "household",
      name: "Household",
      description: "Useful household products and accessories.",
      position: 4,
    },
    {
      slug: "everyday-essentials",
      name: "Everyday Essentials",
      description: "Frequently needed everyday items.",
      position: 5,
    },
  ],
  denald: [
    {
      slug: "solar",
      name: "Solar",
      description: "Solar panels, inverters, batteries and power solutions.",
      position: 1,
    },
    {
      slug: "cctv",
      name: "CCTV",
      description: "Security cameras, recorders and surveillance equipment.",
      position: 2,
    },
    {
      slug: "computers",
      name: "Computers",
      description: "Computer systems and workplace technology.",
      position: 3,
    },
    {
      slug: "accessories",
      name: "Accessories",
      description: "Supporting equipment, cables and technical accessories.",
      position: 4,
    },
  ],
  "zee-comfort-hub": [
    {
      slug: "bras",
      name: "Bras",
      description: "Comfort-focused everyday bras.",
      position: 1,
    },
    {
      slug: "underwear",
      name: "Underwear",
      description: "Comfortable underwear for everyday wear.",
      position: 2,
    },
    {
      slug: "leggings",
      name: "Leggings",
      description: "Flexible leggings for comfort and movement.",
      position: 3,
    },
    {
      slug: "sleepwear",
      name: "Sleepwear",
      description: "Soft sleepwear designed for restful evenings.",
      position: 4,
    },
    {
      slug: "loungewear",
      name: "Loungewear",
      description: "Relaxed pieces for comfortable home living.",
      position: 5,
    },
    {
      slug: "mens-essentials",
      name: "Men's Essentials",
      description: "Boxers, singlets, vintage tops and round-neck essentials.",
      position: 6,
    },
  ],
} as const;
'''

if "const categoryDefinitions =" not in content:
    marker = "\n] as const;\n\nasync function seed() {"

    if marker not in content:
        raise RuntimeError(
            "Could not locate the storefront definition ending in prisma/seed.ts."
        )

    content = content.replace(
        marker,
        "\n] as const;\n\n" + category_block.strip() + "\n\nasync function seed() {",
        1,
    )

category_seed = '''
    const categories = categoryDefinitions[definition.store.key];

    for (const category of categories) {
      await prisma.category.upsert({
        where: {
          storefrontId_slug: {
            storefrontId: storefront.id,
            slug: category.slug,
          },
        },
        update: {
          name: category.name,
          description: category.description,
          position: category.position,
        },
        create: {
          storefrontId: storefront.id,
          slug: category.slug,
          name: category.name,
          description: category.description,
          position: category.position,
        },
      });
    }
'''

if "categoryDefinitions[definition.store.key]" not in content:
    marker = '''    await prisma.storefrontFulfilmentSettings.upsert({
      where: {
        storefrontId: storefront.id,
      },
      update: definition.fulfilment,
      create: {
        storefrontId: storefront.id,
        ...definition.fulfilment,
      },
    });
'''

    if marker not in content:
        raise RuntimeError(
            "Could not locate the fulfilment upsert in prisma/seed.ts."
        )

    content = content.replace(
        marker,
        marker + "\n" + category_seed.rstrip() + "\n",
        1,
    )

content = content.replace(
    "SORVYRA storefront foundation seeded successfully.",
    "SORVYRA storefront and catalogue foundation seeded successfully.",
)

path.write_text(content, encoding="utf-8")
print("Updated prisma/seed.ts with approved storefront categories.")
PY

echo
echo "=== CREATE CATALOGUE FOUNDATION AUDIT ==="

cat > scripts/audit-catalog-foundation.ts <<'EOF'
import "dotenv/config";

import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PriceType,
  PrismaClient,
  ProductStatus,
  StorefrontProductStatus,
  StockMovementType,
} from "../src/generated/prisma/client";

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

const expectedCategories = {
  ATI: [
    "shoes",
    "household-essentials",
    "useful-gadgets",
    "gifts",
    "everyday-essentials",
  ],
  DEN: [
    "solar",
    "cctv",
    "computers",
    "accessories",
  ],
  ZBF: [
    "beauty",
    "fashion",
    "personal-care",
    "household",
    "everyday-essentials",
  ],
  ZCH: [
    "bras",
    "underwear",
    "leggings",
    "sleepwear",
    "loungewear",
    "mens-essentials",
  ],
} as const;

async function audit() {
  const storefronts = await prisma.storefront.findMany({
    include: {
      categories: {
        orderBy: {
          position: "asc",
        },
      },
    },
    orderBy: {
      code: "asc",
    },
  });

  assert.equal(
    storefronts.length,
    4,
    "Expected four approved storefronts.",
  );

  let approvedCategoryCount = 0;

  for (const storefront of storefronts) {
    const expected =
      expectedCategories[
        storefront.code as keyof typeof expectedCategories
      ];

    assert.ok(
      expected,
      `No approved category definition found for ${storefront.code}.`,
    );

    const discovered = new Set(
      storefront.categories.map((category) => category.slug),
    );

    for (const slug of expected) {
      assert.ok(
        discovered.has(slug),
        `${storefront.code} is missing category ${slug}.`,
      );

      approvedCategoryCount += 1;
    }
  }

  assert.equal(
    approvedCategoryCount,
    20,
    "Expected twenty approved storefront categories.",
  );

  const productCountBefore = await prisma.product.count();
  const auditToken = Date.now().toString();
  const auditProductSlug = `catalogue-audit-${auditToken}`;

  await prisma.$transaction(async (tx) => {
    const storefront = await tx.storefront.findUniqueOrThrow({
      where: {
        code: "ATI",
      },
    });

    const category = await tx.category.findUniqueOrThrow({
      where: {
        storefrontId_slug: {
          storefrontId: storefront.id,
          slug: "shoes",
        },
      },
    });

    const product = await tx.product.create({
      data: {
        slug: auditProductSlug,
        name: "Temporary catalogue audit product",
        shortDescription:
          "Temporary record used to validate the catalogue relationships.",
        status: ProductStatus.DRAFT,
      },
    });

    const storefrontProduct = await tx.storefrontProduct.create({
      data: {
        storefrontId: storefront.id,
        productId: product.id,
        categoryId: category.id,
        slug: auditProductSlug,
        status: StorefrontProductStatus.DRAFT,
        isDemo: true,
      },
    });

    const variant = await tx.productVariant.create({
      data: {
        storefrontProductId: storefrontProduct.id,
        sku: `ATI-AUDIT-${auditToken}`,
        title: "Black / Size 42",
        isDefault: true,
      },
    });

    await tx.variantOption.createMany({
      data: [
        {
          productVariantId: variant.id,
          name: "Colour",
          value: "Black",
          position: 1,
        },
        {
          productVariantId: variant.id,
          name: "Size",
          value: "42",
          position: 2,
        },
      ],
    });

    await tx.productImage.create({
      data: {
        storefrontProductId: storefrontProduct.id,
        variantId: variant.id,
        url: "https://example.invalid/catalogue-audit.jpg",
        altText: "Temporary catalogue audit product",
        position: 1,
        isPrimary: true,
      },
    });

    await tx.storefrontPrice.create({
      data: {
        productVariantId: variant.id,
        currencyCode: storefront.currencyCode,
        type: PriceType.REGULAR,
        amount: "12500.00",
        isActive: true,
      },
    });

    const inventory = await tx.inventory.create({
      data: {
        storefrontId: storefront.id,
        productVariantId: variant.id,
        quantityOnHand: 5,
        quantityReserved: 1,
        reorderLevel: 2,
        isTracked: true,
        allowBackorder: false,
      },
    });

    await tx.stockMovement.create({
      data: {
        inventoryId: inventory.id,
        type: StockMovementType.OPENING_STOCK,
        quantityDelta: 5,
        quantityOnHandAfter: 5,
        quantityReservedAfter: 1,
        reason: "Temporary catalogue foundation audit",
        referenceType: "CATALOGUE_AUDIT",
        referenceId: auditToken,
      },
    });

    const discovered = await tx.storefrontProduct.findUniqueOrThrow({
      where: {
        id: storefrontProduct.id,
      },
      include: {
        storefront: true,
        category: true,
        images: true,
        variants: {
          include: {
            options: true,
            prices: true,
            inventory: {
              include: {
                movements: true,
              },
            },
          },
        },
      },
    });

    assert.equal(discovered.storefront.code, "ATI");
    assert.equal(discovered.category?.slug, "shoes");
    assert.equal(discovered.images.length, 1);
    assert.equal(discovered.variants.length, 1);

    const discoveredVariant = discovered.variants[0];

    assert.ok(
      discoveredVariant.sku.startsWith("ATI-"),
      "The test SKU does not use the storefront prefix.",
    );

    assert.equal(discoveredVariant.options.length, 2);
    assert.equal(discoveredVariant.prices.length, 1);
    assert.equal(
      discoveredVariant.prices[0].currencyCode,
      storefront.currencyCode,
    );

    assert.ok(discoveredVariant.inventory);
    assert.equal(
      discoveredVariant.inventory.quantityOnHand -
        discoveredVariant.inventory.quantityReserved,
      4,
      "Available stock should equal on-hand stock minus reserved stock.",
    );

    assert.equal(
      discoveredVariant.inventory.movements.length,
      1,
      "Opening stock movement was not recorded.",
    );

    await tx.product.delete({
      where: {
        id: product.id,
      },
    });
  });

  const productCountAfter = await prisma.product.count();

  assert.equal(
    productCountAfter,
    productCountBefore,
    "Temporary audit product was not removed cleanly.",
  );

  const temporaryProduct = await prisma.product.findUnique({
    where: {
      slug: auditProductSlug,
    },
  });

  assert.equal(
    temporaryProduct,
    null,
    "Temporary catalogue audit data still exists.",
  );

  console.log("=== CATALOGUE FOUNDATION AUDIT ===");
  console.log(`Storefronts: ${storefronts.length}`);
  console.log(`Approved categories: ${approvedCategoryCount}`);
  console.log("");

  for (const storefront of storefronts) {
    const expected =
      expectedCategories[
        storefront.code as keyof typeof expectedCategories
      ];

    console.log(
      `${storefront.code} | ${storefront.name} | ${expected.length} approved categories`,
    );
  }

  console.log("");
  console.log("PASS: Product relationship round-trip completed.");
  console.log("PASS: Variant options and SKU prefix validated.");
  console.log("PASS: Storefront currency pricing validated.");
  console.log("PASS: Exact stock and stock movement tracking validated.");
  console.log("PASS: Temporary audit records removed.");
  console.log("PASS: Catalogue foundation audit completed.");
}

audit()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("FAIL: Catalogue foundation audit failed.");
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
EOF

echo
echo "=== ADD CATALOGUE AUDIT COMMAND ==="

npm pkg set \
  scripts.db:audit:catalog="tsx scripts/audit-catalog-foundation.ts"

echo
echo "=== FORMAT AND VALIDATE SCHEMA ==="

npx prisma format
npm run db:validate

echo
echo "=== CREATE AND APPLY CATALOGUE MIGRATION ==="

npx prisma migrate dev \
  --name catalog_foundation

echo
echo "=== GENERATE PRISMA CLIENT ==="

npm run db:generate

echo
echo "=== SEED APPROVED CATEGORIES ==="

npm run db:seed

echo
echo "=== RUN STOREFRONT FOUNDATION AUDIT ==="

npm run db:audit

echo
echo "=== RUN CATALOGUE FOUNDATION AUDIT ==="

npm run db:audit:catalog

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
echo "=== PHASE 2C CHANGES ==="

git status --short

echo
echo "PHASE 2C SETUP COMPLETED"
