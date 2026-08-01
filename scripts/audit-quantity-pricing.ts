import assert from "node:assert/strict";

import { resolveQuantityPrice } from "../src/server/catalog/quantity-pricing";
import { requireMoney } from "../src/server/catalog/validation";

interface TestMoney {
  toFixed(decimalPlaces: number): string;
}

function money(value: string): TestMoney {
  return {
    toFixed(decimalPlaces: number) {
      return Number(value).toFixed(decimalPlaces);
    },
  };
}

function main(): void {
  console.log("=== SELLING UNIT AND QUANTITY PRICING AUDIT ===");

  const tiers = [
    {
      minimumQuantity: 3,
      unitAmount: money("50000.00"),
    },
    {
      minimumQuantity: 6,
      unitAmount: money("47000.00"),
    },
  ];

  assert.deepEqual(
    resolveQuantityPrice({
      quantity: 2,
      baseAmount: money("55000.00"),
      compareAtAmount: null,
      tiers,
    }),
    {
      baseUnitPrice: "55000.00",
      effectiveUnitPrice: "55000.00",
      comparisonUnitPrice: null,
      quantityDiscountPerUnit: "0.00",
      appliedMinimumQuantity: null,
    },
  );
  console.log("PASS: Quantities below the first price break retain the base price.");

  assert.deepEqual(
    resolveQuantityPrice({
      quantity: 3,
      baseAmount: money("55000.00"),
      compareAtAmount: null,
      tiers,
    }),
    {
      baseUnitPrice: "55000.00",
      effectiveUnitPrice: "50000.00",
      comparisonUnitPrice: "55000.00",
      quantityDiscountPerUnit: "5000.00",
      appliedMinimumQuantity: 3,
    },
  );
  console.log("PASS: The first eligible quantity price is applied exactly at its threshold.");

  assert.deepEqual(
    resolveQuantityPrice({
      quantity: 9,
      baseAmount: money("55000.00"),
      compareAtAmount: money("60000.00"),
      tiers,
    }),
    {
      baseUnitPrice: "55000.00",
      effectiveUnitPrice: "47000.00",
      comparisonUnitPrice: "60000.00",
      quantityDiscountPerUnit: "8000.00",
      appliedMinimumQuantity: 6,
    },
  );
  console.log("PASS: The highest eligible tier wins while compare-at pricing remains presentation-only.");

  assert.equal(
    resolveQuantityPrice({
      quantity: 3,
      baseAmount: money("12.35"),
      tiers: [
        {
          minimumQuantity: 3,
          unitAmount: money("10.10"),
        },
      ],
    }).quantityDiscountPerUnit,
    "2.25",
  );
  console.log("PASS: Decimal discounts are calculated in exact minor units.");

  assert.throws(
    () =>
      resolveQuantityPrice({
        quantity: 3,
        baseAmount: money("55.00"),
        tiers: [
          {
            minimumQuantity: 3,
            unitAmount: money("60.00"),
          },
        ],
      }),
    /Quantity pricing configuration is invalid/u,
  );
  console.log("PASS: A malformed or increasing discount schedule fails closed.");

  assert.equal(
    requireMoney("9999999999999999.99", "Audit amount"),
    "9999999999999999.99",
  );
  assert.throws(
    () => requireMoney("10000000000000000.00", "Audit amount"),
    /supported amount range/u,
  );
  console.log("PASS: Manager-entered prices stay exact across the full database decimal range.");
}

main();
