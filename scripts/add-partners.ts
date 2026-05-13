/**
 * 분양 사이트 5개 추가 (협력점 + admin User + 영업자 1명 + 차별화 사은품 정책 1-2개).
 * 멱등성: 이미 있으면 update, 없으면 create.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type NewPartner = {
  code: string;            // slug — URL에 노출
  name: string;
  brand: string;
  region: string;
  address: string;
  biznum: string;
  commerce: string;
  hotline: string;
  owner: string;
  phone: string;
  email: string;
  userName: string;
  // 영업자 1명
  seller: { code: string; name: string; phone: string; email: string };
  // 차별화 사은품 — 모델 코드 → 사은품
  gifts: Array<{ productCode: string; giftAmount: number; giftLabel: string; installAmount?: number }>;
};

const PARTNERS: NewPartner[] = [
  {
    code: "jamsil-skmagic",
    name: "잠실 SK매직 직영",
    brand: "SK매직 잠실 직영점",
    region: "서울 송파구",
    address: "서울 송파구 올림픽로 240",
    biznum: "211-86-12345",
    commerce: "2026-서울송파-0241",
    hotline: "1668-0521",
    owner: "송지호",
    phone: "010-5210-0001",
    email: "jamsil@rentking.kr",
    userName: "송지호 점장",
    seller: { code: "ahn-jisoo", name: "안지수 매니저", phone: "010-5210-0002", email: "ahn.jisoo@example.com" },
    gifts: [
      { productCode: "WPUJCC104SWH", giftAmount: 15000, giftLabel: "프리미엄 텀블러 + 보온병 세트" },
      { productCode: "ACL15C1ASKWH", giftAmount: 20000, giftLabel: "공기청정 필터 1년분", installAmount: 30000 },
    ],
  },
  {
    code: "suwon-life",
    name: "수원 가전월드",
    brand: "수원 종합 가전 분양점",
    region: "경기 수원시 영통구",
    address: "경기 수원시 영통구 광교중앙로 145",
    biznum: "124-86-23451",
    commerce: "2026-수원영통-1015",
    hotline: "1670-1455",
    owner: "정해린",
    phone: "010-1455-0001",
    email: "suwon@rentking.kr",
    userName: "정해린 점장",
    seller: { code: "noh-junsung", name: "노준성 매니저", phone: "010-1455-0002", email: "noh.junsung@example.com" },
    gifts: [
      { productCode: "WPUMAC306SWH", giftAmount: 25000, giftLabel: "여행용 캐리어 24인치" },
      { productCode: "MATSM430RLWH", giftAmount: 30000, giftLabel: "워커힐 침구세트 풀세트" },
    ],
  },
  {
    code: "incheon-life",
    name: "인천 라이프스타일",
    brand: "인천 SK매직 라이프스타일점",
    region: "인천 남동구",
    address: "인천 남동구 구월로 200",
    biznum: "131-86-34521",
    commerce: "2026-인천남동-2210",
    hotline: "1577-3322",
    owner: "한가람",
    phone: "010-3322-0001",
    email: "incheon@rentking.kr",
    userName: "한가람 점장",
    seller: { code: "yu-saerom", name: "유새롬 매니저", phone: "010-3322-0002", email: "yu.saerom@example.com" },
    gifts: [
      { productCode: "BIDS17DR64WH", giftAmount: 8000, giftLabel: "비데 클리너 6개월분" },
      { productCode: "WPUJCC104SWH", giftAmount: 10000, giftLabel: "필터 1세트 추가 증정" },
    ],
  },
  {
    code: "gwangju-hq",
    name: "광주 SK매직 본부",
    brand: "광주 SK매직 본부점",
    region: "광주 서구",
    address: "광주 서구 상무중앙로 80",
    biznum: "411-86-45678",
    commerce: "2026-광주서구-0823",
    hotline: "1670-9000",
    owner: "조태현",
    phone: "010-9000-0001",
    email: "gwangju@rentking.kr",
    userName: "조태현 점장",
    seller: { code: "park-yumi", name: "박유미 매니저", phone: "010-9000-0002", email: "park.yumi@example.com" },
    gifts: [
      { productCode: "ACL15C1ASKWH", giftAmount: 18000, giftLabel: "프리미엄 공기청정 필터 1년분" },
      { productCode: "WPUMAC306SWH", giftAmount: 22000, giftLabel: "정수기 살균 키트 2년분", installAmount: 30000 },
    ],
  },
  {
    code: "daejeon-mid",
    name: "대전 충청 본점",
    brand: "대전 SK매직 충청권 본점",
    region: "대전 서구",
    address: "대전 서구 둔산대로 100",
    biznum: "314-86-56789",
    commerce: "2026-대전서구-1402",
    hotline: "1670-4242",
    owner: "임수영",
    phone: "010-4242-0001",
    email: "daejeon@rentking.kr",
    userName: "임수영 점장",
    seller: { code: "kim-soohyun", name: "김수현 매니저", phone: "010-4242-0002", email: "kim.soohyun@example.com" },
    gifts: [
      { productCode: "BIDS17DR64WH", giftAmount: 10000, giftLabel: "휴대용 비데 + 필터 키트" },
      { productCode: "MATSM230RSBR", giftAmount: 28000, giftLabel: "프리미엄 매트리스 토퍼" },
    ],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);
  let createdPartners = 0, createdUsers = 0, createdSellers = 0, createdPolicies = 0;

  for (const p of PARTNERS) {
    // 1) Partner upsert
    await prisma.partner.upsert({
      where: { partnerCode: p.code },
      update: {
        partnerName: p.name, brandLabel: p.brand, region: p.region,
        address: p.address, businessNumber: p.biznum, commerceNumber: p.commerce,
        hotlineNumber: p.hotline, ownerName: p.owner, phone: p.phone,
        status: "active",
      },
      create: {
        partnerCode: p.code, partnerName: p.name, brandLabel: p.brand,
        region: p.region, address: p.address, businessNumber: p.biznum,
        commerceNumber: p.commerce, hotlineNumber: p.hotline,
        ownerName: p.owner, phone: p.phone, status: "active",
      },
    });
    createdPartners++;

    // 2) User upsert
    await prisma.user.upsert({
      where: { email: p.email },
      update: { passwordHash, name: p.userName, role: "partner_admin", partnerId: p.code, status: "active" },
      create: {
        email: p.email, passwordHash, name: p.userName,
        role: "partner_admin", partnerId: p.code, status: "active",
      },
    });
    createdUsers++;

    // 3) Seller upsert
    await prisma.seller.upsert({
      where: { partnerId_sellerCode: { partnerId: p.code, sellerCode: p.seller.code } },
      update: { name: p.seller.name, phone: p.seller.phone, email: p.seller.email },
      create: {
        partnerId: p.code, sellerCode: p.seller.code,
        name: p.seller.name, phone: p.seller.phone, email: p.seller.email,
        status: "active",
      },
    });
    createdSellers++;

    // 4) PartnerPolicy 차별화 사은품 (해당 product가 존재할 때만)
    for (const g of p.gifts) {
      const product = await prisma.product.findUnique({ where: { productCode: g.productCode } });
      if (!product) continue;
      await prisma.partnerPolicy.upsert({
        where: { partnerId_productId: { partnerId: p.code, productId: product.id } },
        update: { giftAmount: g.giftAmount, giftLabel: g.giftLabel, installAmount: g.installAmount ?? 0 },
        create: {
          partnerId: p.code, productId: product.id,
          giftAmount: g.giftAmount, giftLabel: g.giftLabel,
          installAmount: g.installAmount ?? 0,
        },
      });
      createdPolicies++;
    }
  }

  console.log(`\n✅ 분양 사이트 추가 완료`);
  console.log(`  Partner          : ${createdPartners}개 upsert`);
  console.log(`  User (admin)     : ${createdUsers}개 upsert (password: demo1234)`);
  console.log(`  Seller           : ${createdSellers}명 upsert`);
  console.log(`  PartnerPolicy    : ${createdPolicies}건 차별화 사은품 시드`);

  console.log(`\n🌐 분양 사이트 URL:`);
  for (const p of PARTNERS) {
    console.log(`  ${p.brand}`);
    console.log(`     사이트 : https://rentking-next.vercel.app/p/${p.code}`);
    console.log(`     관리자 : ${p.email} / demo1234`);
    console.log(`     영업자 : https://rentking-next.vercel.app/p/${p.code}/s/${p.seller.code}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
