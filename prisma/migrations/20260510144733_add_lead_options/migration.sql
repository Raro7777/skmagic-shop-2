-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "rivalCompensationRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selectedCardDiscountPrice" INTEGER,
ADD COLUMN     "selectedContractPeriod" INTEGER,
ADD COLUMN     "selectedMode" TEXT,
ADD COLUMN     "selectedRentalPrice" INTEGER;
