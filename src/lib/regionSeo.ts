import { prisma } from "./prisma";
import type { ConsumerProduct } from "./partnerSite";

/**
 * 지역 SEO landing — 룰북 5.3.
 *
 * URL: /region/[regionSlug]              — 시·도/구 단위
 *      /region/[regionSlug]/[category]   — 지역 + 카테고리 결합
 *
 * regionSlug 예: "seoul-gangnam-gu", "incheon-namdong-gu", "gyeonggi-bucheon", "all".
 *
 * 매칭: 활성 협력점의 partner.region 텍스트를 한국어→roman/slug 변환해 fuzzy 비교.
 */

export type RegionEntry = {
  slug: string;
  label: string;        // 표기용 한글
  shortLabel: string;   // 메타에 들어가는 짧은 이름 (예: "강남구")
  partners: Array<{ partnerCode: string; partnerName: string; region: string | null; brandLabel: string }>;
};

const CATEGORY_LABEL: Record<string, string> = {
  water:    "정수기",
  air:      "공기청정기",
  bidet:    "비데",
  mattress: "매트리스",
  massage:  "안마의자",
  dryer:    "건조기",
  kitchen:  "주방가전",
};

// 한국어 region(예: "서울 강남구") → SEO 친화적 slug
//  공백 → "-", 한국어→로마자 단순 매핑 (시·도 단위만)
const SI_DO_MAP: Array<[RegExp, string]> = [
  [/^서울/, "seoul"],
  [/^부산/, "busan"],
  [/^대구/, "daegu"],
  [/^인천/, "incheon"],
  [/^광주/, "gwangju"],
  [/^대전/, "daejeon"],
  [/^울산/, "ulsan"],
  [/^세종/, "sejong"],
  [/^경기/, "gyeonggi"],
  [/^강원/, "gangwon"],
  [/^충북/, "chungbuk"],
  [/^충남/, "chungnam"],
  [/^전북/, "jeonbuk"],
  [/^전남/, "jeonnam"],
  [/^경북/, "gyeongbuk"],
  [/^경남/, "gyeongnam"],
  [/^제주/, "jeju"],
];

const DISTRICT_KO_TO_EN: Record<string, string> = {
  강남구: "gangnam-gu",   서초구: "seocho-gu",     송파구: "songpa-gu",
  강서구: "gangseo-gu",   강동구: "gangdong-gu",
  중구: "jung-gu",        종로구: "jongno-gu",     마포구: "mapo-gu",
  영통구: "yeongtong-gu", 분당구: "bundang-gu",    부천시: "bucheon",
  남동구: "namdong-gu",   서구: "seo-gu",          중원구: "jungwon-gu",
};

/** 한글 region을 SEO slug로 변환 ("서울 강남구" → "seoul-gangnam-gu") */
export function regionToSlug(region: string): string {
  const [siDo, ...rest] = region.trim().split(/\s+/);
  let slug = "";
  for (const [re, en] of SI_DO_MAP) {
    if (re.test(siDo)) { slug = en; break; }
  }
  if (!slug) slug = siDo.toLowerCase().replace(/[^a-z]/g, "");
  for (const part of rest) {
    const cleaned = part.replace(/[\s시군]/g, "");
    const en = DISTRICT_KO_TO_EN[part] ?? DISTRICT_KO_TO_EN[cleaned];
    if (en) slug += "-" + en;
    else if (/^[a-zA-Z0-9-]+$/.test(part)) slug += "-" + part.toLowerCase();
    else slug += "-" + encodeURIComponent(part).toLowerCase().replace(/%/g, "");
  }
  return slug;
}

