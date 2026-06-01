-- CreateTable
CREATE TABLE IF NOT EXISTS "Article" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "coverImage" VARCHAR(191),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Article_slug_key" ON "Article"("slug");
