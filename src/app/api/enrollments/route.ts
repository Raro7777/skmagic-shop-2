import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { viewForRole } from "@/lib/enrollmentForm";
import { STATUS_LABEL, type LeadStatus, type ActorRole } from "@/lib/leadStatus";
import { HQ_VIEW_COOKIE } from "@/lib/effectivePartner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 가입 신청서 목록 — 역할별 자동 스코프.
 *  - seller: 본인 seller.id 의 lead 만
 *  - partner_admin: 자기 partnerId 의 lead 만
 *  - hq: 전체
 *
 * Query:
 *   ?status=form_ready,apply_submitted  필터
 *   ?partnerId=<code>                   본사 전용 협력점 필터
 *   ?q=<keyword>                        고객명 검색
 *   ?limit=50&offset=0
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  let actorRole: ActorRole;
  if (role === "hq") actorRole = "hq";
  else if (role === "partner_admin") actorRole = "partner_admin";
  else if (role === "seller") actorRole = "seller";
  else return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const partnerFilter = url.searchParams.get("partnerId");
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));

  type WhereLead = {
    partnerId?: string;
    sellerId?: string;
    status?: { in: string[] };
    customerName?: { contains: string };
  };
  const where: WhereLead = {};

  if (actorRole === "partner_admin") {
    if (!session.user.partnerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    where.partnerId = session.user.partnerId;
  } else if (actorRole === "seller") {
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    where.sellerId = seller.id;
  } else if (partnerFilter) {
    where.partnerId = partnerFilter;
  } else {
    // hq + 협력점 콘솔 진입 시 cookie scope
    const c = await cookies();
    const cookieVal = c.get(HQ_VIEW_COOKIE)?.value;
    const referer = req.headers.get("referer") ?? "";
    if (cookieVal && referer.includes("/admin/franchise")) {
      where.partnerId = cookieVal;
    }
  }

  if (statusParam) {
    const list = statusParam.split(",").map(s => s.trim()).filter(Boolean);
    if (list.length > 0) where.status = { in: list };
  }
  if (q) where.customerName = { contains: q };

  // EnrollmentForm 이 있는 lead 만 노출
  const forms = await prisma.enrollmentForm.findMany({
    where: { lead: where as never },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      lead: {
        select: {
          id: true, status: true, partnerId: true, sellerId: true, createdAt: true,
          partner: { select: { partnerName: true } },
          seller:  { select: { sellerCode: true, name: true } },
        },
      },
    },
  });

  const total = await prisma.enrollmentForm.count({ where: { lead: where as never } });

  const items = forms.map(f => {
    const masked = viewForRole(f, { actorRole, actorId: session.user.id ?? null });
    return {
      id: f.id,
      leadId: f.leadId,
      leadStatus: f.lead.status,
      leadStatusLabel: STATUS_LABEL[f.lead.status as LeadStatus] ?? f.lead.status,
      leadCreatedAt: f.lead.createdAt.toISOString(),
      partnerId: f.lead.partnerId,
      partnerName: f.lead.partner?.partnerName ?? null,
      sellerCode: f.lead.seller?.sellerCode ?? null,
      sellerName: f.lead.seller?.name ?? null,
      customerName: f.customerName,
      residentRegNumber: masked!.residentRegNumber,
      phone: f.phone,
      address: f.address,
      productCode: f.productCode,
      productName: f.productName,
      managementMode: f.managementMode,
      contractPeriod: f.contractPeriod,
      monthlyPrice: f.monthlyPrice,
      isRivalCompensation: f.isRivalCompensation,
      selectedColor: f.selectedColor,
      paymentDayType: f.paymentDayType,
      paymentDayValue: f.paymentDayValue,
      installSchedule: f.installSchedule,
      autoDebitBank: f.autoDebitBank,
      autoDebitAccount: masked!.autoDebitAccount,
      autoDebitHolder: f.autoDebitHolder,
      giftBank: f.giftBank,
      giftAccount: masked!.giftAccount,
      giftHolder: f.giftHolder,
      lockedAt: f.lockedAt?.toISOString() ?? null,
      createdByRole: f.createdByRole,
      updatedAt: f.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ total, items, actorRole });
}
