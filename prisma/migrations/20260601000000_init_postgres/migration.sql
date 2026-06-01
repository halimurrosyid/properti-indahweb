-- CreateTable: User
CREATE TABLE IF NOT EXISTS "User" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(191),
    "password" VARCHAR(191) NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "whatsapp" VARCHAR(191) NOT NULL,
    "role" VARCHAR(191) NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_whatsapp_key" ON "User"("whatsapp");

-- CreateTable: Category
CREATE TABLE IF NOT EXISTS "Category" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");

-- CreateTable: Property
CREATE TABLE IF NOT EXISTS "Property" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(191) NOT NULL,
    "slug" VARCHAR(191) NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(15, 2) NOT NULL,
    "listingType" VARCHAR(191) NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "landSize" INTEGER NOT NULL,
    "buildingSize" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" INTEGER NOT NULL,
    "certificate" VARCHAR(191) NOT NULL,
    "electricity" VARCHAR(191),
    "waterSource" VARCHAR(191),
    "garage" INTEGER NOT NULL DEFAULT 0,
    "facilities" VARCHAR(191),
    "province" VARCHAR(191) NOT NULL,
    "city" VARCHAR(191) NOT NULL,
    "district" VARCHAR(191) NOT NULL,
    "shortAddress" VARCHAR(191) NOT NULL,
    "contactName" VARCHAR(191) NOT NULL,
    "whatsappNumber" VARCHAR(191) NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredUntil" TIMESTAMP(3),
    "status" VARCHAR(191) NOT NULL DEFAULT 'AVAILABLE',
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Property_slug_key" ON "Property"("slug");

-- CreateTable: PropertyImage
CREATE TABLE IF NOT EXISTS "PropertyImage" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "url" VARCHAR(191) NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("id")
);

-- CreateTable: WhatsappTrack
CREATE TABLE IF NOT EXISTS "WhatsappTrack" (
    "id" SERIAL NOT NULL,
    "propertyId" INTEGER NOT NULL,
    "ipHash" VARCHAR(191) NOT NULL,
    "userAgent" VARCHAR(191),
    "referrer" VARCHAR(191),
    "device" VARCHAR(191),
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("id")
);

-- CreateTable: Invoice
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" SERIAL NOT NULL,
    "invoiceNumber" VARCHAR(191) NOT NULL,
    "userId" INTEGER NOT NULL,
    "propertyId" INTEGER,
    "packageCode" VARCHAR(191) NOT NULL,
    "packageName" VARCHAR(191) NOT NULL,
    "amount" DECIMAL(15, 2) NOT NULL,
    "status" VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    "paymentProof" VARCHAR(191),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- AddForeignKeys
ALTER TABLE "Property" DROP CONSTRAINT IF EXISTS "Property_categoryId_fkey";
ALTER TABLE "Property" ADD CONSTRAINT "Property_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Property" DROP CONSTRAINT IF EXISTS "Property_userId_fkey";
ALTER TABLE "Property" ADD CONSTRAINT "Property_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PropertyImage" DROP CONSTRAINT IF EXISTS "PropertyImage_propertyId_fkey";
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsappTrack" DROP CONSTRAINT IF EXISTS "WhatsappTrack_propertyId_fkey";
ALTER TABLE "WhatsappTrack" ADD CONSTRAINT "WhatsappTrack_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_userId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_propertyId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
