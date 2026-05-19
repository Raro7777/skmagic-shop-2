import { prisma } from "@/lib/prisma";

type Kpi = {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  tone?: "primary" | "warn" | "sale";
};

const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return (n / 10_000).toFixed(1) + "만";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n.toString();
};

export default async function KpiGrid({ partnerCode }: { partnerCode: string | null }) {
  // partnerCode 없으면 모두 0 (실제로 layout 에서 차단되므로 도달하기 어려움)
  if (!partnerCode) {
    return <EmptyGrid />;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const periodMonth = new Date().toISOString().slice(0, 7);

  const [
    todayNewLeads,
    unrepliedConsult,
    hqPendingCount,
    needReplyCount,
    settlementAgg,
  ] = await Promise.all([
    prisma.lead.count({
      where: { partnerId: partnerCode, createdAt: { gte: today } },
    }),
    prisma.lead.count({
      where: { partnerId: partnerCode, status: { in: ["consult_wish", "consult_active"] } },
    }),
    prisma.lead.count({
      where: {
        partnerId: partnerCode,
        status: { in: ["apply_submitted", "verify_pending", "verify_passed", "install_pending"] },
      },
    }),
    prisma.lead.count({
      where: {
        partnerId: partnerCode,
        status: { in: ["verify_failed", "verify_revise"] },
      },
    }),
    prisma.settlement.aggregate({
      where: { partnerId: partnerCode, periodMonth, status: { not: "cancelled" } },
      _sum: { netPayout: true },
      _count: { _all: true },
    }),
  ]);

  const settlementTotal = settlementAgg._sum.netPayout ?? 0;
  const settlementCount = settlementAgg._count._all;

  const kpis: Kpi[] = [
    {
      label: "오늘 신규 lead",
      value: todayNewLeads.toString(),
      unit: "건",
      sub: todayNewLeads === 0 ? "오늘 신규 상담 없음" : "협력점 콘솔 진입 후 자동 집계",
      tone: "primary",
    },
    {
      label: "미응대 상담",
      value: unrepliedConsult.toString(),
      unit: "건",
      sub: unrepliedConsult > 0 ? "상담 시작 / 신청서 작성 필요" : "응대 대기 없음",
      tone: unrepliedConsult > 0 ? "warn" : undefined,
    },
    {
      label: "본사 처리 대기",
      value: hqPendingCount.toString(),
      unit: "건",
      sub: "본사 인증·설치 절차 진행 중",
    },
    {
      label: "회신 필요",
      value: needReplyCount.toString(),
      unit: "건",
      sub: needReplyCount > 0 ? "본사 수정요청 — 즉시 회신/재제출" : "회신 대기 건 없음",
      tone: needReplyCount > 0 ? "sale" : undefined,
    },
    {
      label: `${periodMonth} 정산 누계`,
      value: "₩" + fmtCompact(settlementTotal),
      sub: settlementCount === 0 ? "이번 달 정산 없음" : `${settlementCount}건 누적`,
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-2.5 mb-4">
      {kpis.map((k, i) => (
        <KpiCard key={i} kpi={k} />
      ))}
    </div>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const isPrimary = kpi.tone === "primary";
  return (
    <div
      className={
        "rounded-lg p-3.5 px-4 border " +
        (isPrimary ? "bg-rk-navy border-rk-navy text-white" : "bg-white border-rk-line")
      }
    >
      <div className={"text-[13px] " + (isPrimary ? "text-white/65" : "text-rk-muted")}>
        {kpi.label}
      </div>
      <div
        className={
          "text-[22px] font-bold mt-1 tracking-[-.02em] rk-num " +
          (isPrimary
            ? "text-white"
            : kpi.tone === "warn"
              ? "text-rk-orange-deep"
              : kpi.tone === "sale"
                ? "text-rk-sale"
                : "text-rk-ink")
        }
      >
        {kpi.value}
        {kpi.unit && (
          <small
            className={
              "ml-0.5 text-[14px] font-medium " +
              (isPrimary ? "text-white/65" : "text-rk-muted")
            }
          >
            {kpi.unit}
          </small>
        )}
      </div>
      <div className={"text-[13px] mt-0.5 " + (isPrimary ? "text-white/65" : "text-rk-muted")}>
        {kpi.sub}
      </div>
    </div>
  );
}

function EmptyGrid() {
  return (
    <div className="grid grid-cols-5 gap-2.5 mb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg p-3.5 px-4 border bg-white border-rk-line">
          <div className="text-[13px] text-rk-muted">—</div>
          <div className="text-[22px] font-bold mt-1 text-rk-faint rk-num">0</div>
          <div className="text-[13px] text-rk-muted mt-0.5">협력점 미선택</div>
        </div>
      ))}
    </div>
  );
}
