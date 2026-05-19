import Link from "next/link";
import { getSellerDashboardBySellerId } from "@/lib/sellerDashboard";
import { getEffectiveSeller } from "@/lib/effectiveSeller";

export const metadata = { title: "내 대시보드 · 영업자" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default async function SellerDashboardPage() {
  const eff = await getEffectiveSeller();
  if (!eff) return null;
  const data = await getSellerDashboardBySellerId(eff.sellerId);
  if (!data) return null;
  const { profile, kpi, leads } = data;
  const recentLeads = leads.slice(0, 5);

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">{profile.name}님의 대시보드</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        {profile.partnerName} · sellerCode <code className="font-mono text-rk-ink">{profile.sellerCode}</code> · 본인이 받은 lead만 표시
      </p>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-3 mb-3.5">
        <KpiCard label="이번 주 신규" value={kpi.weekLeads.toLocaleString()} suffix="건" tone="orange" hint="최근 7일" />
        <KpiCard label="누적 lead" value={kpi.totalLeads.toLocaleString()} suffix="건" tone="navy" hint="전체 기간" />
        <KpiCard label="이번 달 정산 예정" value={fmt(kpi.expectedPayout)} suffix="원" tone="success" hint={`${kpi.doneThisMonth}건 완료 합계`} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3.5">
        <StatTile label="① 신규" value={kpi.pendingNew} tone="info" hint="응대 대기" href="/admin/seller/leads" />
        <StatTile label="② 진행" value={kpi.inProgress} tone="warn" hint="설치 일정 조율" href="/admin/seller/leads" />
        <StatTile label="③ 완료" value={kpi.doneThisMonth} tone="success" hint="이번 달" href="/admin/seller/leads" />
      </div>

      {/* Recent leads preview */}
      <section className="bg-white border border-rk-line rounded-lg p-4 mb-3">
        <div className="flex items-center mb-2.5 flex-wrap gap-2">
          <h3 className="text-[14px] font-semibold">📋 최근 내 lead</h3>
          <Link href="/admin/seller/leads" className="ml-auto text-[14px] text-rk-info no-underline">전체 보기 →</Link>
        </div>
        {recentLeads.length === 0 ? (
          <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-6 text-center text-[14px] text-rk-muted">
            아직 받은 lead가 없습니다. 공유 링크를 활용해 더 많은 신청을 유치해보세요.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {recentLeads.map(l => (
              <div key={l.id} className="border border-rk-line-2 rounded px-3 py-2.5 flex items-center gap-3 flex-wrap">
                <div className="font-mono text-[13px] text-rk-muted min-w-[80px]">{l.receivedAt}</div>
                <div className="min-w-[120px]">
                  <b className="text-[13px] text-rk-ink">{l.customerName}</b>
                  <small className="text-rk-muted text-[12px] block">{l.customerMeta}</small>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <span className="text-[14px] text-rk-text">{l.product}</span>
                  {(l.selectedMode || l.selectedContractPeriod || l.rivalCompensationRequested) && (
                    <div className="flex gap-1 mt-0.5 flex-wrap">
                      {l.selectedMode && <span className="text-[12px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">{l.selectedMode}</span>}
                      {l.selectedContractPeriod && <span className="text-[12px] px-1 py-px rounded bg-rk-soft-2 text-rk-muted">{l.selectedContractPeriod}개월</span>}
                      {l.rivalCompensationRequested && <span className="text-[12px] px-1 py-px rounded bg-rk-tint-orange text-rk-orange-deep font-medium">🔄 타사보상</span>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={"text-[12px] px-1.5 py-px rounded font-medium " + STATUS_PILL[l.status]}>{l.statusLabel}</span>
                  {l.sellerPayout > 0 && (
                    <small className="text-[11px] rk-num text-rk-success">+₩{fmt(l.sellerPayout)}</small>
                  )}
                  {l.refundStatus && (
                    <span
                      className="text-[10px] px-1 py-px rounded bg-rk-tint-orange text-rk-orange-deep font-medium"
                      title="환수 진행 — 본사와 협력점 간 처리. 영업자 정산에는 영향 없음."
                    >
                      🔄 환수 {l.refundStatus === "refund_pending" ? "예정" : l.refundStatus === "refund_progress" ? "진행" : "완료"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/admin/seller/links" className="bg-white border border-rk-line rounded-lg p-4 no-underline hover:bg-rk-soft-2 transition-colors">
          <div className="text-[13px] text-rk-ink font-semibold flex items-center gap-1.5">🔗 내 공유 링크</div>
          <div className="text-[13px] text-rk-muted mt-1">QR + 카톡 공유 문구로 더 많은 신청 받기</div>
        </Link>
        <Link href={`/p/${profile.partnerCode}/s/${profile.sellerCode}`} target="_blank" className="bg-white border border-rk-line rounded-lg p-4 no-underline hover:bg-rk-soft-2 transition-colors">
          <div className="text-[13px] text-rk-ink font-semibold flex items-center gap-1.5">🌐 내 분양 사이트 미리보기</div>
          <div className="text-[13px] text-rk-muted mt-1">/p/{profile.partnerCode}/s/{profile.sellerCode}</div>
        </Link>
      </div>
    </>
  );
}

const STATUS_PILL: Record<string, string> = {
  new:   "bg-rk-tint-blue text-rk-info",
  going: "bg-rk-tint-orange text-rk-orange-deep",
  done:  "bg-rk-tint-green text-rk-success",
  warn:  "bg-rk-tint-red text-rk-sale",
};

const KPI_TONE: Record<string, string> = {
  orange:  "bg-rk-tint-orange text-rk-orange-deep",
  navy:    "bg-white text-rk-ink",
  success: "bg-rk-tint-green text-rk-success",
};

function KpiCard({ label, value, suffix, tone, hint }: { label: string; value: string; suffix?: string; tone: keyof typeof KPI_TONE; hint: string }) {
  return (
    <div className={"border border-rk-line rounded-lg p-4 " + KPI_TONE[tone]}>
      <small className="text-[12px] uppercase tracking-[.04em] font-medium opacity-80 block">{label}</small>
      <div className="mt-1 flex items-baseline gap-1">
        <b className="text-[24px] font-bold tracking-[-.02em] rk-num">{value}</b>
        {suffix && <small className="text-[13px] opacity-80">{suffix}</small>}
      </div>
      <small className="text-[12px] opacity-70 mt-1 block">{hint}</small>
    </div>
  );
}

const TILE_TONE: Record<string, string> = {
  info:    "bg-rk-tint-blue border-rk-tint-blue text-rk-info",
  warn:    "bg-rk-tint-orange border-rk-tint-orange text-rk-orange-deep",
  success: "bg-rk-tint-green border-rk-tint-green text-rk-success",
};
function StatTile({ label, value, tone, hint, href }: { label: string; value: number; tone: keyof typeof TILE_TONE; hint: string; href: string }) {
  return (
    <Link href={href} className={"border rounded-lg p-3.5 no-underline hover:opacity-90 transition-opacity " + TILE_TONE[tone]}>
      <small className="text-[13px] font-medium block">{label}</small>
      <b className="text-[22px] font-bold tracking-[-.02em] rk-num mt-1 block">{value}</b>
      <small className="text-[12px] opacity-80 mt-0.5 block">{hint}</small>
    </Link>
  );
}
