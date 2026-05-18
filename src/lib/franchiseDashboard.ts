import { prisma } from "./prisma";
import { STATUS_LABEL, type LeadStatus } from "./leadStatus";

const HOUR = 60 * 60 * 1000;

// ─── 5-phase 그룹 (KPI 칸 용) ───
const CONSULT_STATUSES: LeadStatus[]    = ["consult_wish", "consult_active"];
const PENDING_HQ_STATUSES: LeadStatus[] = ["apply_submitted", "verify_pending", "verify_passed", "install_pending"];
const RESPOND_STATUSES: LeadStatus[]    = ["verify_failed", "verify_revise", "revise_resubmit"]; // 협력점 회신 필요
const DONE_STATUSES: LeadStatus[]       = ["install_done", "settle_pending", "settle_done"];
const CLOSED_STATUSES: LeadStatus[]     = ["consult_closed", "install_cancel"];

export type StageKey = "consult" | "pending_hq" | "respond" | "done" | "closed" | "weekTotal";

export type PipelineStage = {
  key: StageKey;
  label: string;
  hint: string;
  count: number;
  tone: "consult" | "pending_hq" | "respond" | "done" | "closed" | "neutral";
};

export type PipelineRow = {
  id: string;
  receivedAt: string;
  receivedNote: string;
  receivedNoteTone: "muted" | "warn" | "urgent";
  customerName: string;
  customerMeta: string;
  product: string;
  productCode: string | null;
  giftLabel: string | null;
  giftAmount: number;
  rentalPrice: number | null;
  installScheduleLabel: string;
  installScheduleTone: "muted" | "warn" | "default";
  stage: LeadStatus;
  stageLabel: string;
  rowTone?: "active" | "respond" | "fade";
  /** 액션 버튼이 있는 경우 라벨 / 누를 시 보낼 next status. 없으면 null (pill만 표시). */
  action: { label: string; toStatus: LeadStatus; tone: "orange" | "navy" | "ghost" | "sale" } | null;
  /** 보조 액션 (예: 상담중에서 종료 옵션) */
  secondaryAction: { label: string; toStatus: LeadStatus; tone: "orange" | "navy" | "ghost" | "sale" } | null;
  selectedMode: "방문형" | "셀프형" | null;
  selectedContractPeriod: number | null;
  selectedRentalPrice: number | null;
  rivalCompensationRequested: boolean;
  /** 신청서 모달 prefill — 자기 점 lead 한정 원본 데이터 */
  enrollmentPrefill: {
    customerName: string;
    phone: string;
    productCode: string;
    productName: string;
    managementMode: "방문형" | "셀프형" | null;
    contractPeriod: number;
    visitInterval: string | null;
    monthlyPrice: number;
    isRivalCompensation: boolean;
    giftAmount: number;
    giftLabel: string | null;
  };
};

export type PipelineSnapshot = {
  partnerName: string;
  weekTotal: number;
  stages: PipelineStage[];
  rows: PipelineRow[];
};

const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
function pad(n: number) { return n < 10 ? "0" + n : String(n); }
function maskPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  if (digits.length !== 11) return p;
  return `${digits.slice(0, 3)}-${digits[3]}***-${digits.slice(7)}`;
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

function actionFor(status: LeadStatus): PipelineRow["action"] {
  switch (status) {
    case "consult_wish":    return { label: "📞 상담 시작",     toStatus: "consult_active",  tone: "orange" };
    // consult_active 단계는 신청서 작성 → form_ready 로 진입 (모달 트리거)
    case "consult_active":  return { label: "📝 신청서 작성",   toStatus: "form_ready",      tone: "navy"   };
    // form_ready 단계는 본사 제출 (자동 chain → verify_pending)
    case "form_ready":      return { label: "📤 본사 제출",     toStatus: "apply_submitted", tone: "orange" };
    // 본사 회송 (verify_failed/verify_revise) → 모달 직행 → 저장 시 enrollment route 가
    // 자동으로 apply_submitted 로 전이 (→ verify_pending 큐 재투입).
    case "verify_failed":   return { label: "📝 수정 후 재제출", toStatus: "form_ready",      tone: "orange" };
    case "verify_revise":   return { label: "📝 수정 후 재제출", toStatus: "form_ready",      tone: "orange" };
    // 회신만 보낸 뒤에는 곧장 재제출 가능 (apply_submitted → 자동 chain verify_pending).
    case "revise_resubmit": return { label: "📤 재제출",         toStatus: "apply_submitted", tone: "orange" };
    default: return null;
  }
}

