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
