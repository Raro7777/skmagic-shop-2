"use client";

import { useState } from "react";

/**
 * 협력점 — 영업자 마진 기본값 입력.
 *   영업점수수료(= 본사수수료 - 본사마진) 에서 영업점이 떼는 몫.
 *   영업자 단독 링크로 들어온 lead 가 install_done 되면 이 값이 정산에 반영.
 *   PartnerPolicy.sellerMargin* 상품별 override 가 있으면 그게 우선.
 */
export default function SellerMarginInput({
  initial,
}: {
  initial: { type: "fixed" | "percent"; amount: number; percent: number };
}) {
  const [type, setType] = useState<"fixed" | "percent">(initial.type);
  const [amount, setAmount] = useState(String(initial.amount));
  const [percent, setPercent] = useState(((initial.percent * 100).toFixed(2).replace(/\.?0+$/, "")) || "0");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setFlash(null);
    try {
      const body = type === "fixed"
        ? { sellerMarginType: "fixed", sellerMarginAmount: Math.max(0, Math.floor(Number(amount.replace(/[^0-9]/g, "")) || 0)), sellerMarginPercent: 0 }
        : { sellerMarginType: "percent", sellerMarginAmount: 0, sellerMarginPercent: Math.max(0, Math.min(1, (Number(percent) || 0) / 100)) };

      const res = await fetch("/api/franchise/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlash(`⚠ ${data.error ?? "저장 실패"}`);
      } else {
        setFlash("✓ 영업자 마진 기본값 저장 완료 — 새 정산부터 반영");
        setTimeout(() => setFlash(null), 3500);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-[14px] font-semibold text-rk-ink">👥 영업자 마진 기본값</h3>
        <small className="text-[13px] text-rk-muted">
          영업점수수료 − 영업자마진 = 영업자수수료 · 상품별 override 가능 (상품 진열 · 정책 페이지)
        </small>
      </div>

      {flash && (
        <div className={"px-2.5 py-1.5 rounded text-[13px] mb-2 " + (flash.startsWith("✓") ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
          {flash}
        </div>
      )}

      <div className="flex gap-1.5 mb-2">
        <button
          type="button"
          onClick={() => setType("fixed")}
          className={"flex-1 px-3 py-1.5 rounded text-[13px] border " + (type === "fixed" ? "bg-rk-orange border-rk-orange text-white font-medium" : "bg-white border-rk-line text-rk-muted")}
        >₩ 금액으로</button>
        <button
          type="button"
          onClick={() => setType("percent")}
          className={"flex-1 px-3 py-1.5 rounded text-[13px] border " + (type === "percent" ? "bg-rk-orange border-rk-orange text-white font-medium" : "bg-white border-rk-line text-rk-muted")}
        >% 비율로</button>
      </div>

      {type === "fixed" ? (
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-rk-muted">₩</span>
          <input
            type="text"
            inputMode="numeric"
            value={Number(amount.replace(/[^0-9]/g, "") || "0").toLocaleString("ko-KR")}
            onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            className="flex-1 border border-rk-line rounded px-2.5 py-1.5 text-[14px] rk-num text-rk-ink outline-none focus:border-rk-navy"
            placeholder="0"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1.5 rounded text-[14px] cursor-pointer disabled:opacity-50"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={percent}
            onChange={e => setPercent(e.target.value.replace(/[^0-9.]/g, ""))}
            className="flex-1 border border-rk-line rounded px-2.5 py-1.5 text-[14px] rk-num text-rk-ink outline-none focus:border-rk-navy"
            placeholder="0"
          />
          <span className="text-[14px] text-rk-muted">%</span>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1.5 rounded text-[14px] cursor-pointer disabled:opacity-50"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      )}

      <p className="text-[12px] text-rk-muted mt-2 leading-[1.5]">
        영업자 없는 lead 의 정산은 이 값과 무관합니다 (협력점이 영업점수수료 전액 수령).
      </p>
    </div>
  );
}
