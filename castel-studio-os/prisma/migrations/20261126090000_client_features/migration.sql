-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "liveDelayMin" INTEGER,
ADD COLUMN     "liveStatus" TEXT,
ADD COLUMN     "liveUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ExperienceSettings" ADD COLUMN     "gifts" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "surprise" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "LoyaltyReward" ADD COLUMN     "revealedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppointmentRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "style" TEXT,
    "fade" TEXT,
    "beard" TEXT,
    "changes" TEXT,
    "note" TEXT,
    "photoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "kind" TEXT NOT NULL,
    "serviceId" TEXT,
    "serviceName" TEXT,
    "amount" INTEGER,
    "recipientName" TEXT NOT NULL,
    "message" TEXT,
    "design" TEXT NOT NULL DEFAULT 'noir',
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "buyerCustomerId" TEXT,
    "viewTokenHash" TEXT NOT NULL,
    "code" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redeemedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRequest_appointmentId_key" ON "AppointmentRequest"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_viewTokenHash_key" ON "GiftCard"("viewTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- CreateIndex
CREATE INDEX "GiftCard_businessId_status_idx" ON "GiftCard"("businessId", "status");

