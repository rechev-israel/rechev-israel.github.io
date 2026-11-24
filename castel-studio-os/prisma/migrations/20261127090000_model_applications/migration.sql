-- AlterTable
ALTER TABLE "ExperienceSettings" ADD COLUMN     "model" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "ModelApplication" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "activeDay" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "notes" TEXT,
    "photoFrontId" TEXT,
    "photoSideId" TEXT,
    "photoBackId" TEXT,
    "consentTerms" BOOLEAN NOT NULL DEFAULT false,
    "consentPhotos" BOOLEAN NOT NULL DEFAULT false,
    "holdId" TEXT,
    "appointmentId" TEXT,
    "rejectReason" TEXT,
    "altStartsAt" TIMESTAMP(3),
    "manageTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "photosDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelApplication_appointmentId_key" ON "ModelApplication"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelApplication_manageTokenHash_key" ON "ModelApplication"("manageTokenHash");

-- CreateIndex
CREATE INDEX "ModelApplication_businessId_status_startsAt_idx" ON "ModelApplication"("businessId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "ModelApplication_customerId_idx" ON "ModelApplication"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelApplication_businessId_activeDay_key" ON "ModelApplication"("businessId", "activeDay");

