CREATE TABLE IF NOT EXISTS "RegionProvince" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "RegionCity" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "province_code" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegionCity_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "RegionProvince"("code") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "RegionDistrict" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "city_code" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegionDistrict_city_code_fkey" FOREIGN KEY ("city_code") REFERENCES "RegionCity"("code") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RegionCity_province_code_idx" ON "RegionCity"("province_code");
CREATE INDEX IF NOT EXISTS "RegionDistrict_city_code_idx" ON "RegionDistrict"("city_code");

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "provinceCode" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "cityCode" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "districtCode" TEXT;

CREATE INDEX IF NOT EXISTS "Property_provinceCode_idx" ON "Property"("provinceCode");
CREATE INDEX IF NOT EXISTS "Property_cityCode_idx" ON "Property"("cityCode");
CREATE INDEX IF NOT EXISTS "Property_districtCode_idx" ON "Property"("districtCode");
