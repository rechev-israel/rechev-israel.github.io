-- AlterTable
ALTER TABLE "OutboundMessage" ADD COLUMN     "studentId" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "portalTokenAt" TIMESTAMP(3),
ADD COLUMN     "portalTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Student_portalTokenHash_key" ON "Student"("portalTokenHash");

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

