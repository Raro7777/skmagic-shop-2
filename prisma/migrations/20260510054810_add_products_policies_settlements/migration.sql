-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "productCode" TEXT;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "rentalPrice" INTEGER NOT NULL,
    "cardDiscountPrice" INTEGER,
    "contractPeriod" INTEGER NOT NULL DEFAULT 60,
    "managementType" TEXT NOT NULL,
    "description" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HqPolicy" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "baseCommission" INTEGER NOT NULL,
    "monthIncentive" INTEGER NOT NULL DEFAULT 0,
    "incentiveValidUntil" TIMESTAMP(3),
    "refundLimitRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.6667,
    "installSubsidy" INTEGER NOT NULL DEFAULT 30000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HqPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPolicy" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "giftAmount" INTEGER NOT NULL DEFAULT 0,
    "giftLabel" TEXT,
    "installAmount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "productCode" TEXT,
    "productName" TEXT NOT NULL,
    "baseCommission" INTEGER NOT NULL,
    "giftReturned" INTEGER NOT NULL DEFAULT 0,
    "installReturned" INTEGER NOT NULL DEFAULT 0,
    "netPayout" INTEGER NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_productCode_key" ON "Product"("productCode");

-- CreateIndex
CREATE INDEX "Product_category_status_idx" ON "Product"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HqPolicy_productId_key" ON "HqPolicy"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPolicy_partnerId_productId_key" ON "PartnerPolicy"("partnerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_leadId_key" ON "Settlement"("leadId");

-- CreateIndex
CREATE INDEX "Settlement_partnerId_periodMonth_idx" ON "Settlement"("partnerId", "periodMonth");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- AddForeignKey
ALTER TABLE "HqPolicy" ADD CONSTRAINT "HqPolicy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPolicy" ADD CONSTRAINT "PartnerPolicy_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("partnerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPolicy" ADD CONSTRAINT "PartnerPolicy_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("partnerCode") ON DELETE RESTRICT ON UPDATE CASCADE;
