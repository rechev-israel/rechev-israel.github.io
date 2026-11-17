-- CreateTable
CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "blocks" JSONB NOT NULL,
    "publishedBlocks" JSONB,
    "publishedTitle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwinProfile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "persona" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentText" TEXT,
    "consentAt" TIMESTAMP(3),
    "consentById" TEXT,
    "consentScopes" TEXT[],
    "portraitUrl" TEXT,
    "revokedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwinProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitePage_businessId_slug_key" ON "SitePage"("businessId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "TwinProfile_businessId_key" ON "TwinProfile"("businessId");

-- AddForeignKey
ALTER TABLE "SitePage" ADD CONSTRAINT "SitePage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwinProfile" ADD CONSTRAINT "TwinProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

