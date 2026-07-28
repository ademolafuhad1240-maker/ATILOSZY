-- CreateEnum
CREATE TYPE "StorefrontStaffRole" AS ENUM ('MANAGER', 'FULFILMENT', 'VIEWER');

-- CreateEnum
CREATE TYPE "StorefrontStaffStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrderFulfilmentAction" AS ENUM ('CONFIRM', 'START_PREPARING', 'MARK_READY_FOR_PICKUP', 'MARK_OUT_FOR_DELIVERY', 'START_INSTALLATION', 'COMPLETE');

-- CreateTable
CREATE TABLE "storefront_staff_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "role" "StorefrontStaffRole" NOT NULL,
    "status" "StorefrontStaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_staff_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_fulfilment_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "actorMembershipId" TEXT NOT NULL,
    "actorEmail" VARCHAR(254) NOT NULL,
    "actorRole" "StorefrontStaffRole" NOT NULL,
    "action" "OrderFulfilmentAction" NOT NULL,
    "fromOrderStatus" "OrderStatus" NOT NULL,
    "toOrderStatus" "OrderStatus" NOT NULL,
    "fromFulfilmentStatus" "OrderFulfilmentStatus" NOT NULL,
    "toFulfilmentStatus" "OrderFulfilmentStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_fulfilment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "storefront_staff_memberships_userId_storefrontId_key"
ON "storefront_staff_memberships"("userId", "storefrontId");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_staff_memberships_id_storefrontId_key"
ON "storefront_staff_memberships"("id", "storefrontId");

-- CreateIndex
CREATE INDEX "storefront_staff_memberships_storefrontId_status_role_idx"
ON "storefront_staff_memberships"("storefrontId", "status", "role");

-- CreateIndex
CREATE INDEX "order_fulfilment_events_orderId_createdAt_idx"
ON "order_fulfilment_events"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_fulfilment_events_storefrontId_createdAt_idx"
ON "order_fulfilment_events"("storefrontId", "createdAt");

-- CreateIndex
CREATE INDEX "order_fulfilment_events_actorMembershipId_createdAt_idx"
ON "order_fulfilment_events"("actorMembershipId", "createdAt");

-- AddForeignKey
ALTER TABLE "storefront_staff_memberships"
ADD CONSTRAINT "storefront_staff_memberships_userId_storefrontId_fkey"
FOREIGN KEY ("userId", "storefrontId")
REFERENCES "users"("id", "storefrontId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_staff_memberships"
ADD CONSTRAINT "storefront_staff_memberships_storefrontId_fkey"
FOREIGN KEY ("storefrontId")
REFERENCES "storefronts"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fulfilment_events"
ADD CONSTRAINT "order_fulfilment_events_orderId_storefrontId_currencyCode_fkey"
FOREIGN KEY ("orderId", "storefrontId", "currencyCode")
REFERENCES "orders"("id", "storefrontId", "currencyCode")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fulfilment_events"
ADD CONSTRAINT "order_fulfilment_events_actorMembershipId_storefrontId_fkey"
FOREIGN KEY ("actorMembershipId", "storefrontId")
REFERENCES "storefront_staff_memberships"("id", "storefrontId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Staff memberships and operational events must remain internally consistent.
ALTER TABLE "storefront_staff_memberships"
ADD CONSTRAINT "storefront_staff_memberships_state_check"
CHECK (
  (
    "status" = 'ACTIVE'
    AND "suspendedAt" IS NULL
    AND "revokedAt" IS NULL
  )
  OR (
    "status" = 'SUSPENDED'
    AND "suspendedAt" IS NOT NULL
    AND "revokedAt" IS NULL
  )
  OR (
    "status" = 'REVOKED'
    AND "revokedAt" IS NOT NULL
  )
);

ALTER TABLE "order_fulfilment_events"
ADD CONSTRAINT "order_fulfilment_events_note_length_check"
CHECK (
  "note" IS NULL
  OR char_length("note") <= 500
);
