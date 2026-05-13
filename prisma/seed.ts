import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const PARTNERS = [
  {
    code: "gangnam-skmagic",
    name: "강남센터 SK매직",
    brand: "SK매직 인증판매점 · 강남구 #001",
    region: "서울 강남구",
    address: "서울 강남구 테헤란로 142, 5층",
    biznum: "123-45-67890",
    commerce: "2024-서울강남-1234",
    hotline: "1600-2434",
    owner: "박지민",
    phone: "010-1111-2222",
    email: "gangnam@rentking.kr",
    userName: "박지민 매니저",
  },
  {
    code: "bucheon-skmagic",
    name: "부천 SK매직 분양점",
    brand: "SK매직 분양점 · 경기 부천 #003",
    region: "경기 부천시",
    address: "경기 부천시 원미구 길주로 218, 3층",
    biznum: "234-56-78901",
    commerce: "2024-경기부천-0456",
    hotline: "1600-3456",
    owner: "김지호",
    phone: "010-3333-4444",
    email: "bucheon@rentking.kr",
    userName: "김지호 점장",
  },
  {
    code: "bundang-rental",
    name: "분당 가전마을",
    brand: "SK매직 위탁판매 · 경기 성남 #007",
    region: "경기 성남시 분당구",
    address: "경기 성남시 분당구 정자일로 95, 2층",
    biznum: "345-67-89012",
    commerce: "2024-경기성남-0789",
    hotline: "1600-4567",
    owner: "이유진",
    phone: "010-5555-6666",
    email: "bundang@rentking.kr",
    userName: "이유진 점장",
  },
];

// Each partner emphasizes different products with different gift differentiations.
// This is the core of the 분양형 model: same products, different competitive strategy per store.
const PARTNER_GIFTS: Record<string, Record<string, { amount: number; label: string | null }>> = {
  "gangnam-skmagic": {
    "WPUJCC104SWH": { amount: 8000,  label: "홈클리너 키트" },
    "WPUGBC102SCE": { amount: 12000, label: "텀블러 세트" },
    "ACL15C1ASKWH": { amount: 0,     label: null },
    "BIDS17DR64WH": { amount: 0,     label: null },
    "WPUMAC306SWH": { amount: 0,     label: null },
  },
  "bucheon-skmagic": {
    "WPUJCC104SWH": { amount: 5000,  label: "물병세트" },
    "WPUGBC102SCE": { amount: 0,     label: null },
    "ACL15C1ASKWH": { amount: 28000, label: "여행용 캐리어 20인치" },
    "BIDS17DR64WH": { amount: 8000,  label: "휴대용 비데 클리너" },
    "WPUMAC306SWH": { amount: 0,     label: null },
  },
  "bundang-rental": {
    "WPUJCC104SWH": { amount: 0,     label: null },
    "WPUGBC102SCE": { amount: 0,     label: null },
    "ACL15C1ASKWH": { amount: 0,     label: null },
    "BIDS17DR64WH": { amount: 0,     label: null },
    "WPUMAC306SWH": { amount: 8000,  label: "정수기 필터 1년" },
  },
};

