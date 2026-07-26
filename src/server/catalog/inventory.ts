import "server-only";

import { randomUUID } from "node:crypto";
import {
  Prisma,
  StockMovementType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { CatalogServiceError } from "@/server/catalog/errors";
import type {
  AdjustedInventory,
  AdjustVariantStockInput,
} from "@/server/catalog/types";
import {
  normalizeSku,
  normalizeSlug,
  optionalText,
  requireInteger,
  requireText,
} from "@/server/catalog/validation";

interface InventoryAdjustmentRow {
  inventoryId: string;
  sku: string;
  quantityOnHand: number;
  quantityReserved: number;
}

const allowedAdjustmentTypes = new Set<StockMovementType>([
  StockMovementType.PURCHASE,
  StockMovementType.ADJUSTMENT,
  StockMovementType.RETURN,
  StockMovementType.DAMAGE,
]);

export async function adjustVariantStock(
  input: AdjustVariantStockInput,
): Promise<AdjustedInventory> {
  const storefrontKey = normalizeSlug(
    input.storefrontKey,
    "Storefront key",
    50,
  );

  const sku = normalizeSku(input.sku);

  if (
    !Number.isInteger(input.quantityDelta) ||
    input.quantityDelta === 0
  ) {
    throw new CatalogServiceError(
      "VALIDATION",
      "Stock adjustment must be a non-zero integer.",
    );
  }

  if (!allowedAdjustmentTypes.has(input.type)) {
    throw new CatalogServiceError(
      "VALIDATION",
      "This stock movement type cannot be used for a manual stock adjustment.",
    );
  }

  const reason = requireText(
    input.reason,
    "Stock adjustment reason",
    500,
  );

  const referenceType = optionalText(
    input.referenceType,
    "Reference type",
    80,
  );

  const referenceId = optionalText(
    input.referenceId,
    "Reference ID",
    160,
  );

  const movementId = randomUUID();

  const rows = await prisma.$queryRaw<
    InventoryAdjustmentRow[]
  >(Prisma.sql`
    WITH target AS (
      SELECT
        i.id,
        i."quantityOnHand",
        i."quantityReserved",
        v.sku
      FROM inventories AS i
      INNER JOIN product_variants AS v
        ON v.id = i."productVariantId"
      INNER JOIN storefront_products AS sp
        ON sp.id = v."storefrontProductId"
      INNER JOIN storefronts AS s
        ON s.id = sp."storefrontId"
      WHERE
        s.key = ${storefrontKey}
        AND v.sku = ${sku}
      FOR UPDATE
    ),
    updated AS (
      UPDATE inventories AS i
      SET
        "quantityOnHand" =
          target."quantityOnHand" + ${input.quantityDelta},
        "updatedAt" = CURRENT_TIMESTAMP
      FROM target
      WHERE
        i.id = target.id
        AND target."quantityOnHand" +
          ${input.quantityDelta} >=
          target."quantityReserved"
      RETURNING
        i.id AS "inventoryId",
        target.sku AS sku,
        i."quantityOnHand" AS "quantityOnHand",
        i."quantityReserved" AS "quantityReserved"
    ),
    movement AS (
      INSERT INTO stock_movements (
        id,
        "inventoryId",
        type,
        "quantityDelta",
        "quantityOnHandAfter",
        "quantityReservedAfter",
        reason,
        "referenceType",
        "referenceId",
        "createdAt"
      )
      SELECT
        ${movementId},
        updated."inventoryId",
        CAST(${input.type} AS "StockMovementType"),
        ${input.quantityDelta},
        updated."quantityOnHand",
        updated."quantityReserved",
        ${reason},
        ${referenceType},
        ${referenceId},
        CURRENT_TIMESTAMP
      FROM updated
      RETURNING id
    )
    SELECT
      updated."inventoryId",
      updated.sku,
      updated."quantityOnHand",
      updated."quantityReserved"
    FROM updated
    INNER JOIN movement
      ON TRUE
  `);

  const adjusted = rows[0];

  if (!adjusted) {
    const discovered =
      await prisma.productVariant.findFirst({
        where: {
          sku,
          storefrontProduct: {
            storefront: {
              key: storefrontKey,
            },
          },
        },
        include: {
          inventory: true,
        },
      });

    if (!discovered) {
      throw new CatalogServiceError(
        "NOT_FOUND",
        `Variant ${sku} was not found in ${storefrontKey}.`,
      );
    }

    if (!discovered.inventory) {
      throw new CatalogServiceError(
        "NOT_FOUND",
        `Variant ${sku} does not have an inventory record.`,
      );
    }

    const attemptedQuantity =
      discovered.inventory.quantityOnHand +
      input.quantityDelta;

    if (
      attemptedQuantity <
      discovered.inventory.quantityReserved
    ) {
      throw new CatalogServiceError(
        "INSUFFICIENT_STOCK",
        "Stock on hand cannot be reduced below reserved stock.",
        {
          quantityOnHand:
            discovered.inventory.quantityOnHand,
          quantityReserved:
            discovered.inventory.quantityReserved,
          attemptedQuantity,
        },
      );
    }

    throw new CatalogServiceError(
      "CONFLICT",
      "The stock adjustment could not be completed.",
    );
  }

  requireInteger(
    adjusted.quantityOnHand,
    "Updated stock",
    0,
  );

  return {
    inventoryId: adjusted.inventoryId,
    sku: adjusted.sku,
    quantityOnHand: adjusted.quantityOnHand,
    quantityReserved: adjusted.quantityReserved,
    availableQuantity:
      adjusted.quantityOnHand -
      adjusted.quantityReserved,
  };
}
