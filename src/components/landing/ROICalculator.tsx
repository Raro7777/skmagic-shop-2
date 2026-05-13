"use client";

import { useMemo, useState } from "react";

const fmt = (n: number) => n.toLocaleString("ko-KR");

/**
 * ROI 계산기 — 슬라이더 3개 (월 분양료 / 평균 수수료 / 월 분양 대수).
 * 본사 baseCommission 실데이터를 기본값으로 받음.
 */
export default function ROICalculator({ avgCommission }: { avgCommission: number }) {
  const [rent, setRent] = useState(490_000);
  const [commission, setCommission] = useState(Math.max(30_000, avgCommission));
  const [units, setUnits] = useState(30);

  const monthly = useMemo(() => {
    const revenue = commission * units;
    const profit = revenue - rent;
    return { revenue, profit, breakEven: Math.ceil(rent / Math.max(1, commission)) };
  }, [rent, commission, units]);

  return (
    <div className="bg-white border border-rk-line rounded-xl p-5">
      <div className="flex items-baseline mb-4 flex-wrap gap-2">
        <h3 className="text-[18px] font-bold text-rk-ink tracking-[-.02em]">💡 ROI 계산기</h3>
        <small className="text-[11px] text-rk-muted">슬라이더로 직접 시뮬레이션</small>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <Slider
          label="월 분양료"
          unit="원"
          value={rent}
          min={300_000} max={2_000_000} step={10_000}
          onChange={setRent}
          fmt={n => fmt(n)}
        />
        <Slider
          label="평균 수수료/건"
          unit="원"
          value={commission}
          min={20_000} max={200_000} step={1_000}
          onChange={setCommission}
          fmt={n => fmt(n)}
        />
        <Slider
          label="월 분양 대수"
          unit="대"
          value={units}
          min={5} max={150} step={1}
          onChange={setUnits}
          fmt={n => String(n)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-1">
        <div className="bg-rk-soft-2 rounded-lg p-3.5">
          <small className="text-[10px] text-rk-muted uppercase tracking-[.04em] block">월 매출</small>
          <b className="text-[20px] tracking-[-.02em] text-rk-ink rk-num block mt-0.5">₩{fmt(monthly.revenue)}</b>
        </div>
        <div className="bg-rk-tint-orange rounded-lg p-3.5">
          <small className="text-[10px] text-rk-orange-deep uppercase tracking-[.04em] block">월 분양료</small>
          <b className="text-[20px] tracking-[-.02em] text-rk-orange-deep rk-num block mt-0.5">−₩{fmt(rent)}</b>
        </div>
        <div className={"rounded-lg p-3.5 " + (monthly.profit >= 0 ? "bg-rk-tint-green" : "bg-rk-tint-red")}>
          <small className={"text-[10px] uppercase tracking-[.04em] block " + (monthly.profit >= 0 ? "text-rk-success" : "text-rk-sale")}>월 순익</small>
          <b className={"text-[22px] font-bold tracking-[-.02em] rk-num block mt-0.5 " + (monthly.profit >= 0 ? "text-rk-success" : "text-rk-sale")}>
            {monthly.profit >= 0 ? "+" : ""}₩{fmt(monthly.profit)}
          </b>
        </div>
      </div>

      <div className="mt-3 px-3 py-2 bg-rk-tint-blue text-rk-info rounded-md text-[11px] flex items-center gap-2 flex-wrap">
        <span>📌</span>
        <span>월 <b>{monthly.breakEven}대</b> 분양 시점부터 분양료 회수 — 그 이상은 모두 순익</span>
        <span className="ml-auto text-rk-muted">
          연환산 순익 <b className="text-rk-info rk-num">₩{fmt(monthly.profit * 12)}</b>
        </span>
      </div>
    </div>
  );
}

function Slider({
  label, unit, value, min, max, step, onChange, fmt,
}: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (n: number) => void; fmt: (n: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <small className="text-[11px] text-rk-muted">{label}</small>
        <b className="text-[14px] text-rk-ink rk-num">{fmt(value)}<small className="text-[10px] text-rk-muted ml-0.5">{unit}</small></b>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-rk-orange cursor-pointer"
      />
    </label>
  );
}
