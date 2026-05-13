/**
 * 본사 직영 매장(소매) 시드:
 *  - Partner: hq-direct
 *  - 별도 admin: direct@rentking.kr / demo1234 (role=partner_admin, partnerId="hq-direct")
 *  - 사은품 정책 일부 시드 (본사 직영 차별화)
 *  - 영업자 1명 시드 (본사 직영 채널 매니저)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  // 1) Partner
  await prisma.partner.upsert({
    where: { partnerCode: "hq-direct" },
    update: {
      partnerName: "SK매직 본사 직영",
      brandLabel: "본사 직영 매장 (소매)",
      region: "서울 종로구",
      address: "서울특별시 종로구 청계천로 85",
      hotlineNumber: "1600-1661",
      ownerName: "본사 직영팀",
      businessNumber: "104-86-48203",
      commerceNumber: "2026-서울종로-0001",
      phone: "010-0000-0001",
      status: "active",
      tier: "enterprise",
    },
    create: {
      partnerCode: "hq-direct",
      partnerName: "SK매직 본사 직영",
      brandLabel: "본사 직영 매장 (소매)",
      region: "서울 종로구",
      address: "서울특별시 종로구 청계천로 85",
      hotlineNumber: "1600-1661",
      ownerName: "본사 직영팀",
      businessNumber: "104-86-48203",
      commerceNumber: "2026-서울종로-0001",
      phone: "010-0000-0001",
      status: "active",
      tier: "enterprise",
    },
  });
  console.log("✓ Partner hq-direct upsert");

  // 2) admin User
  await prisma.user.upsert({
    where: { email: "direct@rentking.kr" },
    update: { passwordHash, name: "본사 직영팀", role: "partner_admin", partnerId: "hq-direct", status: "active" },
    create: {
      email: "direct@rentking.kr",
      passwordHash,
      name: "본사 직영팀",
      role: "partner_admin",
      partnerId: "hq-direct",
      status: "active",
    },
  });
  console.log("✓ User direct@rentking.kr upsert");

  // 3) Seller (본사 직영 채널 매니저)
  await prisma.seller.upsert({
    where: { partnerId_sellerCode: { partnerId: "hq-direct", sellerCode: "direct-manager" } },
    update: { name: "본사 직영 매니저", phone: "010-0000-0002", email: "direct-manager@rentking.kr" },
    create: {
      partnerId: "hq-direct",
      sellerCode: "direct-manager",
      name: "본사 직영 매니저",
      phone: "010-0000-0002",
      email: "direct-manager@rentking.kr",
      status: "active",
    },
  });
  console.log("✓ Seller direct-manager upsert");

  // 4) PartnerPolicy — 본사 직영 차별화 사은품 (3건)
  const gifts: Array<{ code: string; amount: number; label: string }> = [
    { code: "WPUJCC104SWH", amount: 20000, label: "본사 직영 한정 텀블러+필터 세트" },
    { code: "ACL15C1ASKWH", amount: 25000, label: "본사 직영 한정 H13 필터 1년분" },
    { code: "WPUMAC306SWH", amount: 30000, label: "본사 직영 한정 살균키트 2년분" },
  ];
  let policyCount = 0;
  for (const g of gifts) {
    const product = await prisma.product.findUnique({ where: { productCode: g.code } });
    if (!product) continue;
    await prisma.partnerPolicy.upsert({
      where: { partnerId_productId: { partnerId: "hq-direct", productId: product.id } },
      update: { giftAmount: g.amount, giftLabel: g.label, installAmount: 30000 },
      create: {
        partnerId: "hq-direct",
        productId: product.id,
        giftAmount: g.amount,
        giftLabel: g.label,
        installAmount: 30000,
      },
    });
    policyCount++;
  }
  console.log(`✓ PartnerPolicy ${policyCount}건 차별화`);

  console.log(`\n✅ 본사 직영 매장 시드 완료`);
  console.log(`  URL          : https://rentking-next.vercel.app/p/hq-direct`);
  console.log(`  관리자       : direct@rentking.kr / demo1234 (역할: 협력점 admin)`);
  console.log(`  영업자       : direct-manager (https://rentking-next.vercel.app/p/hq-direct/s/direct-manager)`);
  console.log(`  Tier         : enterprise`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
