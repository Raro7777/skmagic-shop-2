import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { captureLead, maskPhone } from "@/lib/leadStore";
import { rateLimit } from "@/lib/rateLimit";
import { HQ_VIEW_COOKIE } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST is public — anyone (anonymous consumer) can submit a lead.
export async function POST(req: Request) {
  // 봇/스팸 방지: IP당 60초 10건
  const rl = rateLimit(req, "lead:anon", { windowMs: 60_000, max: 10 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `요청이 너무 많습니다. ${rl.retryAfterSec}초 후 다시 시도해주세요.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Partial<{
    customerName: string;
    phone: string;
    productInterest: string;
    productCode: string | null;
    region: string;
    partnerId: string;
    sellerCode: string;
    landingType: "consumer_partner" | "consumer_seller" | "region" | "main";
    utm: {
      source?: string;
      medium?: string;
      campaign?: string;
      content?: string;
      term?: string;
      referrer?: string;
      landingPath?: string;
      deviceType?: string;
    };
    // PriceConfigurator 선택 옵션
    selectedMode: "방문형" | "셀프형" | null;
    selectedContractPeriod: number;
    selectedRentalPrice: number;
    selectedCardDiscountPrice: number | null;
    rivalCompensationRequested: boolean;
    selectedColor: string | null;
  }>;

  if (!b.customerName?.trim() || !b.phone?.trim() || !b.productInterest?.trim()) {
    return NextResponse.json({ error: "필수 항목 누락 (이름·휴대폰·관심상품)" }, { status: 400 });
  }
  const phoneDigits = b.phone.replace(/\D/g, "");
  if (phoneDigits.length !== 11 || !phoneDigits.startsWith("010")) {
    return NextResponse.json({ error: "유효하지 않은 휴대폰 번호 (010 11자리)" }, { status: 400 });
  }

  // 옵션 검증/sanitize
  const selectedMode = b.selectedMode === "방문형" || b.selectedMode === "셀프형" ? b.selectedMode : null;
  const selectedContractPeriod = typeof b.selectedContractPeriod === "number"
    && [36, 48, 60, 72, 84].includes(b.selectedContractPeriod)
      ? b.selectedContractPeriod
      : undefined;
  const selectedRentalPrice = typeof b.selectedRentalPrice === "number" && b.selectedRentalPrice > 0
    ? Math.floor(b.selectedRentalPrice)
    : undefined;
  const selectedCardDiscountPrice = typeof b.selectedCardDiscountPrice === "number" && b.selectedCardDiscountPrice > 0
    ? Math.floor(b.selectedCardDiscountPrice)
    : null;

  const lead = await captureLead({
    customerName: b.customerName,
    phone: phoneDigits,
    productInterest: b.productInterest,
    productCode: b.productCode ?? null,
    region: b.region ?? "",
    ownership: {
      landingType: b.landingType ?? "consumer_partner",
      partnerId: b.partnerId ?? "gangnam-skmagic",
      sellerCode: b.sellerCode,
    },
    utm: b.utm,
    selectedMode,
    selectedContractPeriod,
    selectedRentalPrice,
    selectedCardDiscountPrice,
    rivalCompensationRequested: !!b.rivalCompensationRequested,
    selectedColor: typeof b.selectedColor === "string" ? b.selectedColor.slice(0, 80) : null,
  });

  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    assignedPartnerId: lead.partnerId,
    ownerType: lead.ownerType,
    message:
      lead.ownerType === "partner"
        ? "상담 신청 접수됐습니다. 담당 협력점에서 30분 이내 연락드립니다."
        : "상담 신청 접수됐습니다. 본사가 담당 영업점을 배정해드립니다.",
  });
}

// GET requires auth. Partner admins see their own leads; HQ sees all (or — when impersonating a partner via hq_view_partner cookie — that partner's leads only).
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  const partnerId = session.user.partnerId;

  if (role !== "hq" && (role !== "partner_admin" || !partnerId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // HQ impersonation: if `hq_view_partner` cookie is set, scope to that partner (협력점 콘솔에서 호출 시).
  let effectivePartnerId: string | null = null;
  if (role === "partner_admin") {
    effectivePartnerId = partnerId!;
  } else if (role === "hq") {
    const c = await cookies();
    const cookieVal = c.get(HQ_VIEW_COOKIE)?.value;
    // 협력점 콘솔에서 호출됐을 때만 scope 적용 (Referer 기반 판단)
    const referer = req.headers.get("referer") ?? "";
    if (cookieVal && referer.includes("/admin/franchise")) {
      effectivePartnerId = cookieVal;
    }
  }

  const where = effectivePartnerId ? { partnerId: effectivePartnerId } : {};
  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: effectivePartnerId ? 10 : 20,
    include: { seller: { select: { name: true, sellerCode: true } } },
  });

  // Always mask phone in list view per rulebook A3.
  const projected = leads.map(l => ({
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    customerName: l.customerName,
    phoneMasked: maskPhone(l.phoneRaw),
    productInterest: l.productInterest,
    region: l.region ?? "",
    status: l.status,
    duplicateStatus: l.duplicateStatus,
    seller: l.seller ? { name: l.seller.name, sellerCode: l.seller.sellerCode } : null,
    minutesAgo: Math.max(0, Math.floor((Date.now() - l.createdAt.getTime()) / 60000)),
  }));

  return NextResponse.json({
    leads: projected,
    count: projected.length,
    viewer: { role, partnerId: effectivePartnerId ?? partnerId },
  });
}
