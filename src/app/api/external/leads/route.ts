import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureLead } from "@/lib/leadStore";
import { authenticateApiPartner, apiHeaders } from "@/lib/apiPartnerAuth";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/external/leads
 *   외부 사이트가 자기 페이지에서 받은 신청을 본사에 넘김.
 *   본사가 직접 처리(hq_pool) → 본사 직영 매장 또는 가까운 협력점에 재배정.
 *
 * 인증: Authorization: Bearer <apiKey>
 * Body:
 *   {
 *     customerName, phone, productInterest, productCode?, region?,
 *     selectedMode?, selectedContractPeriod?,
 *     utm? (선택)
 *   }
 */
export async function POST(req: Request) {
  // IP당 분당 30건 (외부 사이트의 봇 폭주 차단)
  const rl = rateLimit(req, "external:leads", { windowMs: 60_000, max: 30 });
  if (!rl.ok) {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests", retryAfter: rl.retryAfterSec }),
      { status: 429, headers: { ...apiHeaders(), "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const partner = await authenticateApiPartner(req);
  if (!partner) {
    return new NextResponse(
      JSON.stringify({ error: "Unauthorized — Authorization: Bearer <apiKey> 필요" }),
      { status: 401, headers: apiHeaders() },
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return new NextResponse(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: apiHeaders() },
    );
  }
  const b = body as Partial<{
    customerName: string;
    phone: string;
    productInterest: string;
    productCode: string | null;
    region: string;
    selectedMode: "방문형" | "셀프형" | null;
    selectedContractPeriod: number;
    selectedRentalPrice: number;
    selectedCardDiscountPrice: number | null;
    rivalCompensationRequested: boolean;
    utm: Record<string, string>;
  }>;

  if (!b.customerName?.trim() || !b.phone?.trim() || !b.productInterest?.trim()) {
    return new NextResponse(
      JSON.stringify({ error: "필수: customerName, phone, productInterest" }),
      { status: 400, headers: apiHeaders() },
    );
  }
  const phoneDigits = b.phone.replace(/\D/g, "");
  if (phoneDigits.length !== 11 || !phoneDigits.startsWith("010")) {
    return new NextResponse(
      JSON.stringify({ error: "phone은 010으로 시작하는 11자리여야 합니다." }),
      { status: 400, headers: apiHeaders() },
    );
  }

  // 카테고리 권한 검사 (productCode가 카테고리 제한에 걸리는지)
  if (b.productCode && partner.allowedCategories.length > 0) {
    const product = await prisma.product.findUnique({
      where: { productCode: b.productCode },
      select: { category: true },
    });
    if (product && !partner.allowedCategories.includes(product.category)) {
      return new NextResponse(
        JSON.stringify({ error: `이 API 키는 카테고리 '${product.category}'에 접근 권한이 없습니다.` }),
        { status: 403, headers: apiHeaders() },
      );
    }
  }

  // 옵션 검증/sanitize
  const selectedMode = b.selectedMode === "방문형" || b.selectedMode === "셀프형" ? b.selectedMode : null;
  const selectedContractPeriod = typeof b.selectedContractPeriod === "number"
    && [36, 48, 60, 72, 84].includes(b.selectedContractPeriod)
      ? b.selectedContractPeriod
      : undefined;

  // captureLead — 외부 채널은 ownership을 hq_pool에 두고 본사가 분배
  const lead = await captureLead({
    customerName: b.customerName,
    phone: phoneDigits,
    productInterest: b.productInterest,
    productCode: b.productCode ?? null,
    region: b.region ?? "",
    ownership: {
      // landingType=main → decideOwnership에서 hq_pool로 자동 분류
      landingType: "main",
    },
    utm: {
      source: partner.slug,
      medium: "api",
      campaign: b.utm?.campaign,
      content: b.utm?.content,
      term: b.utm?.term,
      referrer: b.utm?.referrer,
      landingPath: b.utm?.landingPath,
      deviceType: b.utm?.deviceType,
    },
    selectedMode,
    selectedContractPeriod,
    selectedRentalPrice: typeof b.selectedRentalPrice === "number" && b.selectedRentalPrice > 0
      ? Math.floor(b.selectedRentalPrice) : undefined,
    selectedCardDiscountPrice: typeof b.selectedCardDiscountPrice === "number" && b.selectedCardDiscountPrice > 0
      ? Math.floor(b.selectedCardDiscountPrice) : null,
    rivalCompensationRequested: !!b.rivalCompensationRequested,
  });

  // 외부 채널 정보 추가 기록 (source, externalChannel)
  await prisma.lead.update({
    where: { id: lead.id },
    data: { source: "api_partner", externalChannel: partner.slug },
  });

  // 통계 — 실패해도 응답 영향 X, Vercel Logs 에 흔적만
  prisma.apiPartner
    .update({ where: { id: partner.id }, data: { totalLeads: { increment: 1 } } })
    .catch(e => { console.error("[external/leads] stat update failed:", e instanceof Error ? e.message : e); });

  return new NextResponse(
    JSON.stringify({
      ok: true,
      leadId: lead.id,
      ownerType: lead.ownerType,
      message: "신청 접수됐습니다. 본사가 30분 이내 연락드립니다.",
    }),
    { status: 200, headers: apiHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiHeaders() });
}
