ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "listingLimit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agentUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activePackageCode" VARCHAR(191);

UPDATE "User"
SET "listingLimit" = 20
WHERE "role" = 'agent' AND "listingLimit" = 1;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "durationDays" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "listingLimit" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "featuredDurationDays" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "grantsAgent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "packageSnapshot" TEXT;

CREATE TABLE IF NOT EXISTS "AdPackage" (
  "id" SERIAL PRIMARY KEY,
  "code" VARCHAR(191) NOT NULL UNIQUE,
  "name" VARCHAR(191) NOT NULL,
  "description" TEXT,
  "price" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "durationDays" INTEGER,
  "listingLimit" INTEGER NOT NULL DEFAULT 1,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "featuredDurationDays" INTEGER,
  "grantsAgent" BOOLEAN NOT NULL DEFAULT false,
  "isPopular" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "benefits" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AdPackage_isActive_sortOrder_idx" ON "AdPackage"("isActive", "sortOrder");
