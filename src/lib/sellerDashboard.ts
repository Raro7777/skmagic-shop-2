import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { STATUS_LABEL as STATUS_LABEL_MAP, LEAD_STATUSES, type LeadStatus } from "./leadStatus";

const HOUR = 60 * 60 * 1000;

export type SellerKpi = {
  totalLeads: number;
  weekLeads: number;
  pendingNew: number;
  inProgress: number;
  doneThisMonth: number;
  expectedPayout: number;       // 이번 달 영업자수수료 합계 (Settlement.sellerPayout 누적)
  totalPayout: number;          // 누적 영업자수수료 (paid 만, 환수 영향 X)
  conversionRate: number;       // 전체 lead 중 설치완료(install_done 이상) 도달 비율 (0~100, %)
  closedLeads: number;          // 종료/취소 lead — 전환률 분모에서 제외 가능성 표기용
};

export type SellerLeadRow = {
  id: string;
  receivedAt: string;
  receivedNote: string;
  receivedNoteTone: "muted" | "warn" | "urgent";
  customerName: string;
  customerMeta: string;
  product: string;
  productCode: string | null;
  selectedMode: "방문형" | "셀프형" | null;
  selectedContractPeriod: number | null;
  selectedRentalPrice: number | null;
  rivalCompensationRequested: boolean;
  status: LeadStatus;
  statusLabel: string;
  // 환수 진행 여부 — 영업자에게는 표기만 (계약은 본사 ↔ 협력점)
  refundStatus: string | null;
  sellerPayout: number;        // 정산된 영업자수수료 (Settlement 가 있을 때)
};

export type SellerProfile = {
  id: string;
  sellerCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  partnerCode: string;
  partnerName: string;
  partnerHotline: string;
};

export type SellerDashboard = {
  profile: SellerProfile;
  kpi: SellerKpi;
  leads: SellerLeadRow[];
};

const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
function pad(n: number) { return n < 10 ? "0" + n : String(n); }
function maskPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length !== 11) return p;
  return `${d.slice(0, 3)}-${d[3]}***-${d.slice(7)}`;
}
function ageLabel(ms: number): { text: string; tone: "muted" | "warn" | "urgent" } {
  const min = Math.floor(ms / 60_000);
  if (min < 30) return { text: `⏱ ${min}분 경과`, tone: "warn" };
  if (min < 60) return { text: `⏱ ${min}분 경과`, tone: "urgent" };
  const hour = Math.floor(min / 60);
  if (hour < 12) return { text: `${hour}시간 전`, tone: "muted" };
  const day = Math.floor(hour / 24);
  if (day < 1) return { text: `${hour}시간 전`, tone: "muted" };
  return { text: `${day}일 전`, tone: "muted" };
}

export async function getSellerDashboard(userId: string): Promise<SellerDashboard | null> {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    include: {
      partner: { select: { partnerCode: true, partnerName: true, hotlineNumber: true } },
    },
  });
  if (!seller) return null;
  return getSellerDashboardBySellerRow(seller);
}

/** sellerId 직접 받는 변형 — hq/partner_admin 임시 진입(impersonation) 흐름용. */
export async function getSellerDashboardBySellerId(sellerId: string): Promise<SellerDashboard | null> {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    include: {
      partner: { select: { partnerCode: true, partnerName: true, hotlineNumber: true } },
    },
  });
  if (!seller) return null;
  return getSellerDashboardBySellerRow(seller);
}

type SellerWithPartner = Prisma.SellerGetPayload<{
  include: { partner: { select: { partnerCode: true; partnerName: true; hotlineNumber: true } } };
}>;

