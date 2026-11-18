-- AlterTable
ALTER TABLE "AvailabilityRule" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'regular';

-- AlterTable
ALTER TABLE "BookingSettings" ADD COLUMN     "premiumSurcharge" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "premiumOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DateOverride" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffId" TEXT,
    "date" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "windows" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DateOverride_businessId_date_idx" ON "DateOverride"("businessId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DateOverride_businessId_staffId_date_key" ON "DateOverride"("businessId", "staffId", "date");

-- AddForeignKey
ALTER TABLE "DateOverride" ADD CONSTRAINT "DateOverride_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

