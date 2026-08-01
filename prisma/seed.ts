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
      logoPath: "/brand/zee-beauty-fashion-logo.webp",
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
      logoPath: "/brand/zee-comfort-hub-logo-2026.webp",
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
      position: 11,
    },
    {
      slug: "boxers",
      name: "Boxers",
      description: "Comfortable boxer briefs and everyday underwear for men.",
      position: 5,
    },
    {
      slug: "bralettes",
      name: "Bralettes",
      description: "Soft bralettes selected for everyday comfort and support.",
      position: 6,
    },
    {
      slug: "vintage",
      name: "Vintage",
      description: "Distinctive vintage and vintage-inspired clothing.",
      position: 7,
    },
    {
      slug: "round-necks",
      name: "Round Necks",
      description: "Plain round-neck shirts and easy everyday layers.",
      position: 8,
    },
    {
      slug: "womens-essentials",
      name: "Women's Essentials",
      description: "Practical comfort essentials selected for women.",
      position: 9,
    },
    {
      slug: "mens-essentials",
      name: "Men's Essentials",
      description: "Boxers, singlets, vintage tops and round-neck essentials.",
      position: 10,
    },
  ],
} as const;

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
  }
}

seed()
  .then(async () => {
    console.log("SORVYRA storefront and catalogue foundation seeded successfully.");
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Storefront seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
