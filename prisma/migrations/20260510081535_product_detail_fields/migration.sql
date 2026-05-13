-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "keyFeatures" JSONB,
ADD COLUMN     "specs" JSONB,
ADD COLUMN     "warrantyMonths" INTEGER NOT NULL DEFAULT 60;
