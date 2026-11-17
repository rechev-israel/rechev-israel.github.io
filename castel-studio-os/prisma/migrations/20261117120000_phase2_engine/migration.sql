-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED', 'BLOCKED_NO_CONSENT');

-- AlterTable
ALTER TABLE "AiMessage" ADD COLUMN     "costUsd" DECIMAL(10,6),
ADD COLUMN     "error" TEXT,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "outputTokens" INTEGER;

-- AlterTable
ALTER TABLE "Automation" ADD COLUMN     "description" TEXT,
ADD COLUMN     "key" TEXT,
ADD COLUMN     "lastRunAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AutomationRun" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "steps" JSONB;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "audience" TEXT,
ADD COLUMN     "clicks" INTEGER,
ADD COLUMN     "conversions" INTEGER,
ADD COLUMN     "impressions" INTEGER,
ADD COLUMN     "leads" INTEGER,
ADD COLUMN     "spendActual" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'academy',
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "key" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'transactional';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dashboardWidgets" JSONB;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'transactional',
    "customerId" TEXT,
    "leadId" TEXT,
    "recipientName" TEXT,
    "toAddress" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "templateKey" TEXT,
    "automationRunId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "provider" TEXT,
    "providerMessageId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT,
    "platform" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "hashtags" TEXT[],
    "scheduledFor" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'idea',
    "notes" TEXT,
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "saves" INTEGER,
    "leads" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_businessId_readAt_createdAt_idx" ON "Notification"("businessId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundMessage_businessId_status_createdAt_idx" ON "OutboundMessage"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundMessage_customerId_idx" ON "OutboundMessage"("customerId");

-- CreateIndex
CREATE INDEX "ContentItem_businessId_scheduledFor_idx" ON "ContentItem"("businessId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "Automation_businessId_key_key" ON "Automation"("businessId", "key");

-- CreateIndex
CREATE INDEX "AutomationRun_status_nextRetryAt_idx" ON "AutomationRun"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_automationId_dedupeKey_key" ON "AutomationRun"("automationId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_businessId_key_channel_locale_key" ON "MessageTemplate"("businessId", "key", "channel", "locale");

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

