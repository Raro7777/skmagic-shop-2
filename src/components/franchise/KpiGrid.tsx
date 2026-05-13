type Kpi = {
  label: string;
  delta: string;
  deltaDown?: boolean;
  value: string;
  unit?: string;
  sub: string;
  primary?: boolean;
};

const KPIS: Kpi[] = [
  { label: "오늘 신규 주문",   delta: "▲ 3건 (전일 대비)", value: "7", unit: "건", sub: "이번 주 누적 24건 · 목표 35건", primary: true },
  { label: "설치 대기",        delta: "12건", deltaDown: true, value: "12", unit: "건", sub: "최장 대기 D-3 · 기사 배정 필요" },
  { label: "미응대 상담",      delta: "3건",  deltaDown: true, value: "3",  unit: "건", sub: "가장 오래된 건 12분 경과" },
  { label: "평균 응답시간",    delta: "▼ 4분", value: "18", unit: "분", sub: "본사 약속 30분 이내 · 우수" },
  { label: "이번 달 GMV",      delta: "▲ 12.4%", value: "31.2", unit: "M원", sub: "목표 ₩35M · 89% 달성" },
];

export default function KpiGrid() {
  return (
    <div className="grid grid-cols-5 gap-2.5 mb-4">
      {KPIS.map((k, i) => (
        <div
          key={i}
          className={
            "rounded-lg p-3.5 px-4 border " +
            (k.primary
              ? "bg-rk-navy border-rk-navy text-white"
              : "bg-white border-rk-line")
          }
        >
          <div className={"flex justify-between text-[13px] " + (k.primary ? "text-white/65" : "text-rk-muted")}>
            <span>{k.label}</span>
            <span
              className={
                "font-medium " +
                (k.primary ? "text-[#6FE4A8]" : k.deltaDown ? "text-rk-sale" : "text-rk-success")
              }
            >
              {k.delta}
            </span>
          </div>
          <div className={"text-[22px] font-bold mt-1 tracking-[-.02em] rk-num " + (k.primary ? "text-white" : "text-rk-ink")}>
            {k.value}
            {k.unit && <small className={"ml-0.5 text-[14px] font-medium " + (k.primary ? "text-white/65" : "text-rk-muted")}>{k.unit}</small>}
          </div>
          <div className={"text-[13px] mt-0.5 " + (k.primary ? "text-white/65" : "text-rk-muted")}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}
