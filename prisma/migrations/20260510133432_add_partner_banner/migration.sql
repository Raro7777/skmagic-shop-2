-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "bgColor1" TEXT NOT NULL DEFAULT '#1A2B4D',
    "bgColor2" TEXT NOT NULL DEFAULT '#F26A1F',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Banner_partnerId_startsAt_idx" ON "Banner"("partnerId", "startsAt");

-- CreateIndex
CREATE INDEX "Banner_status_endsAt_idx" ON "Banner"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("partnerCode") ON DELETE RESTRICT ON UPDATE CASCADE;