async function main() {
  // Partners
  for (const p of PARTNERS) {
    await prisma.partner.upsert({
      where: { partnerCode: p.code },
      update: {
        partnerName: p.name,
        brandLabel: p.brand,
        region: p.region,
        address: p.address,
        businessNumber: p.biznum,
        commerceNumber: p.commerce,
        hotlineNumber: p.hotline,
        ownerName: p.owner,
        phone: p.phone,
        status: "active",
      },
      create: {
        partnerCode: p.code,
        partnerName: p.name,
        brandLabel: p.brand,
        region: p.region,
        address: p.address,
        businessNumber: p.biznum,
        commerceNumber: p.commerce,
        hotlineNumber: p.hotline,
        ownerName: p.owner,
        phone: p.phone,
        status: "active",
      },
    });
  }
  console.log(`Seeded ${PARTNERS.length} partners`);

  // Demo users (password: demo1234)
  const passwordHash = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email: "hq@rentking.kr" },
    update: { passwordHash },
    create: {
      email: "hq@rentking.kr",
      passwordHash,
      name: "이서윤 본사 운영팀장",
      role: "hq",
      partnerId: null,
      status: "active",
    },
  });
  for (const p of PARTNERS) {
    await prisma.user.upsert({
      where: { email: p.email },
      update: { passwordHash },
      create: {
        email: p.email,
        passwordHash,
        name: p.userName,
        role: "partner_admin",
        partnerId: p.code,
        status: "active",
      },
    });
  }
  console.log("Seeded users (password: demo1234)");

  // Products + HqPolicy — 실제 SK매직 공식몰의 모델코드 기반.
  // 일부 가격은 "직전 시점의 값"으로 일부러 어긋나게 두어, 크롤 시 변경 감지가 시연되도록 함.
  const PRODUCT_SEEDS = [
    {
      // 실제: rental 48,900 / 60mo / 방문관리 4개월
      // 시드: rental 52,900 → 인하 변경 감지 예정
      code: "WPUJCC104SWH", category: "water", name: "초소형 직수 정수기", model: "WPUJCC104SWH",
      rental: 52900, card: 38900, mgmt: "방문관리 4개월", contract: 60,
      commission: 45000, monthIncentive: 5000, installSub: 30000, featured: true,
      description:
        "초소형 직수 정수기는 폭 19cm 슬림 본체에 직수 방식 + 4개월 방문관리를 결합한 모델입니다.\n\n저장 탱크가 없어 미생물 번식 우려가 적고, 컴팩트한 사이즈로 좁은 주방에도 들어갑니다. 60개월 의무사용 기준 카드할인가를 적용하면 월 38,900원입니다.",
      keyFeatures: ["폭 19cm 초슬림 직수형", "4개월 정기 방문관리", "정수·냉수·온수 3종", "60개월 의무사용", "카드할인 시 월 38,900원"],
      specs: { "정수 방식": "직수형", "필터 단계": "3단계", "추출 온도": "정수 / 냉수 / 온수", "외형 (W×D×H)": "190 × 460 × 380mm", "무게": "8kg", "방문 주기": "4개월" },
    },
    {
      // 실제: rental 21,900 / 60mo / 방문관리 4개월
      // 시드: rental 24,900 / card 24,900 → 인하 변경 감지 예정
      code: "WPUGBC102SCE", category: "water", name: "에코미니 정수기 그린41", model: "WPUGBC102SCE",
      rental: 24900, card: 24900, mgmt: "방문관리 4개월", contract: 60,
      commission: 38000, monthIncentive: 0, installSub: 30000, featured: true,
      description:
        "에코미니 정수기 그린41은 SK매직의 대표 컴팩트 정수기입니다. 4개월 방문관리 주기로 위생 점검을 받으며, 1~3인 가구에 적합한 사이즈입니다.",
      keyFeatures: ["컴팩트 사이즈 (1~3인 가구)", "4개월 정기 방문관리", "정수 전용 모델", "MD추천 가성비 라인"],
      specs: { "정수 방식": "직수형", "필터 단계": "3단계", "추출 온도": "정수", "외형 (W×D×H)": "180 × 410 × 380mm", "방문 주기": "4개월" },
    },
    {
      // 실제: rental 27,900 / 60mo / 자가관리(셀프형)
      // 시드: rental 25,900 / contract 36 → 인상 + 약정 변경 감지 예정
      code: "ACL15C1ASKWH", category: "air", name: "15평 올클린 공기청정기", model: "ACL15C1ASKWH",
      rental: 25900, card: 25900, mgmt: "자가관리", contract: 36,
      commission: 38000, monthIncentive: 0, installSub: 0,
      description:
        "15평 올클린 공기청정기는 거실+방 1개를 커버하는 표준급 모델입니다. 자가관리(셀프형)로 매월 추가 관리비가 없으며, H13 등급 헤파 필터를 탑재했습니다.",
      keyFeatures: ["15평형 (50㎡ 표준)", "H13 헤파 필터", "자가관리 — 추가 관리비 없음", "초미세먼지 0.3μm 99.97% 제거"],
      specs: { "사용 면적": "15평 (50㎡)", "필터": "프리 + 탈취 + H13 헤파", "소음": "취침 25dB", "소비전력": "55W (최대)", "외형 (W×D×H)": "330 × 330 × 700mm" },
    },
    {
      // 실제: rental 22,900 / card 19,900 / 60mo / 방문관리 12개월
      // 시드: rental 24,900 / card 22,900 → 인하 변경 감지 예정
      code: "BIDS17DR64WH", category: "bidet", name: "풀스텐 케어 비데", model: "BIDS17DR64WH",
      rental: 24900, card: 22900, mgmt: "방문관리 12개월", contract: 60,
      commission: 32000, monthIncentive: 0, installSub: 20000,
      description:
        "풀스텐 케어 비데는 노즐을 전·후 모두 스테인리스로 마감해 위생성을 강화한 모델입니다. 12개월 방문관리 주기로 노즐·필터 점검을 받습니다.",
      keyFeatures: ["풀 스테인리스 노즐", "12개월 방문관리", "수온·좌온 3단 조절", "60개월 의무사용", "전국 무료설치"],
      specs: { "방식": "전자식 비데", "노즐": "전·후 분리 (풀스텐)", "수온": "1~3단계", "좌온": "1~3단계", "방문 주기": "12개월" },
    },
    {
      // 실제: rental 60,900 / card 44,900 / 60mo / 방문관리 4개월
      // 시드: rental 58,900 / card 46,900 → 인상 + 카드 인하 변경 감지 예정
      code: "WPUMAC306SWH", category: "water", name: "투워터 정수기", model: "WPUMAC306SWH",
      rental: 58900, card: 46900, mgmt: "방문관리 4개월", contract: 60,
      commission: 72000, monthIncentive: 0, installSub: 30000,
      description:
        "투워터 정수기는 정수·온수 라인을 분리해 두 가지 물맛을 동시에 제공하는 프리미엄 모델입니다. 4인 이상 가구에 추천드립니다.",
      keyFeatures: ["정수·온수 듀얼 라인", "4인 이상 가구 최적", "4개월 방문관리", "프리미엄 라인업"],
      specs: { "정수 방식": "RO + UV", "필터 단계": "5단계", "추출 온도": "정수 / 냉수 / 온수", "탱크 용량": "8L", "방문 주기": "4개월" },
    },
  ];

  for (const p of PRODUCT_SEEDS) {
    const product = await prisma.product.upsert({
      where: { productCode: p.code },
      update: {
        category: p.category,
        name: p.name,
        modelName: p.model,
        rentalPrice: p.rental,
        cardDiscountPrice: p.card,
        managementType: p.mgmt,
        contractPeriod: p.contract,
        isFeatured: p.featured ?? false,
        description: p.description,
        keyFeatures: p.keyFeatures,
        specs: p.specs,
      },
      create: {
        productCode: p.code,
        category: p.category,
        name: p.name,
        modelName: p.model,
        rentalPrice: p.rental,
        cardDiscountPrice: p.card,
        managementType: p.mgmt,
        contractPeriod: p.contract,
        warrantyMonths: 60,
        description: p.description,
        keyFeatures: p.keyFeatures,
        specs: p.specs,
        isFeatured: p.featured ?? false,
        status: "active",
      },
    });
    await prisma.hqPolicy.upsert({
      where: { productId: product.id },
      update: {},
      create: {
        productId: product.id,
        baseCommission: p.commission,
        monthIncentive: p.monthIncentive,
        installSubsidy: p.installSub,
      },
    });

    // PartnerPolicy for each partner — different gift strategies
    for (const partner of PARTNERS) {
      const gift = PARTNER_GIFTS[partner.code]?.[p.code] ?? { amount: 0, label: null };
      await prisma.partnerPolicy.upsert({
        where: { partnerId_productId: { partnerId: partner.code, productId: product.id } },
        update: { giftAmount: gift.amount, giftLabel: gift.label },
        create: {
          partnerId: partner.code,
          productId: product.id,
          giftAmount: gift.amount,
          giftLabel: gift.label,
          installAmount: 0,
        },
      });
    }
  }
  console.log(`Seeded ${PRODUCT_SEEDS.length} products × ${PARTNERS.length} partner policies`);

  // Demo leads — only insert if table is empty so re-running seed doesn't duplicate.
  const existing = await prisma.lead.count();
  if (existing === 0) {
    await prisma.lead.createMany({
      data: [
        {
          customerName: "김소희",
          phoneRaw: "01023451782",
          productInterest: "정수기 PURE+",
          productCode: "WPU-A700C",
          region: "강남구 역삼동",
          partnerId: "gangnam-skmagic",
          ownerType: "partner",
          source: "consumer_form",
          status: "new",
          createdAt: new Date(Date.now() - 18 * 60 * 1000),
        },
        {
          customerName: "장현주",
          phoneRaw: "01098763324",
          productInterest: "안마의자 팔콘 X",
          region: "서초구 반포",
          partnerId: "gangnam-skmagic",
          ownerType: "partner",
          source: "consumer_form",
          status: "new",
          createdAt: new Date(Date.now() - 65 * 60 * 1000),
        },
      ],
    });
    console.log("Seeded 2 demo leads");
  } else {
    console.log(`Skipping lead seed (${existing} leads already exist)`);
  }

  // Sellers (영업자 — 점 안의 개별 영업자)
  const SELLERS = [
    { partnerId: "gangnam-skmagic", sellerCode: "park-jimin",   name: "박지민 점장",   phone: "010-1111-2222", email: "park.jimin@example.com" },
    { partnerId: "gangnam-skmagic", sellerCode: "kim-younghee", name: "김영희 매니저", phone: "010-2222-3333", email: "kim.younghee@example.com" },
    { partnerId: "gangnam-skmagic", sellerCode: "lee-junho",    name: "이준호 매니저", phone: "010-3333-4444", email: "lee.junho@example.com" },
    { partnerId: "bucheon-skmagic", sellerCode: "kim-jiho",     name: "김지호 점장",   phone: "010-3333-4444", email: "kim.jiho@example.com" },
    { partnerId: "bucheon-skmagic", sellerCode: "yoon-haram",   name: "윤하람 매니저", phone: "010-4444-5555", email: "yoon.haram@example.com" },
    { partnerId: "bundang-rental",  sellerCode: "lee-yujin",    name: "이유진 점장",   phone: "010-5555-6666", email: "lee.yujin@example.com" },
  ];
  for (const s of SELLERS) {
    await prisma.seller.upsert({
      where: { partnerId_sellerCode: { partnerId: s.partnerId, sellerCode: s.sellerCode } },
      update: { name: s.name, phone: s.phone, email: s.email },
      create: {
        partnerId: s.partnerId,
        sellerCode: s.sellerCode,
        name: s.name,
        phone: s.phone,
        email: s.email,
        status: "active",
      },
    });
  }
  console.log(`Seeded ${SELLERS.length} sellers across ${PARTNERS.length} partners`);

  // Demo approval requests
  const apprCount = await prisma.approvalRequest.count();
  if (apprCount === 0) {
    await prisma.approvalRequest.createMany({
      data: [
        {
          kind: "partner_signup",
          title: "송파센터 SK매직 (가칭)",
          body: "신청자: 정태현 · 사업자 등록증 ✓ · SK매직 인증코드 ✓ · 보증금 ✓",
          status: "pending",
          partnerId: null,
          requestedByEmail: "songpa@example.com",
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        },
        {
          kind: "commission_increase",
          title: "PURE+ 수수료 인상 요청",
          body: "사유: 세트 사은품 행사 대응. 강남센터 한정 적용 신청.",
          status: "pending",
          partnerId: "gangnam-skmagic",
          productCode: "WPU-A700C",
          proposedMonthIncentive: 8000,
          reason: "세트 사은품 행사 대응",
          requestedByEmail: "gangnam@rentking.kr",
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        },
        {
          kind: "settlement_dispute",
          title: "4월 정산 누락 1건",
          body: "주문 #2024-0428-0312 · 설치완료 처리 누락 · 금액 ₩148,000",
          status: "pending",
          partnerId: "bucheon-skmagic",
          settlementId: null,
          requestedByEmail: "bucheon@rentking.kr",
          createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
        },
        {
          kind: "brand_listing",
          title: "바디프렌드 본사 — 안마의자 카테고리 입점 요청",
          body: "제휴 모델 4종 · 본사 권장 수수료 6.5% 제안 · 계약서 첨부됨",
          status: "pending",
          partnerId: null,
          requestedByEmail: "biz@bodyfriend.example",
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ],
    });
    console.log("Seeded 4 demo approval requests");
  } else {
    console.log(`Skipping approval seed (${apprCount} approvals already exist)`);
  }

  // Crawl sources (rulebook 19)
  const crawlSources = [
    {
      slug: "skmagic",
      name: "SK매직 공식몰",
      baseUrl: "https://www.skmagic.com",
      intervalMin: 1440,
      notes: "정수기·비데·공기청정기·매트리스·안마의자 카테고리 — 본사 직영 메인 소스",
    },
    {
      slug: "coway",
      name: "Coway 공식몰",
      baseUrl: "https://www.coway.com",
      intervalMin: 1440,
      notes: "입점 협력점 가격 비교용 (선택적)",
      status: "paused",
    },
  ];
  for (const src of crawlSources) {
    await prisma.crawlSource.upsert({
      where: { slug: src.slug },
      update: { name: src.name, baseUrl: src.baseUrl, intervalMin: src.intervalMin, notes: src.notes },
      create: src,
    });
  }
  console.log(`Seeded ${crawlSources.length} crawl sources`);

  // Broadcasts
  const bcCount = await prisma.broadcast.count();
  if (bcCount === 0) {
    await prisma.broadcast.createMany({
      data: [
        {
          tone: "urgent",
          badge: "🚨 긴급 정책",
          title: "정수기 카테고리 판매수수료 ₩40,000 → ₩45,000 인상 (5/12 적용)",
          body: "5월 가정의 달 대응 인센티브. 월 렌탈료(29,900원)는 전국 동일 유지.",
          reach: "📊 영향 협력점 3 / 영향 상품 5건",
          createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
        },
        {
          tone: "event",
          badge: "🎁 이벤트",
          title: "어버이날 효도 패키지 (본사 일괄 가격 잠금)",
          body: "5/12 0시 ~ 5/19 24시. 기간 중 사은품 환원 일시 잠금. HERO 슬라이드 자동 배치.",
          reach: "📊 노출 예정 협력점 3 / 적용 상품 5종",
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        {
          tone: "default",
          badge: "📦 마스터 업데이트",
          title: "SK매직 PURE+ 신모델 등록 (WPU-A700C)",
          body: "각 SK매직 인증점에서 진열 추가 가능. 본사 권장가 31,900원.",
          reach: "📊 적용 협력점 3 (SK매직 인증점)",
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
        {
          tone: "default",
          badge: "📦 신상품 입고",
          title: "여름 사은품 카탈로그 업데이트 (12종 추가)",
          body: "여행용 캐리어, 휴대용 선풍기, 캠핑체어 추가. 협력점 사은품 환원 선택지 확대.",
          reach: "📊 카탈로그 사용 협력점 3 / 3",
          createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
        },
      ],
    });
    console.log("Seeded 4 demo broadcasts");
  } else {
    console.log(`Skipping broadcast seed (${bcCount} broadcasts already exist)`);
  }

  console.log("Seed complete");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