async function getSellerDashboardBySellerRow(seller: SellerWithPartner): Promise<SellerDashboard | null> {

  const startOfMonth = new Date();
  startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * HOUR);

  const [statusCounts, weekCount, totalCount, doneSettlements, totalPaidSettlements, recentLeads] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { sellerId: seller.id },
      _count: { _all: true },
    }),
    prisma.lead.count({ where: { sellerId: seller.id, createdAt: { gte: sevenDaysAgo } } }),
    prisma.lead.count({ where: { sellerId: seller.id } }),
    prisma.settlement.findMany({
      where: { lead: { sellerId: seller.id }, createdAt: { gte: startOfMonth } },
      select: { sellerPayout: true },
    }),
    // 누적 정산 — 송금 완료(paid) 만. cancelled 는 제외. 환수는 영업자 정산에 영향 없음.
    prisma.settlement.findMany({
      where: { lead: { sellerId: seller.id }, status: "paid" },
      select: { sellerPayout: true },
    }),
    prisma.lead.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // 영업자 lead 별 환수 진행 + 정산 결과 lookup (표기용)
  const recentLeadIds = recentLeads.map(l => l.id);
  const leadSettlements = recentLeadIds.length > 0
    ? await prisma.settlement.findMany({
        where: { leadId: { in: recentLeadIds } },
        select: { leadId: true, sellerPayout: true, refundStatus: true },
      })
    : [];
  const settlementByLead = new Map(leadSettlements.map(s => [s.leadId, s]));

  const countOf = (s: string) => statusCounts.find(r => r.status === s)?._count._all ?? 0;
  // 영업자 수수료 = Settlement.sellerPayout (영업점수수료 - 영업점마진).
  // 환원·환수는 영업점 책임이므로 영업자 표기에는 반영 안 함.
  const expectedPayout = doneSettlements.reduce((sum, s) => sum + s.sellerPayout, 0);
  const totalPayout = totalPaidSettlements.reduce((sum, s) => sum + s.sellerPayout, 0);

  // 진행 중 — consult_active 외에 신청서 작성/본사 검토/설치 대기 단계도 모두 진행으로 본다.
  const IN_PROGRESS_STATUSES = [
    "consult_active", "form_ready", "apply_submitted", "verify_pending",
    "verify_failed", "verify_revise", "revise_resubmit", "install_pending",
  ];
  const inProgressCount = IN_PROGRESS_STATUSES.reduce((s, st) => s + countOf(st), 0);

  // 전환률 = (install_done 이상 도달) / (종료 lead 제외 전체 모집단)
  // install_done · settle_pending · settle_done 은 모두 "설치 완료" 로 본다 (정산 단계는 후속).
  // 분모에서 consult_closed / install_cancel 제외 — 종료된 lead 는 영업자 통제 밖.
  const DONE_STATUSES = ["install_done", "settle_pending", "settle_done"];
  const CLOSED_STATUSES = ["consult_closed", "install_cancel"];
  const doneCount = DONE_STATUSES.reduce((s, st) => s + countOf(st), 0);
  const closedCount = CLOSED_STATUSES.reduce((s, st) => s + countOf(st), 0);
  const conversionDenom = totalCount - closedCount;
  const conversionRate = conversionDenom > 0
    ? Math.round((doneCount / conversionDenom) * 1000) / 10  // 소수점 한 자리 (예: 42.7%)
    : 0;

  const leads: SellerLeadRow[] = recentLeads.map(l => {
    const ageMs = Date.now() - l.createdAt.getTime();
    const age = ageLabel(ageMs);
    const isKnown = (LEAD_STATUSES as readonly string[]).includes(l.status);
    const stage = (isKnown ? l.status : "consult_wish") as LeadStatus;
    const settle = settlementByLead.get(l.id);
    return {
      id: l.id,
      receivedAt: fmtDate(l.createdAt),
      receivedNote: age.text,
      receivedNoteTone: age.tone,
      customerName: l.customerName,
      customerMeta: `${maskPhone(l.phoneRaw)}${l.region ? " · " + l.region : ""}`,
      product: l.productInterest,
      productCode: l.productCode,
      selectedMode: (l.selectedMode === "방문형" || l.selectedMode === "셀프형") ? l.selectedMode : null,
      selectedContractPeriod: l.selectedContractPeriod,
      selectedRentalPrice: l.selectedRentalPrice,
      rivalCompensationRequested: l.rivalCompensationRequested,
      status: stage,
      statusLabel: STATUS_LABEL_MAP[stage] ?? stage,
      refundStatus: settle?.refundStatus ?? null,
      sellerPayout: settle?.sellerPayout ?? 0,
    };
  });

  return {
    profile: {
      id: seller.id,
      sellerCode: seller.sellerCode,
      name: seller.name,
      phone: seller.phone,
      email: seller.email,
      partnerCode: seller.partner.partnerCode,
      partnerName: seller.partner.partnerName,
      partnerHotline: seller.partner.hotlineNumber,
    },
    kpi: {
      totalLeads: totalCount,
      weekLeads: weekCount,
      pendingNew: countOf("consult_wish"),
      inProgress: inProgressCount,
      doneThisMonth: doneSettlements.length,
      expectedPayout,
      totalPayout,
      conversionRate,
      closedLeads: closedCount,
    },
    leads,
  };
}
