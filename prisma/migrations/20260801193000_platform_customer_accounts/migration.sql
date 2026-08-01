-- Add a platform-level customer identity without replacing or deleting any
-- existing storefront customer, session, cart or order records.
CREATE TABLE "customer_accounts" (
    "id" TEXT NOT NULL,
    "normalizedEmail" VARCHAR(254) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_accounts_normalizedEmail_key"
ON "customer_accounts"("normalizedEmail");

ALTER TABLE "users"
ADD COLUMN "customerAccountId" TEXT;

-- Existing customer rows sharing the same verified mailbox become storefront
-- memberships of one SORVYRA customer account. Staff-only identities are not
-- enrolled automatically.
INSERT INTO "customer_accounts" (
    "id",
    "normalizedEmail",
    "createdAt",
    "updatedAt"
)
SELECT
    'customer_' || md5("users"."normalizedEmail"),
    "users"."normalizedEmail",
    MIN("users"."createdAt"),
    CURRENT_TIMESTAMP
FROM "users"
INNER JOIN "storefront_customers"
    ON "storefront_customers"."userId" = "users"."id"
    AND "storefront_customers"."storefrontId" = "users"."storefrontId"
GROUP BY "users"."normalizedEmail";

UPDATE "users"
SET "customerAccountId" = "customer_accounts"."id"
FROM "customer_accounts"
WHERE "users"."normalizedEmail" = "customer_accounts"."normalizedEmail"
  AND EXISTS (
      SELECT 1
      FROM "storefront_customers"
      WHERE "storefront_customers"."userId" = "users"."id"
        AND "storefront_customers"."storefrontId" = "users"."storefrontId"
  );

CREATE UNIQUE INDEX "users_customerAccountId_storefrontId_key"
ON "users"("customerAccountId", "storefrontId");

CREATE INDEX "users_customerAccountId_status_idx"
ON "users"("customerAccountId", "status");

ALTER TABLE "users"
ADD CONSTRAINT "users_customerAccountId_fkey"
FOREIGN KEY ("customerAccountId")
REFERENCES "customer_accounts"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
