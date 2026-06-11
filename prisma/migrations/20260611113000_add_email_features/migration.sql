ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "EmailToken" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "type" VARCHAR(191) NOT NULL,
  "tokenHash" VARCHAR(191) NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EmailToken_userId_type_idx" ON "EmailToken"("userId", "type");
CREATE INDEX IF NOT EXISTS "EmailToken_expiresAt_idx" ON "EmailToken"("expiresAt");

CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "recipient" VARCHAR(191) NOT NULL,
  "subject" VARCHAR(191) NOT NULL,
  "template" VARCHAR(191) NOT NULL,
  "status" VARCHAR(191) NOT NULL DEFAULT 'pending',
  "eventKey" VARCHAR(191) UNIQUE,
  "errorMessage" TEXT,
  "metadata" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX IF NOT EXISTS "EmailLog_template_idx" ON "EmailLog"("template");
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

CREATE TABLE IF NOT EXISTS "EmailSetting" (
  "id" SERIAL PRIMARY KEY,
  "key" VARCHAR(191) NOT NULL UNIQUE,
  "value" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
