-- AlterTable
ALTER TABLE "BookingSettings" ADD COLUMN     "autoSendMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoSendTransactional" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "OutboundMessage" ADD COLUMN     "templateVars" JSONB;

