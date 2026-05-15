import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUseFeature } from "@/lib/tier";
import { gatePartnerOrHq } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type DisplayConfig = {
  picks: string[];                   // productCode 배열 (점장 추천)
  ranking: Record<string, string[]>; // category → productCode[]
  flagshipBannerEnabled?: boolean;   // 메인 페이지 캐시백 띠 자동 노출 여부 (default true)
  heroAutoSlidesEnabled?: boolean;   // hero 캐러셀의 자동 상품 슬라이드 노출 여부 (default true)
  hqCampaignBannerEnabled?: boolean; // 본사 공식 캠페인 배너 (5월 ICE IS MAGIC 등) 노출 여부 (default true)
};

const VALID_CATEGORIES = ["water", "air", "bidet", "mattress", "dryer", "kitchen", "massage"];

function sanitize(input: unknown): DisplayConfig {
  const result: DisplayConfig = { picks: [], ranking: {} };
  if (!input || typeof input !== "object") return result;
  const i = input as { picks?: unknown; ranking?: unknown; flagshipBannerEnabled?: unknown };
  if (Array.isArray(i.picks)) {
    result.picks = i.picks
      .filter((x): x is string => typeof x === "string" && /^[A-Z][A-Z0-9-]{6,}$/.test(x))
      .slice(0, 12);
  }
  if (i.ranking && typeof i.ranking === "object" && !Array.isArray(i.ranking)) {
    for (const [cat, codes] of Object.entries(i.ranking as Record<string, unknown>)) {
      if (!VALID_CATEGORIES.includes(cat)) continue;
      if (!Array.isArray(codes)) continue;
      result.ranking[cat] = codes
        .filter((x): x is string => typeof x === "string" && /^[A-Z][A-Z0-9-]{6,}$/.test(x))
        .slice(0, 8);
    }
  }
  if (typeof i.flagshipBannerEnabled === "boolean") {
    result.flagshipBannerEnabled = i.flagshipBannerEnabled;
  }
  if (typeof (i as { heroAutoSlidesEnabled?: unknown }).heroAutoSlidesEnabled === "boolean") {
    result.heroAutoSlidesEnabled = (i as { heroAutoSlidesEnabled: boolean }).heroAutoSlidesEnabled;
  }
  if (typeof (i as { hqCampaignBannerEnabled?: unknown }).hqCampaignBannerEnabled === "boolean") {
    result.hqCampaignBannerEnabled = (i as { hqCampaignBannerEnabled: boolean }).hqCampaignBannerEnabled;
  }
  return result;
}

export async function GET() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  const partner = await prisma.partner.findUnique({
    where: { partnerCode: eff.partnerId },
    select: { displayConfig: true },
  });

  // 사용 가능한 active product 목록 (UI 좌측 패널용)
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: { productCode: true, name: true, modelName: true, category: true, imageUrl: true, imageUrls: true, rentalPrice: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    config: sanitize(partner?.displayConfig),
    products: products.map(p => ({
      productCode: p.productCode,
      name: p.name,
      modelName: p.modelName,
      category: p.category,
      imageUrl: p.imageUrls?.[0] ?? p.imageUrl ?? null,
      rentalPrice: p.rentalPrice,
    })),
  });
}

export async function PATCH(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

  // Tier 검사 — standard 이상만
  const partner = await prisma.partner.findUnique({
    where: { partnerCode: eff.partnerId },
    select: { tier: true },
  });
  if (!canUseFeature(partner?.tier ?? "basic", "display_drag")) {
    return NextResponse.json(
      { error: "상품 진열 편집은 스탠다드 패키지 이상에서 사용 가능합니다." },
      { status: 403 },
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 부분 업데이트 지원 — 기존 displayConfig 와 병합. body 에 없는 필드는 보존.
  const current = await prisma.partner.findUnique({
    where: { partnerCode: eff.partnerId },
    select: { displayConfig: true },
  });
  const merged = sanitize({ ...sanitize(current?.displayConfig), ...(body as object) });

  await prisma.partner.update({
    where: { partnerCode: eff.partnerId },
    data: { displayConfig: merged as never },
  });

  return NextResponse.json({ ok: true, config: merged });
}
