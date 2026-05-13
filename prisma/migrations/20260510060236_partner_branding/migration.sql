-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "address" TEXT,
ADD COLUMN     "brandLabel" TEXT NOT NULL DEFAULT 'SK매직 인증판매점',
ADD COLUMN     "businessNumber" TEXT,
ADD COLUMN     "commerceNumber" TEXT,
ADD COLUMN     "hotlineNumber" TEXT NOT NULL DEFAULT '1600-2434',
ADD COLUMN     "kakaoChannelUrl" TEXT,
ADD COLUMN     "region" TEXT;
