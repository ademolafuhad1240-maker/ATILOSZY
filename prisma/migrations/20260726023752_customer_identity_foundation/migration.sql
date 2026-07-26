-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "VerificationPurpose" AS ENUM ('REGISTRATION', 'EMAIL_CHANGE', 'PHONE_CHANGE', 'PASSWORD_RESET', 'TWO_FACTOR_RECOVERY');

-- CreateEnum
CREATE TYPE "CustomerAddressType" AS ENUM ('SHIPPING', 'BILLING', 'BOTH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "normalizedEmail" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "normalizedPhone" VARCHAR(32) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storefront_customers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptInAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storefront_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_security_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecretCiphertext" TEXT,
    "twoFactorRecoveryData" JSONB,
    "twoFactorConfirmedAt" TIMESTAMP(3),
    "loginAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_security_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL,
    "type" "CustomerAddressType" NOT NULL DEFAULT 'SHIPPING',
    "label" TEXT,
    "recipientFirstName" TEXT NOT NULL,
    "recipientLastName" TEXT NOT NULL,
    "recipientPhone" VARCHAR(32) NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "stateOrProvince" TEXT,
    "postalCode" VARCHAR(32),
    "deliveryNotes" TEXT,
    "isDefaultShipping" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultBilling" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "ipAddress" VARCHAR(64),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL DEFAULT 'REGISTRATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "challengeId" VARCHAR(128) NOT NULL,
    "codeHash" VARCHAR(128) NOT NULL,
    "purpose" "VerificationPurpose" NOT NULL DEFAULT 'REGISTRATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_storefrontId_status_idx" ON "users"("storefrontId", "status");

-- CreateIndex
CREATE INDEX "users_normalizedEmail_idx" ON "users"("normalizedEmail");

-- CreateIndex
CREATE INDEX "users_normalizedPhone_idx" ON "users"("normalizedPhone");

-- CreateIndex
CREATE INDEX "users_emailVerifiedAt_phoneVerifiedAt_idx" ON "users"("emailVerifiedAt", "phoneVerifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_storefrontId_normalizedEmail_key" ON "users"("storefrontId", "normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "users_storefrontId_normalizedPhone_key" ON "users"("storefrontId", "normalizedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "users_id_storefrontId_key" ON "users"("id", "storefrontId");

-- CreateIndex
CREATE INDEX "storefront_customers_storefrontId_createdAt_idx" ON "storefront_customers"("storefrontId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_customers_userId_storefrontId_key" ON "storefront_customers"("userId", "storefrontId");

-- CreateIndex
CREATE INDEX "customer_security_settings_storefrontId_twoFactorEnabled_idx" ON "customer_security_settings"("storefrontId", "twoFactorEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "customer_security_settings_userId_storefrontId_key" ON "customer_security_settings"("userId", "storefrontId");

-- CreateIndex
CREATE INDEX "customer_addresses_userId_storefrontId_idx" ON "customer_addresses"("userId", "storefrontId");

-- CreateIndex
CREATE INDEX "customer_addresses_storefrontId_city_idx" ON "customer_addresses"("storefrontId", "city");

-- CreateIndex
CREATE INDEX "customer_addresses_countryCode_idx" ON "customer_addresses"("countryCode");

-- CreateIndex
CREATE INDEX "customer_addresses_isDefaultShipping_isDefaultBilling_idx" ON "customer_addresses"("isDefaultShipping", "isDefaultBilling");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_storefrontId_expiresAt_idx" ON "sessions"("userId", "storefrontId", "expiresAt");

-- CreateIndex
CREATE INDEX "sessions_storefrontId_revokedAt_idx" ON "sessions"("storefrontId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_tokenHash_key" ON "email_verifications"("tokenHash");

-- CreateIndex
CREATE INDEX "email_verifications_userId_storefrontId_purpose_expiresAt_idx" ON "email_verifications"("userId", "storefrontId", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "email_verifications_email_consumedAt_idx" ON "email_verifications"("email", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "phone_verifications_challengeId_key" ON "phone_verifications"("challengeId");

-- CreateIndex
CREATE INDEX "phone_verifications_userId_storefrontId_purpose_expiresAt_idx" ON "phone_verifications"("userId", "storefrontId", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "phone_verifications_phone_consumedAt_idx" ON "phone_verifications"("phone", "consumedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_customers" ADD CONSTRAINT "storefront_customers_userId_storefrontId_fkey" FOREIGN KEY ("userId", "storefrontId") REFERENCES "users"("id", "storefrontId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storefront_customers" ADD CONSTRAINT "storefront_customers_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_security_settings" ADD CONSTRAINT "customer_security_settings_userId_storefrontId_fkey" FOREIGN KEY ("userId", "storefrontId") REFERENCES "users"("id", "storefrontId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_security_settings" ADD CONSTRAINT "customer_security_settings_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_userId_storefrontId_fkey" FOREIGN KEY ("userId", "storefrontId") REFERENCES "users"("id", "storefrontId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_storefrontId_fkey" FOREIGN KEY ("userId", "storefrontId") REFERENCES "users"("id", "storefrontId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_userId_storefrontId_fkey" FOREIGN KEY ("userId", "storefrontId") REFERENCES "users"("id", "storefrontId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_userId_storefrontId_fkey" FOREIGN KEY ("userId", "storefrontId") REFERENCES "users"("id", "storefrontId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
