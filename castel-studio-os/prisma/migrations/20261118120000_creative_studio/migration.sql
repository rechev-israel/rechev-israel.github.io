-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT 'CASTEL STUDIO',
    "tagline" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0a0a0b',
    "accentColor" TEXT NOT NULL DEFAULT '#c9a44c',
    "textColor" TEXT NOT NULL DEFAULT '#f2ede3',
    "voiceTone" TEXT,
    "visualStyle" TEXT,
    "hashtags" TEXT[],
    "handle" TEXT DEFAULT '@castel.cutzz',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeAsset" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerJobId" TEXT,
    "outputUrl" TEXT,
    "dataUrl" TEXT,
    "mimeType" TEXT,
    "approval" TEXT NOT NULL DEFAULT 'draft',
    "error" TEXT,
    "meta" JSONB,
    "createdById" TEXT,
    "costNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_businessId_key" ON "BrandKit"("businessId");

-- CreateIndex
CREATE INDEX "CreativeAsset_businessId_kind_createdAt_idx" ON "CreativeAsset"("businessId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "CreativeAsset_status_idx" ON "CreativeAsset"("status");

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