function secondaryFor(status: LeadStatus): PipelineRow["secondaryAction"] {
  if (status === "consult_wish" || status === "consult_active") {
    return { label: "❌ 종료", toStatus: "consult_closed", tone: "ghost" };
  }
  // form_ready 행에 "✎ 수정" 보조 액션 — 같은 status 로 유지(모달만 다시 열기)
  if (status === "form_ready") {
    return { label: "✎ 신청서 수정", toStatus: "form_ready", tone: "ghost" };
  }
  // 본사 회송 상태에서 "회신만" 옵션 — 신청서 수정 없이 메모만 (revise_resubmit 로 전이)
  if (status === "verify_failed" || status === "verify_revise") {
    return { label: "↩ 회신만", toStatus: "revise_resubmit", tone: "ghost" };
  }
  // 회신 작성한 뒤에도 신청서 수정 가능 (form_ready 모달 → 저장 시 apply_submitted 자동 전이)
  if (status === "revise_resubmit") {
    return { label: "📝 신청서 보완", toStatus: "form_ready", tone: "ghost" };
  }
  return null;
}

export async function getOrderPipeline(partnerId: string): Promise<PipelineSnapshot> {
  const [partner, statusCounts, weekCount, recentLeads] = await Promise.all([
    prisma.partner.findUnique({ where: { partnerCode: partnerId }, select: { partnerName: true } }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { partnerId },
      _count: { _all: true },
    }),
    prisma.lead.count({
      where: { partnerId, createdAt: { gte: new Date(Date.now() - 7 * 24 * HOUR) } },
    }),
    prisma.lead.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { settlement: true },
    }),
  ]);

  const countIn = (set: LeadStatus[]) =>
    statusCounts
      .filter(r => set.includes(r.status as LeadStatus))
      .reduce((s, r) => s + r._count._all, 0);

  const productCodes = Array.from(new Set(recentLeads.map(l => l.productCode).filter((x): x is string => !!x)));
  const partnerPolicies = productCodes.length > 0
    ? await prisma.partnerPolicy.findMany({
        where: { partnerId, product: { productCode: { in: productCodes } } },
        include: { product: { select: { productCode: true, rentalPrice: true } } },
      })
    : [];
  const policyByCode = new Map(partnerPolicies.map(pp => [pp.product.productCode, pp]));

  const rows: PipelineRow[] = recentLeads.map(l => {
    const ageMs = Date.now() - l.createdAt.getTime();
    const age = ageLabel(ageMs);
    const policy = l.productCode ? policyByCode.get(l.productCode) : null;
    const stage = l.status as LeadStatus;
    const stageLabel = STATUS_LABEL[stage] ?? stage;

    let rowTone: PipelineRow["rowTone"];
    if (RESPOND_STATUSES.includes(stage)) rowTone = "respond";
    else if (stage === "consult_wish" && ageMs > 30 * 60 * 1000) rowTone = "active";
    else if (DONE_STATUSES.includes(stage) || CLOSED_STATUSES.includes(stage)) rowTone = "fade";

    let installScheduleLabel = "—";
    let installScheduleTone: PipelineRow["installScheduleTone"] = "muted";
    if (l.settlement && l.settlement.status !== "cancelled") {
      installScheduleLabel = fmtDate(l.settlement.createdAt);
      installScheduleTone = "default";
    } else if (stage === "install_pending") {
      installScheduleLabel = "본사 설치 일정 확정 중";
      installScheduleTone = "muted";
    } else if (stage === "consult_active") {
      installScheduleLabel = "상담 중";
      installScheduleTone = "muted";
    } else if (RESPOND_STATUSES.includes(stage)) {
      installScheduleLabel = "회신 필요";
      installScheduleTone = "warn";
    }

    const selectedRentalPrice = l.selectedRentalPrice ?? null;
    const displayRental = selectedRentalPrice ?? policy?.product.rentalPrice ?? null;

    return {
      id: l.id,
      receivedAt: fmtDate(l.createdAt),
      receivedNote: age.text,
      receivedNoteTone: age.tone,
      customerName: l.customerName,
      customerMeta: `${maskPhone(l.phoneRaw)}${l.region ? " · " + l.region : ""}`,
      product: l.productInterest,
      productCode: l.productCode,
      giftLabel: policy?.giftLabel ?? null,
      giftAmount: policy?.giftAmount ?? 0,
      rentalPrice: displayRental,
      installScheduleLabel,
      installScheduleTone,
      stage,
      stageLabel,
      rowTone,
      action: actionFor(stage),
      secondaryAction: secondaryFor(stage),
      selectedMode: (l.selectedMode === "방문형" || l.selectedMode === "셀프형") ? l.selectedMode : null,
      selectedContractPeriod: l.selectedContractPeriod,
      selectedRentalPrice,
      rivalCompensationRequested: l.rivalCompensationRequested,
      enrollmentPrefill: {
        customerName: l.customerName,
        phone: l.phoneRaw,
        productCode: l.productCode ?? "",
        productName: l.productInterest,
        managementMode: (l.selectedMode === "방문형" || l.selectedMode === "셀프형") ? l.selectedMode : null,
        contractPeriod: l.selectedContractPeriod ?? 60,
        visitInterval: null,
        monthlyPrice: displayRental ?? 0,
        isRivalCompensation: l.rivalCompensationRequested,
        giftAmount: policy?.giftAmount ?? 0,
        giftLabel: policy?.giftLabel ?? null,
      },
    };
  });

  const stages: PipelineStage[] = [
    { key: "consult",    label: "상담",          hint: "상담희망 + 상담중",          count: countIn(CONSULT_STATUSES),    tone: "consult"    },
    { key: "pending_hq", label: "본사 처리",     hint: "신청완료 ~ 설치대기",        count: countIn(PENDING_HQ_STATUSES), tone: "pending_hq" },
    { key: "respond",    label: "회신 필요",     hint: "인증실패 / 수정요청 / 회신",  count: countIn(RESPOND_STATUSES),    tone: "respond"    },
    { key: "done",       label: "완료/정산",     hint: "설치완료 이후",              count: countIn(DONE_STATUSES),       tone: "done"       },
    { key: "closed",     label: "종료",          hint: "상담종료 / 설치취소",         count: countIn(CLOSED_STATUSES),     tone: "closed"     },
    { key: "weekTotal",  label: "📊 이번 주",    hint: "최근 7일 신규 lead",         count: weekCount,                    tone: "neutral"    },
  ];

  return {
    partnerName: partner?.partnerName ?? "협력점",
    weekTotal: weekCount,
    stages,
    rows,
  };
}

