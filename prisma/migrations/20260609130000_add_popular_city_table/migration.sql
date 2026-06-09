CREATE TABLE IF NOT EXISTS "PopularCity" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "image_url" TEXT,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PopularCity_is_active_display_order_idx" ON "PopularCity"("is_active", "display_order");

INSERT INTO "PopularCity" ("name", "province", "image_url", "display_order", "is_active")
SELECT 'Bandung', 'Jawa Barat', 'https://images.unsplash.com/photo-1626266848245-a131b73e51f6?auto=format&fit=crop&w=600&q=80', 1, true
WHERE NOT EXISTS (SELECT 1 FROM "PopularCity" WHERE "name" = 'Bandung');

INSERT INTO "PopularCity" ("name", "province", "image_url", "display_order", "is_active")
SELECT 'Jakarta', 'DKI Jakarta', 'https://images.unsplash.com/photo-1505964261154-5743b693e22d?auto=format&fit=crop&w=600&q=80', 2, true
WHERE NOT EXISTS (SELECT 1 FROM "PopularCity" WHERE "name" = 'Jakarta');

INSERT INTO "PopularCity" ("name", "province", "image_url", "display_order", "is_active")
SELECT 'Surabaya', 'Jawa Timur', 'https://images.unsplash.com/photo-1601999109332-542b18dbec57?auto=format&fit=crop&w=600&q=80', 3, true
WHERE NOT EXISTS (SELECT 1 FROM "PopularCity" WHERE "name" = 'Surabaya');

INSERT INTO "PopularCity" ("name", "province", "image_url", "display_order", "is_active")
SELECT 'Tangerang', 'Banten', 'https://images.unsplash.com/photo-1611606063065-ee7946f0787a?auto=format&fit=crop&w=600&q=80', 4, true
WHERE NOT EXISTS (SELECT 1 FROM "PopularCity" WHERE "name" = 'Tangerang');
