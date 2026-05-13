-- CreateTable
CREATE TABLE "CrawlSource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastCrawledAt" TIMESTAMP(3),
    "intervalMin" INTEGER NOT NULL DEFAULT 1440,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "triggeredById" TEXT,

    CONSTRAINT "CrawlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawledProduct" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "productCode" TEXT,
    "category" TEXT,
    "name" TEXT NOT NULL,
    "modelName" TEXT,
    "imageUrl" TEXT,
    "rentalPrice" INTEGER,
    "cardDiscountPrice" INTEGER,
    "contractPeriod" INTEGER,
    "managementType" TEXT,
    "description" TEXT,
    "rawData" JSONB,
    "previousData" JSONB,
    "changeType" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawledProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductChangeLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "source" TEXT NOT NULL,
    "triggeredById" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrawlSource_slug_key" ON "CrawlSource"("slug");

-- CreateIndex
CREATE INDEX "CrawlSource_status_idx" ON "CrawlSource"("status");

-- CreateIndex
CREATE INDEX "CrawlRun_sourceId_startedAt_idx" ON "CrawlRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "CrawlRun_status_idx" ON "CrawlRun"("status");

-- CreateIndex
CREATE INDEX "CrawledProduct_approvalStatus_crawledAt_idx" ON "CrawledProduct"("approvalStatus", "crawledAt");

-- CreateIndex
CREATE INDEX "CrawledProduct_sourceId_productCode_idx" ON "CrawledProduct"("sourceId", "productCode");

-- CreateIndex
CREATE INDEX "CrawledProduct_changeType_idx" ON "CrawledProduct"("changeType");

-- CreateIndex
CREATE INDEX "ProductChangeLog_productId_detectedAt_idx" ON "ProductChangeLog"("productId", "detectedAt");

-- AddForeignKey
ALTER TABLE "CrawlRun" ADD CONSTRAINT "CrawlRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CrawlSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawledProduct" ADD CONSTRAINT "CrawledProduct_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CrawlSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawledProduct" ADD CONSTRAINT "CrawledProduct_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CrawlRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
