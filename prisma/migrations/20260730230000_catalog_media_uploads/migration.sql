ALTER TABLE "product_images"
ADD COLUMN "storageProvider" VARCHAR(32),
ADD COLUMN "storageKey" VARCHAR(255),
ADD COLUMN "mimeType" VARCHAR(100),
ADD COLUMN "byteSize" INTEGER,
ADD COLUMN "width" INTEGER,
ADD COLUMN "height" INTEGER;

CREATE UNIQUE INDEX "product_images_storageProvider_storageKey_key"
ON "product_images"("storageProvider", "storageKey");
