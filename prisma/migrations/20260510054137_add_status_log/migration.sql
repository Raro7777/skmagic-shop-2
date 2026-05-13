-- CreateTable
CREATE TABLE "LeadStatusLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "changedById" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadStatusLog_leadId_createdAt_idx" ON "LeadStatusLog"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadStatusLog" ADD CONSTRAINT "LeadStatusLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
