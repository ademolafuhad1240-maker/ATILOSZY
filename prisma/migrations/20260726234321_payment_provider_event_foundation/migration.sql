-- CreateEnum
CREATE TYPE "PaymentProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "payment_provider_events" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "providerEventId" VARCHAR(191) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "status" "PaymentProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payloadHash" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "storefrontId" TEXT,
    "orderPaymentId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "processingStartedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failureCode" VARCHAR(120),
    "failureMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_provider_events_status_receivedAt_idx" ON "payment_provider_events"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "payment_provider_events_provider_eventType_receivedAt_idx" ON "payment_provider_events"("provider", "eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "payment_provider_events_storefrontId_receivedAt_idx" ON "payment_provider_events"("storefrontId", "receivedAt");

-- CreateIndex
CREATE INDEX "payment_provider_events_orderPaymentId_receivedAt_idx" ON "payment_provider_events"("orderPaymentId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_events_provider_providerEventId_key" ON "payment_provider_events"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "storefronts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_orderPaymentId_fkey" FOREIGN KEY ("orderPaymentId") REFERENCES "order_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
