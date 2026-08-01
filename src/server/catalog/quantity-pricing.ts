import "server-only";

interface MoneyValue {
  toFixed(decimalPlaces: number): string;
}

export interface QuantityPriceTierValue {
  minimumQuantity: number;
  unitAmount: MoneyValue;
}

export interface ResolvedQuantityPrice {
  baseUnitPrice: string;
  effectiveUnitPrice: string;
  comparisonUnitPrice: string | null;
  quantityDiscountPerUnit: string;
  appliedMinimumQuantity: number | null;
}

function toMinorUnits(value: MoneyValue): bigint {
  const [whole, fraction = "00"] = value.toFixed(2).split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

function formatMinorUnits(value: bigint): string {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function resolveQuantityPrice(input: {
  quantity: number;
  baseAmount: MoneyValue;
  compareAtAmount?: MoneyValue | null;
  tiers: readonly QuantityPriceTierValue[];
}): ResolvedQuantityPrice {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) {
    throw new Error("Quantity pricing configuration is invalid.");
  }

  const baseMinor = toMinorUnits(input.baseAmount);

  if (baseMinor <= 0n) {
    throw new Error("Quantity pricing configuration is invalid.");
  }

  const sortedTiers = [...input.tiers].sort(
    (left, right) => left.minimumQuantity - right.minimumQuantity,
  );
  let previousMinimumQuantity = 1;
  let previousUnitAmount = baseMinor;

  for (const tier of sortedTiers) {
    const unitAmount = toMinorUnits(tier.unitAmount);

    if (
      !Number.isSafeInteger(tier.minimumQuantity) ||
      tier.minimumQuantity < 2 ||
      tier.minimumQuantity <= previousMinimumQuantity ||
      unitAmount <= 0n ||
      unitAmount >= previousUnitAmount
    ) {
      throw new Error("Quantity pricing configuration is invalid.");
    }

    previousMinimumQuantity = tier.minimumQuantity;
    previousUnitAmount = unitAmount;
  }

  const eligibleTier = sortedTiers
    .filter((tier) => tier.minimumQuantity <= input.quantity)
    .at(-1);
  const effectiveMinor = eligibleTier
    ? toMinorUnits(eligibleTier.unitAmount)
    : baseMinor;
  const compareAtMinor = input.compareAtAmount
    ? toMinorUnits(input.compareAtAmount)
    : null;
  const comparisonMinor =
    compareAtMinor !== null && compareAtMinor > effectiveMinor
      ? compareAtMinor
      : effectiveMinor < baseMinor
        ? baseMinor
        : null;

  return {
    baseUnitPrice: formatMinorUnits(baseMinor),
    effectiveUnitPrice: formatMinorUnits(effectiveMinor),
    comparisonUnitPrice:
      comparisonMinor === null ? null : formatMinorUnits(comparisonMinor),
    quantityDiscountPerUnit: formatMinorUnits(
      baseMinor > effectiveMinor ? baseMinor - effectiveMinor : 0n,
    ),
    appliedMinimumQuantity: eligibleTier?.minimumQuantity ?? null,
  };
}
