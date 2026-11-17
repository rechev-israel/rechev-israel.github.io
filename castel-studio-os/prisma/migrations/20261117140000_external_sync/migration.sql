-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "externalSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "externalRef" TEXT;

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "received" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncLog_businessId_createdAt_idx" ON "SyncLog"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_businessId_source_externalRef_key" ON "Appointment"("businessId", "source", "externalRef");

-- CreateIndex
CREATE INDEX "Customer_businessId_externalRef_idx" ON "Customer"("businessId", "externalRef");

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

