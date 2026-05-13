import type { GmvChartData } from "@/lib/gmvChart";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtCompact = (n: number) => {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + "억";
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(1) + "천만";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
};

const VB_W = 600;
const VB_H = 170;
const PAD_T = 12;
const PAD_B = 26; // for date labels at the bottom
const PLOT_H = VB_H - PAD_T - PAD_B;

export default function GmvChart({ data }: { data: GmvChartData }) {
  const { days, maxGmv, totals, peak, averageDailyGmv } = data;
  // Scale: if no data, draw flat line at bottom
  const yScale = maxGmv > 0 ? PLOT_H / maxGmv : 0;
  const stepX = days.length > 1 ? VB_W / (days.length - 1) : VB_W;

  const points = days.map((d, i) => {
    const x = i * stepX;
    const y = PAD_T + (PLOT_H - d.gmv * yScale);
    return { x, y, d };
  });

  // SVG path strings
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L${VB_W},${PAD_T + PLOT_H} L0,${PAD_T + PLOT_H} Z`
      : "";

  // Lead count line — secondary axis. Scale to plot area too.
  const maxLeads = Math.max(...days.map(d => d.leadCount), 1);
  const leadPoints = days.map((d, i) => ({
    x: i * stepX,
    y: PAD_T + (PLOT_H - (d.leadCount / maxLeads) * (PLOT_H * 0.7)),
    d,
  }));
  const leadPath = leadPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const hasData = totals.gmv > 0 || totals.leadCount > 0;

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">
          📈 {data.scope === "partner" ? "본 협력점" : "전체"} GMV 추이 (최근 {days.length}일)
          <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-tint-green text-rk-success font-medium ml-1.5">live</span>
        </h3>
        <div className="ml-auto flex gap-3 items-center">
          <Legend color="#1A2A52" label="GMV (정산)" />
          <Legend color="#F26A1F" label="본사 수수료 수익" dashed />
          <Legend color="#1F8A5B" label="신규 lead" dot />
        </div>
      </div>

      <div className="h-[200px] relative px-1">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="gmvGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1A2A52" stopOpacity=".25" />
              <stop offset="100%" stopColor="#1A2A52" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y gridlines */}
          <g stroke="#EDEFF2" strokeWidth="0.5">
            {[0.25, 0.5, 0.75].map(t => (
              <line
                key={t}
                x1="0"
                y1={PAD_T + PLOT_H * t}
                x2={VB_W}
                y2={PAD_T + PLOT_H * t}
              />
            ))}
            {/* Bottom axis */}
            <line x1="0" y1={PAD_T + PLOT_H} x2={VB_W} y2={PAD_T + PLOT_H} stroke="#E5E7EB" strokeWidth="0.7" />
          </g>

          {/* GMV area + line */}
          {hasData && areaPath && (
            <>
              <path d={areaPath} fill="url(#gmvGrad)" />
              <path d={linePath} fill="none" stroke="#1A2A52" strokeWidth="1.8" />
            </>
          )}

          {/* Lead count line (dashed orange?) — actually use green dotted */}
          {hasData && leadPath && (
            <path d={leadPath} fill="none" stroke="#F26A1F" strokeWidth="1.2" strokeDasharray="3,3" />
          )}

          {/* Points (lead) */}
          {hasData && (
            <g fill="#1F8A5B">
              {leadPoints.map((p, i) =>
                p.d.leadCount > 0 ? (
                  <circle key={i} cx={p.x} cy={p.y} r="2.5" />
                ) : null
              )}
            </g>
          )}

          {/* X-axis date labels — only ~5 points to avoid crowding */}
          <g fontSize="9" fill="#9AA0AA" fontFamily="JetBrains Mono, monospace">
            {days.map((d, i) => {
              const showLabel = i === 0 || i === days.length - 1 || i % Math.max(1, Math.floor(days.length / 5)) === 0;
              if (!showLabel) return null;
              const x = i * stepX;
              const dateLabel = d.date.slice(5).replace("-", "/");
              const isToday = d.isToday;
              return (
                <text
                  key={d.date}
                  x={x}
                  y={VB_H - 8}
                  textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}
                  fontWeight={isToday ? "600" : "400"}
                  fill={isToday ? "#1A1D24" : "#9AA0AA"}
                >
                  {dateLabel}{isToday ? " (오늘)" : ""}
                </text>
              );
            })}
          </g>
        </svg>

        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center text-[14px] text-rk-muted">
            아직 정산 / lead 데이터가 충분하지 않습니다 — lead 처리하면 차트가 채워집니다.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 pt-3 border-t border-rk-line-2 text-[13px]">
        <span>
          누적 GMV: <b className="text-rk-ink rk-num">₩{fmt(totals.gmv)}</b>
        </span>
        <span>
          본사 수익: <b className="text-rk-ink rk-num">₩{fmt(totals.hqRevenue)}</b>
        </span>
        <span>
          협력점 송금: <b className="text-rk-ink rk-num">₩{fmt(totals.partnerPayout)}</b>
        </span>
        <span>
          lead: <b className="text-rk-ink rk-num">{fmt(totals.leadCount)}</b>건 (완료 {fmt(totals.doneCount)})
        </span>
        {peak && (
          <span>
            최고일: <b className="text-rk-ink">{peak.date.slice(5).replace("-", "/")}</b> · <b className="text-rk-ink rk-num">₩{fmtCompact(peak.gmv)}</b>
          </span>
        )}
        <span>
          일평균: <b className="text-rk-ink rk-num">₩{fmtCompact(Math.round(averageDailyGmv))}</b>
        </span>
      </div>
    </div>
  );
}

function Legend({ color, label, dashed, dot }: { color: string; label: string; dashed?: boolean; dot?: boolean }) {
  return (
    <span className="text-[13px] text-rk-muted inline-flex items-center gap-1">
      {dot ? (
        <i style={{ background: color }} className="inline-block w-1.5 h-1.5 rounded-full" />
      ) : (
        <i
          style={{
            background: color,
            backgroundImage: dashed ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)` : undefined,
          }}
          className="inline-block w-3 h-[2px]"
        />
      )}
      {label}
    </span>
  );
}
