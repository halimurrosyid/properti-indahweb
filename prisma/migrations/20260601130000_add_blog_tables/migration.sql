-- DropTable
DROP TABLE IF EXISTS "Article";

-- CreateTable: BlogCategory
CREATE TABLE IF NOT EXISTS "BlogCategory" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BlogCategory_slug_key" ON "BlogCategory"("slug");

-- CreateTable: AiBlogJob
CREATE TABLE IF NOT EXISTS "AiBlogJob" (
    "id" SERIAL NOT NULL,
    "batch_name" VARCHAR(191),
    "titles_text" TEXT NOT NULL,
    "total_titles" INTEGER NOT NULL DEFAULT 0,
    "generated_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(191) NOT NULL DEFAULT 'pending',
    "publish_mode" VARCHAR(191) NOT NULL DEFAULT 'draft',
    "interval_hours" INTEGER,
    "publish_start_at" TIMESTAMP(3),
    "publish_window_start" VARCHAR(191),
    "publish_window_end" VARCHAR(191),
    "prompt_template" TEXT,
    "knowledge_base" TEXT,
    "featured_image" VARCHAR(191),
    "created_by" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiBlogJob_status_idx" ON "AiBlogJob"("status");

-- CreateTable: BlogPost
CREATE TABLE IF NOT EXISTS "BlogPost" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "featured_image" VARCHAR(191),
    "category_id" INTEGER,
    "author_id" INTEGER NOT NULL,
    "status" VARCHAR(191) NOT NULL DEFAULT 'draft',
    "source" VARCHAR(191) NOT NULL DEFAULT 'manual',
    "meta_title" VARCHAR(191),
    "meta_description" TEXT,
    "focus_keyword" VARCHAR(191),
    "canonical_url" VARCHAR(191),
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "ai_job_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX IF NOT EXISTS "BlogPost_status_idx" ON "BlogPost"("status");
CREATE INDEX IF NOT EXISTS "BlogPost_scheduled_at_idx" ON "BlogPost"("scheduled_at");
CREATE INDEX IF NOT EXISTS "BlogPost_published_at_idx" ON "BlogPost"("published_at");
CREATE INDEX IF NOT EXISTS "BlogPost_category_id_idx" ON "BlogPost"("category_id");
CREATE INDEX IF NOT EXISTS "BlogPost_author_id_idx" ON "BlogPost"("author_id");

-- CreateTable: AiBlogJobItem
CREATE TABLE IF NOT EXISTS "AiBlogJobItem" (
    "id" SERIAL NOT NULL,
    "ai_job_id" INTEGER NOT NULL,
    "title" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191),
    "blog_post_id" INTEGER,
    "status" VARCHAR(191) NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiBlogJobItem_status_idx" ON "AiBlogJobItem"("status");

-- AddForeignKeys
ALTER TABLE "BlogPost" DROP CONSTRAINT IF EXISTS "BlogPost_category_id_fkey";
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "BlogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BlogPost" DROP CONSTRAINT IF EXISTS "BlogPost_author_id_fkey";
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BlogPost" DROP CONSTRAINT IF EXISTS "BlogPost_ai_job_id_fkey";
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_ai_job_id_fkey" FOREIGN KEY ("ai_job_id") REFERENCES "AiBlogJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiBlogJob" DROP CONSTRAINT IF EXISTS "AiBlogJob_created_by_fkey";
ALTER TABLE "AiBlogJob" ADD CONSTRAINT "AiBlogJob_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AiBlogJobItem" DROP CONSTRAINT IF EXISTS "AiBlogJobItem_ai_job_id_fkey";
ALTER TABLE "AiBlogJobItem" ADD CONSTRAINT "AiBlogJobItem_ai_job_id_fkey" FOREIGN KEY ("ai_job_id") REFERENCES "AiBlogJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiBlogJobItem" DROP CONSTRAINT IF EXISTS "AiBlogJobItem_blog_post_id_fkey";
ALTER TABLE "AiBlogJobItem" ADD CONSTRAINT "AiBlogJobItem_blog_post_id_fkey" FOREIGN KEY ("blog_post_id") REFERENCES "BlogPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