/** slug → 협력점 매칭. exact 우선, fallback은 시·도 부분 매칭 */
export async function findRegion(regionSlug: string): Promise<RegionEntry | null> {
  const partners = await prisma.partner.findMany({
    where: { status: "active" },
    select: { partnerCode: true, partnerName: true, region: true, brandLabel: true },
  });

  // 정확 매칭
  const exact = partners.filter(p => p.region && regionToSlug(p.region) === regionSlug);
  if (exact.length > 0) {
    const sample = exact[0].region!;
    return {
      slug: regionSlug,
      label: sample,
      shortLabel: sample.split(/\s+/).slice(-1)[0] ?? sample,
      partners: exact,
    };
  }

  // 시·도 부분 매칭 (예: regionSlug="seoul"이면 "서울 *" 모두 포함)
  const siDoOnly = regionSlug.split("-")[0];
  const siDoKr = SI_DO_MAP.find(([, en]) => en === siDoOnly)?.[0];
  if (siDoKr) {
    const partial = partners.filter(p => p.region && siDoKr.test(p.region));
    if (partial.length > 0) {
      const ko = ([
        ["seoul","서울"], ["busan","부산"], ["daegu","대구"], ["incheon","인천"],
        ["gwangju","광주"], ["daejeon","대전"], ["ulsan","울산"], ["sejong","세종"],
        ["gyeonggi","경기"], ["gangwon","강원"], ["chungbuk","충북"], ["chungnam","충남"],
        ["jeonbuk","전북"], ["jeonnam","전남"], ["gyeongbuk","경북"], ["gyeongnam","경남"],
        ["jeju","제주"],
      ] as const).find(([s]) => s === siDoOnly)?.[1] ?? siDoOnly;
      return {
        slug: regionSlug,
        label: ko,
        shortLabel: ko,
        partners: partial,
      };
    }
  }
  return null;
}

/** 모든 활성 region slug (sitemap용) */
export async function listAllRegionSlugs(): Promise<RegionEntry[]> {
  const partners = await prisma.partner.findMany({
    where: { status: "active" },
    select: { partnerCode: true, partnerName: true, region: true, brandLabel: true },
  });
  const map = new Map<string, RegionEntry>();
  for (const p of partners) {
    if (!p.region) continue;
    const slug = regionToSlug(p.region);
    const cur = map.get(slug);
    if (cur) cur.partners.push(p);
    else map.set(slug, {
      slug,
      label: p.region,
      shortLabel: p.region.split(/\s+/).slice(-1)[0] ?? p.region,
      partners: [p],
    });
  }
  return [...map.values()];
}

/** 카테고리 라벨 */
export function categoryLabel(cat: string): string {
  return CATEGORY_LABEL[cat] ?? cat;
}

/** 지역 + 카테고리 추천 상품 — 활성 상품 중 카테고리 일치, 평점 + 사은품 차별화 우선 */
export async function listRegionRecommendedProducts(
  category: string | null,
  partnerCode: string,
  limit = 6,
): Promise<ConsumerProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      status: "active",
      ...(category && { category }),
    },
    include: { partnerPolicies: { where: { partnerId: partnerCode } } },
    orderBy: [{ isFeatured: "desc" }, { rentalPrice: "asc" }],
    take: limit,
  });
  return products.map(p => {
    const policy = p.partnerPolicies[0];
    return {
      productCode: p.productCode,
      category: p.category,
      name: p.name,
      modelName: p.modelName,
      rentalPrice: p.rentalPrice,
      cardDiscountPrice: p.cardDiscountPrice != null && p.cardDiscountPrice < p.rentalPrice ? p.cardDiscountPrice : null,
      contractPeriod: p.contractPeriod,
      managementType: p.managementType,
      isFeatured: p.isFeatured,
      imageUrl: p.imageUrls?.[0] ?? p.imageUrl ?? null,
      giftAmount: policy?.giftAmount ?? 0,
      giftLabel: policy?.giftLabel ?? null,
      installFreed: (policy?.installAmount ?? 0) > 0,
      maxRentalSupport: 0,
      maxRivalSavings: 0, // 지역 SEO 진입 화면은 메인 카드 표기 없음
    };
  });
}
