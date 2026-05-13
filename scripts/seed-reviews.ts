/**
 * Review 시드 — 모델/협력점/별점 다양성 확보. 멱등성: customerName + body 조합 키.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// 마스킹 — 가운데 글자만 *로
function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

type ReviewSeed = {
  productCode: string;
  partnerCode?: string;
  customer: string;
  rating: number;
  title?: string;
  body: string;
  daysAgo: number;
  selectedMode?: "방문형" | "셀프형";
  selectedContractPeriod?: number;
  isVerified?: boolean;
};

// 다양한 모델, 협력점, 별점 분포 (5점 위주이지만 일부 4점/3점 섞어 자연스러움)
const SEEDS: ReviewSeed[] = [
  // 정수기 — WPUJCC104SWH 초소형 직수
  { productCode: "WPUJCC104SWH", partnerCode: "gangnam-skmagic", customer: "김민지", rating: 5, title: "공간 활용 최고", body: "원룸인데 폭 19cm라 주방 한쪽에 딱 맞아요. 설치기사님도 친절하셨고 4개월 방문관리 일정도 명확하게 안내받았습니다.", daysAgo: 2, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "WPUJCC104SWH", partnerCode: "jamsil-skmagic", customer: "박서연", rating: 5, title: "텀블러 세트 만족", body: "잠실점에서 받은 텀블러+보온병 세트가 생각보다 퀄리티 좋아요. 가입할 때 안 받았으면 후회할 뻔.", daysAgo: 5, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "WPUJCC104SWH", partnerCode: "gangnam-skmagic", customer: "이준영", rating: 4, body: "냉수 온도가 약간 미지근하긴 해요. 그 외엔 다 만족합니다. 카드할인가 적용이라 월 29,400원이라 부담 적어요.", daysAgo: 8, selectedMode: "방문형", selectedContractPeriod: 60 },
  { productCode: "WPUJCC104SWH", partnerCode: "incheon-life", customer: "정수아", rating: 5, title: "이전설치 깔끔", body: "이사 와서 이전설치했는데 SK매직 본사에서 직접 와서 설치해줬어요. 추가 비용 없고 일정 잘 맞춰주셨어요.", daysAgo: 12, isVerified: true },

  // WPUMAC306SWH 투워터
  { productCode: "WPUMAC306SWH", partnerCode: "gwangju-hq", customer: "최진호", rating: 5, title: "프리미엄급 만족도", body: "정수+온수 라인 분리되어서 가족 모두 편하게 써요. 4인 가구인데 용량 부족함 없어요. 광주점에서 살균키트도 잘 받았습니다.", daysAgo: 3, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "WPUMAC306SWH", partnerCode: "suwon-life", customer: "김다은", rating: 5, body: "캐리어 사은품 받으려고 수원점에서 가입. 큰 캐리어인데 받았을 때 진짜 놀랐어요. 정수기 자체도 깔끔하고 좋습니다.", daysAgo: 7, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "WPUMAC306SWH", partnerCode: "gangnam-skmagic", customer: "장윤서", rating: 4, body: "가격대가 좀 있지만 4인 가구 기준으로는 적당. 카드할인 받으면 월 44,900원이라 가성비 OK.", daysAgo: 15, selectedContractPeriod: 60 },

  // ACL15C1ASKWH 15평 올클린 (방문형 + 셀프형 둘 다)
  { productCode: "ACL15C1ASKWH", partnerCode: "gangnam-skmagic", customer: "황혜원", rating: 5, title: "셀프형 가성비 굿", body: "방문관리 안 해도 되는 셀프형으로 가입했어요. 매월 추가 비용 없이 부담 없습니다. 미세먼지 표시도 직관적이에요.", daysAgo: 4, selectedMode: "셀프형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "ACL15C1ASKWH", partnerCode: "gwangju-hq", customer: "오재민", rating: 5, body: "광주점에서 필터 1년분 사은품 받으니까 부담이 더 줄어드네요. H13 헤파라 미세먼지 빨리 빨리 거르는게 보여요.", daysAgo: 9, selectedMode: "셀프형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "ACL15C1ASKWH", partnerCode: "bundang-rental", customer: "조현우", rating: 4, body: "취침모드에서 소음 25dB가 정말 조용해서 잠 잘 때 안 거슬려요. 만족.", daysAgo: 20, selectedMode: "셀프형", selectedContractPeriod: 60 },

  // ACL22C1ASKOB 22평 올클린 디아트
  { productCode: "ACL22C1ASKOB", partnerCode: "incheon-life", customer: "한승민", rating: 5, title: "디자인 만족", body: "오트밀 베이지 색이 거실 인테리어에 잘 어울려요. 22평형이라 거실+안방 하나로 커버됩니다.", daysAgo: 6, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "ACL22C1ASKOB", partnerCode: "daejeon-mid", customer: "유정아", rating: 5, body: "아이있는 집인데 펫 프리필터 있는 모델이라 안심됩니다.", daysAgo: 11, selectedMode: "방문형", selectedContractPeriod: 60 },

  // BIDS17DR64WH 풀스텐 케어 비데
  { productCode: "BIDS17DR64WH", partnerCode: "incheon-life", customer: "임소영", rating: 5, title: "스테인리스 노즐 좋아요", body: "전·후 분리 풀스텐 노즐이라 위생적이고 청소도 쉬워요. 12개월 방문관리라 자주 안 와도 되어 부담 적네요.", daysAgo: 14, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "BIDS17DR64WH", partnerCode: "daejeon-mid", customer: "강태욱", rating: 5, body: "휴대 비데 + 필터 키트 사은품이 실용적이에요. 수온 좌온 조절도 부드럽고 만족.", daysAgo: 18, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "BIDS17DR64WH", partnerCode: "gangnam-skmagic", customer: "백지영", rating: 4, body: "가격이 좀 있지만 카드할인 적용하면 월 16,900원이라 합리적. A/S도 빠릅니다.", daysAgo: 22 },

  // BIDF17DR43WH 풀스텐 스파 비데
  { productCode: "BIDF17DR43WH", partnerCode: "gangnam-skmagic", customer: "송지훈", rating: 5, title: "프리미엄 비데", body: "스파 기능 정말 좋아요. 노즐 풀 스테인리스라 청소 부담도 줄었습니다.", daysAgo: 25, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },

  // 매트리스 워커힐
  { productCode: "MATSM430RLWH", partnerCode: "suwon-life", customer: "윤서현", rating: 5, title: "워커힐 침구 풀세트", body: "수원점에서 침구 풀세트까지 받았어요. 매트리스만 받기에는 가격 부담있는데 정말 잘 챙겨주십니다.", daysAgo: 16, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "MATSM430RLWH", partnerCode: "gangnam-skmagic", customer: "한지호", rating: 5, body: "허리 안 좋았는데 워커힐 클라우드 매트리스로 바꾼 후 자고 일어났을 때 훨씬 가벼워요.", daysAgo: 28, isVerified: true },
  { productCode: "MATSM230RSBR", partnerCode: "daejeon-mid", customer: "이정민", rating: 4, body: "스위트 매트리스인데 토퍼 사은품까지 받아서 이중 만족. 처음 가격 보고 망설였는데 후회 안 합니다.", daysAgo: 33, selectedContractPeriod: 60 },

  // 다양한 정수기 — 짧은 후기들
  { productCode: "WPUGBC102SCE", partnerCode: "gangnam-skmagic", customer: "김혜정", rating: 5, body: "에코미니 사이즈가 컴팩트해서 좁은 주방에 딱이에요. 1~3인 가구에 추천.", daysAgo: 30, selectedMode: "방문형", selectedContractPeriod: 60 },
  { productCode: "WPUGBC102SCE", partnerCode: "bucheon-skmagic", customer: "박재현", rating: 4, body: "월 21,900원으로 부담 없이 시작. 4개월 방문관리 일정 안내도 정확합니다.", daysAgo: 35 },
  { productCode: "WPUIAC414SOW", partnerCode: "bucheon-skmagic", customer: "조윤정", rating: 5, title: "얼음정수기 추천", body: "여름에 얼음 무한이라 가족 모두 만족. 카페 안 가도 됩니다.", daysAgo: 6, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "WPUIAC425SNW", partnerCode: "gangnam-skmagic", customer: "최서윤", rating: 5, body: "원코크 플러스 4인 가구에 충분. 카드할인 적용하면 월 55,900원으로 떨어져요.", daysAgo: 10, selectedContractPeriod: 60 },
  { productCode: "WPUJAC104SWH", partnerCode: "jamsil-skmagic", customer: "정민호", rating: 5, body: "초소형 직수 정수기 폭 좁아서 주방 라인에 딱 맞춰서 설치됨. 만족.", daysAgo: 21 },
  { productCode: "WPUJAC125SNW", partnerCode: "gangnam-skmagic", customer: "임유나", rating: 4, body: "초소형 라이트라 더 작아요. 1인 가구에 충분합니다.", daysAgo: 27 },

  // 공기청정기
  { productCode: "ACL20C1ASKWH", partnerCode: "bundang-rental", customer: "박세영", rating: 5, body: "20평형이라 거실 30평 가까이 커버 가능. 미세먼지 알림 정확해요.", daysAgo: 13, selectedMode: "방문형", selectedContractPeriod: 60, isVerified: true },
  { productCode: "ACL25C1ASKCE", partnerCode: "gwangju-hq", customer: "강민지", rating: 5, body: "25평형 사용 — 거실+안방 동시 커버. 셀프형으로 추가 부담 없이 만족합니다.", daysAgo: 19, selectedMode: "셀프형", selectedContractPeriod: 60 },
  { productCode: "ACL130Z0SKPN", partnerCode: "gangnam-skmagic", customer: "이지윤", rating: 4, body: "PSG 코어 모델 디자인이 모던해요. 작은 방에 좋습니다.", daysAgo: 24 },

  // 비데
  { productCode: "BIDF17DR54WW", partnerCode: "incheon-life", customer: "노지훈", rating: 5, title: "위글위글 디자인 굿", body: "위글위글 컬러 라인업 너무 귀엽고 풀스텐 스파 비데 기능도 좋습니다. 인천점 신청 후 빠른 설치 감사.", daysAgo: 8, isVerified: true },
  { productCode: "BIDS51DR15WH", partnerCode: "daejeon-mid", customer: "한가람", rating: 5, body: "올클린 케어 비데 — 노즐 자체 살균이라 위생 걱정 적어요.", daysAgo: 17 },

  // 매트리스 추가
  { productCode: "MATSM730RZOM", partnerCode: "suwon-life", customer: "강현주", rating: 5, body: "워커힐 스탠다드 — 셀프형 가입이라 추가 비용 없고 매트리스 자체도 단단함과 부드러움 균형 좋습니다.", daysAgo: 32, selectedMode: "셀프형" },

  // 부정적 톤 살짝 (자연스러움)
  { productCode: "WPUJCC104SWH", partnerCode: "gangnam-skmagic", customer: "오태현", rating: 3, body: "제품 자체는 좋은데 첫 설치 일정이 한 주 늦어졌어요. 그것만 빼면 만족.", daysAgo: 36 },
  { productCode: "ACL15C1ASKWH", partnerCode: "bucheon-skmagic", customer: "윤소희", rating: 4, body: "필터 알림이 가끔 잘못 뜨는 것 같아요. A/S 신청해서 곧 점검 예정.", daysAgo: 40 },

  // 추가 다양성
  { productCode: "WPUTDC104RNW", partnerCode: "bundang-rental", customer: "이민혁", rating: 5, body: "뉴슬림 플러스 — 카드할인 없어서 운영가 그대로지만 가성비 좋네요.", daysAgo: 26 },
  { productCode: "WPUB600FREWH", partnerCode: "gangnam-skmagic", customer: "김지혜", rating: 5, body: "그랜드 정수기 프리스탠딩 — 큰 사이즈 부담있을까봐 걱정했는데 깔끔하게 들어가요.", daysAgo: 38 },
  { productCode: "WPUIC110FRSL", partnerCode: "gwangju-hq", customer: "정형준", rating: 5, title: "FS직수 얼음정수기 좋아요", body: "프리스탠딩이라 어디 두든 자유롭고 얼음 생산량도 충분.", daysAgo: 42 },
  { productCode: "WPUIAC506SNW", partnerCode: "incheon-life", customer: "박유진", rating: 5, body: "MEGA ICE 얼음정수기 — 여름철 손님 많은 집에 추천. 얼음통 큼직해요.", daysAgo: 14, isVerified: true },

  // 글로벌 (협력점 무관) 후기
  { productCode: "WPUJCC104SWH", customer: "최예린", rating: 5, body: "브랜드 SK매직 신뢰가 가네요. 제품 만족도 높습니다.", daysAgo: 50 },
  { productCode: "ACL15C1ASKWH", customer: "이수민", rating: 5, body: "공기청정기 가성비 라인업으로 추천합니다.", daysAgo: 55 },
  { productCode: "BIDS17DR64WH", customer: "서지호", rating: 4, body: "전반적으로 만족. 가격대비 좋은 모델.", daysAgo: 60 },
];

async function main() {
  let created = 0, skipped = 0;
  for (const s of SEEDS) {
    const product = await prisma.product.findUnique({
      where: { productCode: s.productCode },
      select: { id: true },
    });
    if (!product) { skipped++; continue; }

    // 멱등성: 같은 customer + body 첫 32자
    const bodyKey = s.body.slice(0, 32);
    const existing = await prisma.review.findFirst({
      where: {
        customerName: maskName(s.customer),
        body: { startsWith: bodyKey },
      },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }

    await prisma.review.create({
      data: {
        productId: product.id,
        partnerId: s.partnerCode ?? null,
        customerName: maskName(s.customer),
        rating: s.rating,
        title: s.title ?? null,
        body: s.body,
        photos: [],
        selectedMode: s.selectedMode ?? null,
        selectedContractPeriod: s.selectedContractPeriod ?? null,
        isVerified: s.isVerified ?? false,
        status: "published",
        createdAt: new Date(Date.now() - s.daysAgo * DAY),
      },
    });
    created++;
  }

  const total = await prisma.review.count({ where: { status: "published" } });
  const avg = await prisma.review.aggregate({
    where: { status: "published" },
    _avg: { rating: true },
  });
  const verified = await prisma.review.count({ where: { isVerified: true } });

  console.log(`\n✅ Review 시드: 신규 ${created}건 / 스킵 ${skipped}건`);
  console.log(`📊 누적: 총 ${total}건 (평균 ${avg._avg.rating?.toFixed(2)}점, 인증 ${verified}건)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
