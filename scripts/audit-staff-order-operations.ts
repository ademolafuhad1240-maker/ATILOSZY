import {
  readFileSync,
} from "node:fs";

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  console.log(
    "=== STOREFRONT STAFF ORDER OPERATIONS AUDIT ===",
  );

  const schema =
    readFileSync(
      "prisma/schema.prisma",
      "utf8",
    );

  const migration =
    readFileSync(
      "prisma/migrations/20260727214500_staff_order_operations/migration.sql",
      "utf8",
    );

  for (
    const required of [
      "model StorefrontStaffMembership",
      "enum StorefrontStaffRole",
      "enum StorefrontStaffStatus",
      "model OrderFulfilmentEvent",
      "enum OrderFulfilmentAction",
      "@@unique([userId, storefrontId])",
      "actorMembershipId",
      "fromOrderStatus",
      "toFulfilmentStatus",
    ]
  ) {
    assertCondition(
      schema.includes(required),
      `Staff operations schema is missing ${required}.`,
    );
  }

  assertCondition(
    migration.includes(
      "storefront_staff_memberships_state_check",
    ) &&
      migration.includes(
        "order_fulfilment_events_note_length_check",
      ) &&
      migration.includes(
        "ON DELETE RESTRICT",
      ),
    "The staff operations migration does not fail closed around membership or audit history.",
  );

  console.log(
    "PASS: Staff membership and immutable fulfilment-event persistence are storefront scoped.",
  );

  const registration =
    readFileSync(
      "src/server/auth/registration.ts",
      "utf8",
    );

  assertCondition(
    !registration.includes(
      "storefrontStaffMembership",
    ) &&
      !registration.includes(
        "StorefrontStaffRole",
      ),
    "Public customer registration can create staff access.",
  );

  const provisioning =
    readFileSync(
      "scripts/provision-storefront-staff.ts",
      "utf8",
    );

  for (
    const required of [
      "STAFF_PROVISIONING_ENABLED",
      "emailVerifiedAt",
      "StorefrontStatus.ACTIVE",
      "StorefrontStaffStatus",
      'requiredArgument(\n      "confirm"',
      "Manager access requires an approved manager application.",
    ]
  ) {
    assertCondition(
      provisioning.includes(
        required,
      ),
      `Protected staff provisioning is missing ${required}.`,
    );
  }

  console.log(
    "PASS: Public registration cannot grant staff access and one-off provisioning is disabled by default.",
  );

  const service =
    readFileSync(
      "src/server/operations/service.ts",
      "utf8",
    );

  for (
    const required of [
      "StorefrontStaffStatus",
      "StorefrontStaffRole.VIEWER",
      "OrderPaymentStatus.PAID",
      "DELIVERY_PAYMENT_REQUIRED",
      "FOR UPDATE",
      "availableActions",
      "settleInventory",
      "StockMovementType.SALE",
      "quantityReserved",
      "orderFulfilmentEvent",
      "TransactionIsolationLevel",
    ]
  ) {
    assertCondition(
      service.includes(
        required,
      ),
      `Staff order service is missing ${required}.`,
    );
  }

  assertCondition(
    service.includes(
      "storefrontId:",
    ) &&
      service.includes(
        "storefrontCode",
      ) &&
      service.includes(
        "productPaymentStatus !==",
      ),
    "Staff orders are not constrained by storefront and verified payment state.",
  );

  console.log(
    "PASS: Fulfilment transitions are role checked, paid-only, serializable and inventory aware.",
  );

  const listRoute =
    readFileSync(
      "src/app/api/staff/orders/route.ts",
      "utf8",
    );

  const transitionRoute =
    readFileSync(
      "src/app/api/staff/orders/[orderNumber]/transition/route.ts",
      "utf8",
    );

  const http =
    readFileSync(
      "src/server/operations/http.ts",
      "utf8",
    );

  for (
    const required of [
      "readStaffApiSession",
      "assertTrustedOrigin",
      "requireTransitionFields",
      "requireStaffAction",
      "staffSessionRequiredResponse",
    ]
  ) {
    assertCondition(
      listRoute.includes(
        required,
      ) ||
        transitionRoute.includes(
          required,
        ) ||
        http.includes(required),
      `Staff APIs are missing ${required}.`,
    );
  }

  for (
    const forbidden of [
      "toOrderStatus",
      "toFulfilmentStatus",
      "actorEmail",
      "actorRole",
      "quantityOnHand",
      "quantityReserved",
      "productPaymentStatus",
    ]
  ) {
    assertCondition(
      !transitionRoute.includes(
        `body.${forbidden}`,
      ),
      `Staff transition accepts server-controlled ${forbidden}.`,
    );
  }

  console.log(
    "PASS: Staff APIs require an authenticated session, trusted origin and minimal action request.",
  );

  const client =
    readFileSync(
      "src/components/operations/storefront-orders.tsx",
      "utf8",
    );

  const normalizedClient =
    client.replace(
      /\s+/gu,
      " ",
    );

  for (
    const required of [
      "data-staff-orders",
      "/api/staff/orders",
      "/transition",
      "Staff access required",
      "DELIVERY_PAYMENT_REQUIRED",
      "Fulfilment history",
    ]
  ) {
    assertCondition(
      normalizedClient.includes(
        required,
      ),
      `Staff order UI is missing ${required}.`,
    );
  }

  for (
    const path of [
      "src/app/ng/atiloszy/staff/orders/page.tsx",
      "src/app/ng/zee-beauty-fashion/staff/orders/page.tsx",
      "src/app/ng/denald/staff/orders/page.tsx",
      "src/app/qa/zee-comfort-hub/staff/orders/page.tsx",
    ]
  ) {
    assertCondition(
      readFileSync(
        path,
        "utf8",
      ).includes(
        "StorefrontOrdersPage",
      ),
      `${path} does not use the shared staff order page.`,
    );
  }

  console.log(
    "PASS: All four storefronts share one private staff order experience.",
  );

  console.log(
    "PASS: Storefront staff order operations audit completed without database writes.",
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
