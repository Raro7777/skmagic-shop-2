-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "partnerCode" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "ownerName" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phoneRaw" TEXT NOT NULL,
    "productInterest" TEXT NOT NULL,
    "region" TEXT,
    "partnerId" TEXT,
    "ownerType" TEXT NOT NULL DEFAULT 'partner',
    "source" TEXT NOT NULL DEFAULT 'consumer_form',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "duplicateStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_partnerCode_key" ON "Partner"("partnerCode");

-- CreateIndex
CREATE INDEX "Partner_status_idx" ON "Partner"("status");

-- CreateIndex
CREATE INDEX "Lead_partnerId_createdAt_idx" ON "Lead"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_phoneRaw_idx" ON "Lead"("phoneRaw");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("partnerCode") ON DELETE SET NULL ON UPDATE CASCADE;
