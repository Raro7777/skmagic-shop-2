-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "partnerId" TEXT,
    "productCode" TEXT,
    "proposedBaseCommission" INTEGER,
    "proposedMonthIncentive" INTEGER,
    "settlementId" TEXT,
    "reason" TEXT,
    "requestedByEmail" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_createdAt_idx" ON "ApprovalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_kind_idx" ON "ApprovalRequest"("kind");

-- CreateIndex
CREATE INDEX "ApprovalRequest_partnerId_idx" ON "ApprovalRequest"("partnerId");

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("partnerCode") ON DELETE SET NULL ON UPDATE CASCADE;
