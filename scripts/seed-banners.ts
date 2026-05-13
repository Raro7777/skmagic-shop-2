/**
 * 데모용 활성 배너 시드 — 일부 협력점에 1-2건씩.
 * 멱등성: 동일 (partnerId, title) 조합이 이미 있으면 update, 없으면 create.
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

type Seed = {
  partnerId: string;
  title: string;
  subtitle?: string;
  bgColor1: string;
  bgColor2: string;
  textColor?: string;
  ctaLabel?: string;
  ctaHref?: string;
  startsAtOffsetH: number;     // now + N hours
  endsAtOffsetH: number;
  priority: number;
};

const SEEDS: Seed[] = [
  // 강남 — 진행중 어버이날 + 예약 다가오는 이벤트
  {
    partnerId: "gangnam-skmagic",
    title: "어버이날 효도 패키지 ₩+12,000 사은품",
    subtitle: "정수기 + 안마의자 묶음 가입 시 강남 한정 추가 사은품",
    bgColor1: "#F26A1F", bgColor2: "#1A2B4D",
    ctaLabel: "지금 신청",
    ctaHref: "/p/gangnam-skmagic/events",
    startsAtOffsetH: -2 * 24, endsAtOffsetH: 5 * 24, priority: 10,
  },
  {
    partnerId: "gangnam-skmagic",
    title: "초소형 직수 정수기 4월 카드할인",
    subtitle: "월 ₩29,400 카드할인가 · 36개월 무이자 적용",
    bgColor1: "#3B82F6", bgColor2: "#1E3A8A",
    ctaLabel: "상세 보기",
    ctaHref: "/p/gangnam-skmagic/products/WPUJCC104SWH",
    startsAtOffsetH: -1 * 24, endsAtOffsetH: 14 * 24, priority: 5,
  },

  // 잠실 — 진행중 텀블러 사은품
  {
    partnerId: "jamsil-skmagic",
    title: "🎁 잠실 직영 단독 텀블러+보온병 세트",
    subtitle: "초소형 직수 정수기 가입 시 즉시 증정",
    bgColor1: "#EC4899", bgColor2: "#831843",
    ctaLabel: "받으러 가기",
    ctaHref: "/p/jamsil-skmagic/products/WPUJCC104SWH",
    startsAtOffsetH: 0, endsAtOffsetH: 30 * 24, priority: 10,
  },

  // 수원 — 진행중 매트리스 침구세트
  {
    partnerId: "suwon-life",
    title: "워커힐 매트리스 + 침구세트 풀패키지",
    subtitle: "수원 한정 ₩30,000 환원 — 5월 안에만 가능",
    bgColor1: "#2EAA5A", bgColor2: "#0F4E2E",
    ctaLabel: "패키지 보기",
    ctaHref: "/p/suwon-life/products/MATSM430RLWH",
    startsAtOffsetH: -3 * 24, endsAtOffsetH: 21 * 24, priority: 8,
  },

  // 광주 — 진행중 + 예약
  {
    partnerId: "gwangju-hq",
    title: "광주 본부 5월 한정 살균키트 2년분 증정",
    subtitle: "투워터 정수기 가입 시 ₩22,000 추가 환원",
    bgColor1: "#1F2937", bgColor2: "#111827", textColor: "#F9FAFB",
    ctaLabel: "지금 신청",
    ctaHref: "/p/gwangju-hq/products/WPUMAC306SWH",
    startsAtOffsetH: -5 * 24, endsAtOffsetH: 25 * 24, priority: 7,
  },

  // 대전 — 매트리스 토퍼
  {
    partnerId: "daejeon-mid",
    title: "대전 본점 매트리스 토퍼 ₩28,000 환원",
    bgColor1: "#F26A1F", bgColor2: "#831843",
    ctaLabel: "보러가기",
    ctaHref: "/p/daejeon-mid/products/MATSM230RSBR",
    startsAtOffsetH: 0, endsAtOffsetH: 14 * 24, priority: 6,
  },
];

async function main() {
  let created = 0, updated = 0;
  for (const s of SEEDS) {
    const startsAt = new Date(Date.now() + s.startsAtOffsetH * HOUR);
    const endsAt = new Date(Date.now() + s.endsAtOffsetH * HOUR);

    // 멱등성: 동일 (partnerId, title) 검색
    const existing = await prisma.banner.findFirst({
      where: { partnerId: s.partnerId, title: s.title },
    });
    if (existing) {
      await prisma.banner.update({
        where: { id: existing.id },
        data: {
          subtitle: s.subtitle ?? null,
          bgColor1: s.bgColor1, bgColor2: s.bgColor2,
          textColor: s.textColor ?? "#FFFFFF",
          ctaLabel: s.ctaLabel ?? null,
          ctaHref: s.ctaHref ?? null,
          startsAt, endsAt,
          priority: s.priority,
          status: "active",
        },
      });
      updated++;
    } else {
      await prisma.banner.create({
        data: {
          partnerId: s.partnerId,
          title: s.title,
          subtitle: s.subtitle ?? null,
          bgColor1: s.bgColor1, bgColor2: s.bgColor2,
          textColor: s.textColor ?? "#FFFFFF",
          ctaLabel: s.ctaLabel ?? null,
          ctaHref: s.ctaHref ?? null,
          startsAt, endsAt,
          priority: s.priority,
          status: "active",
        },
      });
      created++;
    }
  }

  console.log(`✅ 배너 시드 완료: 신규 ${created}건 / 갱신 ${updated}건`);

  // 요약
  const all = await prisma.banner.groupBy({
    by: ["partnerId"],
    where: { status: "active" },
    _count: { _all: true },
  });
  console.log(`\n협력점별 활성 배너:`);
  for (const r of all) {
    console.log(`  ${r.partnerId.padEnd(20)} ${r._count._all}건`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
