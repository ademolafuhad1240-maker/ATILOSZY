-- CreateEnum
CREATE TYPE "PlatformAdministratorRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PlatformAdministratorStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ManagerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "GovernanceActorKind" AS ENUM ('APPLICANT', 'PLATFORM_ADMINISTRATOR', 'STORE_MANAGER');

-- CreateEnum
CREATE TYPE "GovernanceAction" AS ENUM (
    'MANAGER_APPLICATION_SUBMITTED',
    'MANAGER_APPLICATION_APPROVED',
    'MANAGER_APPLICATION_REJECTED',
    'MANAGER_APPLICATION_WITHDRAWN',
    'MANAGER_SUSPENDED',
    'MANAGER_REACTIVATED',
    'MANAGER_REVOKED',
    'STAFF_ACCESS_GRANTED',
    'STAFF_ROLE_CHANGED',
    'STAFF_SUSPENDED',
    'STAFF_REACTIVATED',
    'STAFF_REVOKED'
);

-- CreateTable
CREATE TABLE "platform_administrators" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformAdministratorRole" NOT NULL,
    "status" "PlatformAdministratorStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_administrators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_applications" (
    "id" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "status" "ManagerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "statement" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdministratorId" TEXT,
    "reviewNote" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manager_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_audit_events" (
    "id" TEXT NOT NULL,
    "storefrontId" TEXT,
    "managerApplicationId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorKind" "GovernanceActorKind" NOT NULL,
    "actorEmail" VARCHAR(254) NOT NULL,
    "action" "GovernanceAction" NOT NULL,
    "targetUserId" TEXT,
    "targetEmail" VARCHAR(254),
    "fromValue" VARCHAR(80),
    "toValue" VARCHAR(80),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_administrators_userId_key"
ON "platform_administrators"("userId");

-- CreateIndex
CREATE INDEX "platform_administrators_status_role_idx"
ON "platform_administrators"("status", "role");

-- Only one unresolved application may exist per account and storefront.
CREATE UNIQUE INDEX "manager_applications_one_pending_per_user_storefront"
ON "manager_applications"("applicantUserId", "storefrontId")
WHERE "status" = 'PENDING';

-- CreateIndex
CREATE INDEX "manager_applications_storefrontId_status_submittedAt_idx"
ON "manager_applications"("storefrontId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "manager_applications_applicantUserId_submittedAt_idx"
ON "manager_applications"("applicantUserId", "submittedAt");

-- CreateIndex
CREATE INDEX "manager_applications_reviewedByAdministratorId_reviewedAt_idx"
ON "manager_applications"("reviewedByAdministratorId", "reviewedAt");

-- CreateIndex
CREATE INDEX "governance_audit_events_storefrontId_createdAt_idx"
ON "governance_audit_events"("storefrontId", "createdAt");

-- CreateIndex
CREATE INDEX "governance_audit_events_managerApplicationId_createdAt_idx"
ON "governance_audit_events"("managerApplicationId", "createdAt");

-- CreateIndex
CREATE INDEX "governance_audit_events_actorUserId_createdAt_idx"
ON "governance_audit_events"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "governance_audit_events_targetUserId_createdAt_idx"
ON "governance_audit_events"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "platform_administrators"
ADD CONSTRAINT "platform_administrators_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_applications"
ADD CONSTRAINT "manager_applications_applicantUserId_storefrontId_fkey"
FOREIGN KEY ("applicantUserId", "storefrontId")
REFERENCES "users"("id", "storefrontId")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_applications"
ADD CONSTRAINT "manager_applications_storefrontId_fkey"
FOREIGN KEY ("storefrontId")
REFERENCES "storefronts"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_applications"
ADD CONSTRAINT "manager_applications_reviewedByAdministratorId_fkey"
FOREIGN KEY ("reviewedByAdministratorId")
REFERENCES "platform_administrators"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_audit_events"
ADD CONSTRAINT "governance_audit_events_storefrontId_fkey"
FOREIGN KEY ("storefrontId")
REFERENCES "storefronts"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_audit_events"
ADD CONSTRAINT "governance_audit_events_managerApplicationId_fkey"
FOREIGN KEY ("managerApplicationId")
REFERENCES "manager_applications"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_audit_events"
ADD CONSTRAINT "governance_audit_events_actorUserId_fkey"
FOREIGN KEY ("actorUserId")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_audit_events"
ADD CONSTRAINT "governance_audit_events_targetUserId_fkey"
FOREIGN KEY ("targetUserId")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Platform administrator lifecycle timestamps must be consistent.
ALTER TABLE "platform_administrators"
ADD CONSTRAINT "platform_administrators_state_check"
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

-- Application review and withdrawal states are mutually exclusive.
ALTER TABLE "manager_applications"
ADD CONSTRAINT "manager_applications_state_check"
CHECK (
  (
    "status" = 'PENDING'
    AND "reviewedAt" IS NULL
    AND "reviewedByAdministratorId" IS NULL
    AND "withdrawnAt" IS NULL
  )
  OR (
    "status" IN ('APPROVED', 'REJECTED')
    AND "reviewedAt" IS NOT NULL
    AND "reviewedByAdministratorId" IS NOT NULL
    AND "withdrawnAt" IS NULL
  )
  OR (
    "status" = 'WITHDRAWN'
    AND "reviewedAt" IS NULL
    AND "reviewedByAdministratorId" IS NULL
    AND "withdrawnAt" IS NOT NULL
  )
);

ALTER TABLE "manager_applications"
ADD CONSTRAINT "manager_applications_statement_length_check"
CHECK (
  char_length("statement") BETWEEN 40 AND 2000
  AND (
    "reviewNote" IS NULL
    OR char_length("reviewNote") <= 500
  )
);

ALTER TABLE "governance_audit_events"
ADD CONSTRAINT "governance_audit_events_shape_check"
CHECK (
  (
    "action" IN (
      'MANAGER_APPLICATION_SUBMITTED',
      'MANAGER_APPLICATION_WITHDRAWN'
    )
    AND "actorKind" = 'APPLICANT'
    AND "managerApplicationId" IS NOT NULL
    AND "targetUserId" IS NOT NULL
  )
  OR (
    "action" IN (
      'MANAGER_APPLICATION_APPROVED',
      'MANAGER_APPLICATION_REJECTED',
      'MANAGER_SUSPENDED',
      'MANAGER_REACTIVATED',
      'MANAGER_REVOKED'
    )
    AND "actorKind" = 'PLATFORM_ADMINISTRATOR'
    AND "targetUserId" IS NOT NULL
    AND (
      "action" IN (
        'MANAGER_SUSPENDED',
        'MANAGER_REACTIVATED',
        'MANAGER_REVOKED'
      )
      OR "managerApplicationId" IS NOT NULL
    )
  )
  OR (
    "action" IN (
      'STAFF_ACCESS_GRANTED',
      'STAFF_ROLE_CHANGED',
      'STAFF_SUSPENDED',
      'STAFF_REACTIVATED',
      'STAFF_REVOKED'
    )
    AND "actorKind" = 'STORE_MANAGER'
    AND "storefrontId" IS NOT NULL
    AND "targetUserId" IS NOT NULL
  )
);

ALTER TABLE "governance_audit_events"
ADD CONSTRAINT "governance_audit_events_note_length_check"
CHECK (
  "note" IS NULL
  OR char_length("note") <= 500
);
