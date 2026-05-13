import type { HqAnalytics } from "@/lib/hqAnalytics";
import { TIER_LABEL, TIER_PILL, type Tier } from "@/lib/tier";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n.toString();
};

export default function HqAnalyticsDashboard({ data }: { data: HqAnalytics }) {
  const { totals, byChannel, byPartner, options, daily } = data;
  const maxLeads = Math.max(1, ...daily.map(d => d.leads));
  const maxChannel = Math.max(1, ...byChannel.map(c => c.leads));
  const maxPartner = Math.max(1, ...byPartner.map(p => p.leads30d));

  return (
    <div className="space-y-3">
      {/* KPI Strip */}
      <div className="grid grid-cols-6 gap-2">
        <Kpi label="lead 총계" value={fmt(totals.leads)} suffix="건" tone="orange" hint={`최근 ${data.windowDays}일`} />
        <Kpi label="완료(done)" value={fmt(totals.done)} suffix="건" tone="success" />
        <Kpi label="전환율" value={totals.conversionRate.toFixed(1)} suffix="%" tone="navy" hint="done / leads" />
        <Kpi label="정산 합계" value={fmtCompact(totals.netPayout)} suffix="원" tone="info" />
        <Kpi label="활성 협력점" value={String(totals.activePartners)} suffix="곳" tone="muted" />
        <Kpi label="외부 API 채널" value={String(totals.apiChannels)} suffix="개" tone="muted" />
      </div>

      {/* Daily trend chart */}
      <section className="bg-white border border-rk-line rounded-lg p-4">
        <div className="flex items-baseline mb-3">
          <h3 className="text-[14px] font-semibold">📈 일별 lead 추세 ({data.windowDays}일)</h3>
          <small className="ml-auto text-[11px] text-rk-muted">파랑 = 신규 lead · 초록 = 완료</small>
        </div>
        <div className="flex items-end gap-[3px] h-[120px] overflow-hidden">
          {daily.map(d => {
            const leadPct = (d.leads / maxLeads) * 100;
            const donePct = (d.done / maxLeads) * 100;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-px relative group" title={`${d.date} : lead ${d.leads} / done ${d.done}`}>
                <div className="w-full bg-rk-info" style={{ height: leadPct + "%" }} />
                <div className="w-full bg-rk-success" style={{ height: donePct + "%" }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-rk-faint mt-1 font-mono">
          <span>{daily[0]?.date.slice(5)}</span>
          <span>{daily[Math.floor(daily.length / 2)]?.date.slice(5)}</span>
          <span>{daily[daily.length - 1]?.date.slice(5)}</span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {/* Channel breakdown */}
        <section className="bg-white border border-rk-line rounded-lg p-4">
          <h3 className="text-[14px] font-semibold mb-2">🌐 채널별 lead 분포</h3>
          <p className="text-[10px] text-rk-muted mb-2.5">유입 경로별 lead 수 + 완료 전환율</p>
          {byChannel.length === 0 ? (
            <div className="text-center text-[12px] text-rk-muted py-6">데이터 없음</div>
          ) : (
            <div className="flex flex-col gap-2">
              {byChannel.map(c => {
                const pct = (c.leads / maxChannel) * 100;
                return (
                  <div key={c.channel}>
                    <div className="flex items-baseline justify-between mb-0.5 text-[11px]">
                      <b className="text-rk-ink">{c.label}</b>
                      <div className="flex items-center gap-1.5">
                        <span className="rk-num text-rk-ink">{c.leads}</span>
                        <span className="text-rk-muted">·</span>
                        <span className="rk-num text-rk-success">{c.conversionRate}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-rk-soft-2 rounded-full overflow-hidden">
                      <div className="h-full bg-rk-info" style={{ width: pct + "%" }} />
                    </div>
                    {c.netPayout > 0 && (
                      <div className="text-[9px] text-rk-faint mt-px text-right">정산 ₩{fmt(c.netPayout)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Option distribution */}
        <section className="bg-white border border-rk-line rounded-lg p-4">
          <h3 className="text-[14px] font-semibold mb-2">⚙️ 가입 옵션 분포</h3>
          <p className="text-[10px] text-rk-muted mb-2.5">소비자가 PriceConfigurator에서 선택한 옵션</p>

          <div className="mb-3">
            <div className="text-[11px] text-rk-muted mb-1">운영 방식</div>
            <div className="flex gap-1">
              {options.byMode.map(m => (
                <div key={m.key} className="flex-1 bg-rk-soft-2 rounded p-1.5 text-center">
                  <small className="block text-[10px] text-rk-muted">{m.key}</small>
                  <b className="text-[14px] rk-num text-rk-ink">{m.count}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <div className="text-[11px] text-rk-muted mb-1">의무사용기간</div>
            <div className="flex gap-1 flex-wrap">
              {options.byContractPeriod.map(p => (
                <div key={p.key} className="bg-rk-soft-2 rounded px-2 py-1 flex items-center gap-1">
                  <small className="text-[10px] text-rk-muted">{p.key === "미선택" ? "미선택" : p.key + "개월"}</small>
                  <b className="text-[12px] rk-num text-rk-ink">{p.count}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-rk-tint-orange rounded p-2 px-2.5 text-[11px] text-rk-orange-deep flex items-center gap-1.5">
            <span>🔄</span>
            <b>타사보상</b>
            <span className="rk-num">{options.rivalCompensationCount}건</span>
            <span className="text-rk-orange-deep/70">({options.rivalCompensationRate}%)</span>
          </div>
        </section>
      </div>

      {/* Partner comparison */}
      <section className="bg-white border border-rk-line rounded-lg p-4">
        <h3 className="text-[14px] font-semibold mb-2">🏪 협력점 성과 비교 (활성 {byPartner.length}곳)</h3>
        <p className="text-[10px] text-rk-muted mb-3">최근 {data.windowDays}일 기준 — lead 처리량 / 전환율 / 평균 응답시간</p>
        <table className="w-full text-[12px]">
          <thead className="bg-rk-soft-2 text-rk-muted">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium text-[10px] uppercase tracking-[.04em]">협력점</th>
              <th className="text-left px-2 py-1.5 font-medium text-[10px] uppercase tracking-[.04em]">티어</th>
              <th className="text-right px-2 py-1.5 font-medium text-[10px] uppercase tracking-[.04em]">lead</th>
              <th className="text-right px-2 py-1.5 font-medium text-[10px] uppercase tracking-[.04em]">완료</th>
              <th className="text-right px-2 py-1.5 font-medium text-[10px] uppercase tracking-[.04em]">전환율</th>
              <th className="text-right px-2 py-1.5 font-medium text-[10px] uppercase tracking-[.04em]">정산</th>
              <th className="text-right px-2 py-1.5 font-medium text-[10px] uppercase tracking-[.04em]">평균 응답</th>
              <th className="text-right px-2 py-1.5 font-medium text-[10px] uppercase tracking-[.04em]">영업자</th>
            </tr>
          </thead>
          <tbody>
            {byPartner.map(p => {
              const pct = (p.leads30d / maxPartner) * 100;
              return (
                <tr key={p.partnerCode} className="border-t border-rk-line-2">
                  <td className="px-2 py-1.5">
                    <b className="text-rk-ink text-[12px]">{p.partnerName}</b>
                    <div className="h-1 mt-0.5 bg-rk-soft-2 rounded-full overflow-hidden w-full max-w-[180px]">
                      <div className="h-full bg-rk-orange" style={{ width: pct + "%" }} />
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={"text-[9px] px-1.5 py-px rounded font-medium " + TIER_PILL[p.tier as Tier]}>
                      {TIER_LABEL[p.tier as Tier] ?? p.tier}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right rk-num">{p.leads30d}</td>
                  <td className="px-2 py-1.5 text-right rk-num text-rk-success">{p.done30d}</td>
                  <td className="px-2 py-1.5 text-right rk-num">
                    <span className={p.conversionRate >= 30 ? "text-rk-success font-medium" : p.conversionRate >= 15 ? "text-rk-warn" : "text-rk-muted"}>
                      {p.conversionRate}%
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right rk-num">₩{fmtCompact(p.netPayout)}</td>
                  <td className="px-2 py-1.5 text-right rk-num text-[11px]">
                    {p.avgResponseMinutes != null ? `${p.avgResponseMinutes}분` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right rk-num">{p.activeSellers}</td>
                </tr>
              );
            })}
            {byPartner.length === 0 && (
              <tr><td colSpan={8} className="px-2 py-6 text-center text-rk-muted text-[12px]">활성 협력점이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const KPI_TONE: Record<string, string> = {
  orange: "bg-rk-tint-orange text-rk-orange-deep",
  navy: "bg-white text-rk-ink",
  success: "bg-rk-tint-green text-rk-success",
  info: "bg-rk-tint-blue text-rk-info",
  muted: "bg-rk-soft-2 text-rk-muted",
};
function Kpi({ label, value, suffix, tone, hint }: { label: string; value: string; suffix?: string; tone: keyof typeof KPI_TONE; hint?: string }) {
  return (
    <div className={"border border-rk-line rounded-lg p-3 " + KPI_TONE[tone]}>
      <small className="text-[10px] uppercase tracking-[.04em] font-medium opacity-80 block">{label}</small>
      <div className="mt-0.5 flex items-baseline gap-0.5">
        <b className="text-[20px] font-bold tracking-[-.02em] rk-num">{value}</b>
        {suffix && <small className="text-[11px] opacity-80">{suffix}</small>}
      </div>
      {hint && <small className="text-[10px] opacity-70 block">{hint}</small>}
    </div>
  );
}
