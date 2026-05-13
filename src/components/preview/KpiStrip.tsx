import type { PartnerHeroData } from "@/lib/partnerHero";

const fmt = (n: number) => n.toLocaleString("ko-KR");

/**
 * Hero 바로 아래 KPI strip — 4개 신뢰 신호 카운터.
 */
export default function KpiStrip({ kpi }: { kpi: PartnerHeroData["kpi"] }) {
  return (
    <div className="bg-rk-ink border-y border-rk-ink text-white">
      <div className="max-w-[1280px] mx-auto px-6 py-4 grid grid-cols-4 gap-4">
        <KpiCell
          icon="📅"
          label="운영 일수"
          value={`${fmt(kpi.daysOperated)}일`}
          hint="본사 인증 후 누적"
        />
        <KpiCell
          icon="📞"
          label="이번 달 상담"
          value={`${fmt(kpi.leadsThisMonth)}건`}
          hint="이번 달 신규 lead"
        />
        <KpiCell
          icon="⏱"
          label="평균 응답"
          value={kpi.avgResponseMinutes != null ? `${kpi.avgResponseMinutes}분` : "—"}
          hint="신규 → 상담 시작"
        />
        <KpiCell
          icon="⭐"
          label="고객 별점"
          value={kpi.rating != null ? `${kpi.rating.toFixed(1)}` : "—"}
          hint={kpi.reviewCount > 0 ? `리뷰 ${fmt(kpi.reviewCount)}건` : "리뷰 모집 중"}
        />
      </div>
    </div>
  );
}

function KpiCell({ icon, label, value, hint }: { icon: string; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-[28px]">{icon}</div>
      <div>
        <small className="block text-[10px] uppercase tracking-[.04em] text-white/55">{label}</small>
        <b className="block text-[22px] font-bold tracking-[-.02em] rk-num leading-[1.15]">{value}</b>
        <small className="block text-[10px] text-white/55">{hint}</small>
      </div>
    </div>
  );
}
