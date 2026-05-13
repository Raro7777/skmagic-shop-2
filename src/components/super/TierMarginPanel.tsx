"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 본사 콘솔 — 협력점 티어별 본사 마진 기본값 패널.
 *   4행 (basic/standard/premium/enterprise), 각각 금액(₩) 또는 비율(%) 토글 + 입력 + 저장.
 *   HqPolicy.margin* 가 있는 경우 그 옵션은 여기 값 대신 override 가 우선 적용됨.
 */

type TierRow = {
  tier: "basic" | "standard" | "premium" | "enterprise";
  marginType: "fixed" | "percent";
  marginAmount: number;
  marginPercent: number;
};

const TIER_LABEL: Record<TierRow["tier"], string> = {
  basic: "기본", standard: "스탠다드", premium: "프리미엄", enterprise: "엔터프라이즈",
};
const TIER_COLOR: Record<TierRow["tier"], string> = {
  basic:      "bg-rk-soft text-rk-muted",
  standard:   "bg-rk-tint-blue text-rk-info",
  premium:    "bg-rk-tint-orange text-rk-orange-deep",
  enterprise: "bg-rk-navy text-white",
};

export default function TierMarginPanel() {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTier, setSavingTier] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/policies/hq-margin", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setError("본사 권한 필요");
        return;
      }
      const data = await res.json();
      setRows(data.tiers);
    } catch {
      setError("티어 마진 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (tier: string, patch: Partial<TierRow>) => {
    setRows(rs => rs.map(r => r.tier === tier ? { ...r, ...patch } : r));
  };

  const save = async (row: TierRow) => {
    setSavingTier(row.tier);
    setFlash(null);
    try {
      const res = await fetch("/api/policies/hq-margin", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier: row.tier,
          marginType: row.marginType,
          marginAmount: row.marginAmount,
          marginPercent: row.marginPercent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlash(`⚠ ${data.error ?? "저장 실패"}`);
      } else {
        setFlash(`✓ ${TIER_LABEL[row.tier]} 티어 본사마진 저장 — 즉시 정산에 반영`);
        setTimeout(() => setFlash(null), 3500);
      }
    } finally {
      setSavingTier(null);
    }
  };

  if (loading) {
    return <div className="bg-white border border-rk-line rounded-lg p-4 mb-3 text-[14px] text-rk-muted">티어 마진 로드 중…</div>;
  }
  if (error) {
    return <div className="bg-rk-tint-red text-rk-sale border border-rk-tint-red rounded-lg p-3 mb-3 text-[14px]">⚠ {error}</div>;
  }

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4 mb-3">
      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">⚖️ 티어별 본사 마진 기본값</h3>
        <small className="text-[13px] text-rk-muted">
          영업점수수료 = 본사수수료 − 본사마진 · 상품·옵션별 매트릭스 셀에서 override 가능
        </small>
      </div>

      {flash && (
        <div className={"px-2.5 py-1.5 rounded text-[13px] mb-2 " + (flash.startsWith("✓") ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
          {flash}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {rows.map(row => (
          <div key={row.tier} className="border border-rk-line-2 rounded-md p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className={"text-[12px] px-1.5 py-0.5 rounded font-medium " + TIER_COLOR[row.tier]}>
                {TIER_LABEL[row.tier]}
              </span>
              <button
                type="button"
                onClick={() => save(row)}
                disabled={savingTier === row.tier}
                className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-2 py-0.5 rounded text-[12px] cursor-pointer disabled:opacity-50"
              >
                {savingTier === row.tier ? "저장중" : "저장"}
              </button>
            </div>
            <div className="flex gap-1 mb-1.5">
              <button
                type="button"
                onClick={() => update(row.tier, { marginType: "fixed" })}
                className={"flex-1 px-1.5 py-0.5 rounded text-[12px] border " + (row.marginType === "fixed" ? "bg-rk-orange border-rk-orange text-white" : "bg-white border-rk-line text-rk-muted")}
              >
                ₩ 금액
              </button>
              <button
                type="button"
                onClick={() => update(row.tier, { marginType: "percent" })}
                className={"flex-1 px-1.5 py-0.5 rounded text-[12px] border " + (row.marginType === "percent" ? "bg-rk-orange border-rk-orange text-white" : "bg-white border-rk-line text-rk-muted")}
              >
                % 비율
              </button>
            </div>
            {row.marginType === "fixed" ? (
              <input
                type="text"
                inputMode="numeric"
                value={row.marginAmount.toLocaleString("ko-KR")}
                onChange={e => update(row.tier, { marginAmount: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                className="w-full border border-rk-line rounded px-2 py-1 text-[13px] rk-num text-rk-ink outline-none focus:border-rk-navy"
                placeholder="0"
              />
            ) : (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={(row.marginPercent * 100).toFixed(2).replace(/\.?0+$/, "")}
                  onChange={e => {
                    const n = Number(e.target.value.replace(/[^0-9.]/g, "")) || 0;
                    update(row.tier, { marginPercent: Math.max(0, Math.min(100, n)) / 100 });
                  }}
                  className="flex-1 border border-rk-line rounded px-2 py-1 text-[13px] rk-num text-rk-ink outline-none focus:border-rk-navy"
                  placeholder="0"
                />
                <span className="text-[13px] text-rk-muted">%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