// ----------------------------------------------------------------
// InquiryQueue — 미응답 신규 (consult_wish 4시간+) + 회송 큐(인증실패/수정요청)
// ----------------------------------------------------------------

export type InquiryItem = {
  id: string;
  customerName: string;
  ageLabel: string;
  isUrgent: boolean;
  message: string;
  status: "consult_wish" | "respond";
  statusLabel: string;
  productInterest: string;
  source: string;
};

export type InquirySnapshot = {
  items: InquiryItem[];
  doneToday: number;
  doneWeek: number;
  avgResponseMinutes: number | null;
};

export async function getInquiryQueue(partnerId: string): Promise<InquirySnapshot> {
  const fourHoursAgo = new Date(Date.now() - 4 * HOUR);
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * HOUR);

  const [unresponsive, respondLeads, doneToday, doneWeek, recentActiveLogs] = await Promise.all([
    prisma.lead.findMany({
      where: { partnerId, status: "consult_wish", createdAt: { lt: fourHoursAgo } },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    prisma.lead.findMany({
      where: { partnerId, status: { in: ["verify_failed", "verify_revise"] } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.leadStatusLog.count({
      where: {
        newStatus: "settle_done",
        createdAt: { gte: startOfDay },
        lead: { partnerId },
      },
    }),
    prisma.leadStatusLog.count({
      where: {
        newStatus: "settle_done",
        createdAt: { gte: sevenDaysAgo },
        lead: { partnerId },
      },
    }),
    prisma.leadStatusLog.findMany({
      where: {
        newStatus: { in: ["consult_active", "apply_submitted"] },
        createdAt: { gte: sevenDaysAgo },
        lead: { partnerId },
      },
      include: { lead: { select: { createdAt: true } } },
      take: 50,
    }),
  ]);

  // 평균 응답 시간 = lead.createdAt → 첫 상담 진입 시점
  let avgResponseMinutes: number | null = null;
  const diffs = recentActiveLogs
    .map(log => log.createdAt.getTime() - log.lead.createdAt.getTime())
    .filter(ms => ms > 0);
  if (diffs.length > 0) {
    const avgMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    avgResponseMinutes = Math.round(avgMs / 60_000);
  }

  const itemsRaw = [
    ...unresponsive.map(l => ({
      id: l.id, customerName: l.customerName, productInterest: l.productInterest,
      createdAt: l.createdAt, status: "consult_wish" as const,
      statusLabel: "🟡 미응답", source: l.source,
    })),
    ...respondLeads.map(l => ({
      id: l.id, customerName: l.customerName, productInterest: l.productInterest,
      createdAt: l.updatedAt, status: "respond" as const,
      statusLabel: l.status === "verify_failed" ? "🚨 인증실패" : "✏️ 수정요청",
      source: l.source,
    })),
  ];

  const items: InquiryItem[] = itemsRaw.map(it => {
    const ageMs = Date.now() - it.createdAt.getTime();
    const age = ageLabel(ageMs);
    const isUrgent = ageMs > 12 * HOUR;
    const channelTag = it.source === "kakao" ? "카톡 문의"
      : it.source === "phone" ? "전화 문의"
      : it.source === "api_partner" ? "외부 채널"
      : "온라인 신청";
    return {
      id: it.id,
      customerName: it.customerName,
      ageLabel: age.text,
      isUrgent,
      message: it.status === "respond"
        ? `${it.productInterest} — 본사 회신 필요`
        : `${it.productInterest} (${channelTag}) — 응대 대기 중`,
      status: it.status,
      statusLabel: it.statusLabel,
      productInterest: it.productInterest,
      source: it.source,
    };
  });

  return { items, doneToday, doneWeek, avgResponseMinutes };
}

// ----------------------------------------------------------------
// MemoTimeline — 이번 주 LeadStatusLog 이력
// ----------------------------------------------------------------

export type MemoItem = {
  id: string;
  timeLabel: string;
  title: string;
  detail: string;
  state: "default" | "done" | "warn";
};

export type MemoSnapshot = {
  items: MemoItem[];
  tomorrowSummary: string;
};

export async function getMemoTimeline(partnerId: string): Promise<MemoSnapshot> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * HOUR);

  const logs = await prisma.leadStatusLog.findMany({
    where: { lead: { partnerId }, createdAt: { gte: sevenDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { lead: { select: { customerName: true, productInterest: true } } },
  });

  const items: MemoItem[] = logs.map(log => {
    const transition = `${labelOf(log.previousStatus)} → ${labelOf(log.newStatus)}`;
    const state: MemoItem["state"] =
      (DONE_STATUSES as string[]).includes(log.newStatus) ? "done"
      : (RESPOND_STATUSES as string[]).includes(log.newStatus) || (CLOSED_STATUSES as string[]).includes(log.newStatus) ? "warn"
      : "default";

    return {
      id: log.id,
      timeLabel: fmtDate(log.createdAt),
      title: `${log.lead.customerName} · ${transition}`,
      detail: log.memo
        ? `${log.lead.productInterest} — ${log.memo}`
        : `${log.lead.productInterest} (시스템 변경)`,
      state,
    };
  });

  const [pendingConsult, pendingRespond] = await Promise.all([
    prisma.lead.count({ where: { partnerId, status: { in: CONSULT_STATUSES } } }),
    prisma.lead.count({ where: { partnerId, status: { in: RESPOND_STATUSES } } }),
  ]);
  const parts: string[] = [];
  if (pendingConsult > 0) parts.push(`상담 처리 ${pendingConsult}건`);
  if (pendingRespond > 0) parts.push(`회신 작성 ${pendingRespond}건`);
  const tomorrowSummary = parts.length > 0 ? parts.join(" + ") + " 예정" : "처리할 항목 없음";

  return { items, tomorrowSummary };
}

function labelOf(s: string): string {
  return STATUS_LABEL[s as LeadStatus] ?? s;
}
