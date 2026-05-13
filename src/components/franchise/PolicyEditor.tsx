"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type PartnerProduct = {
  productCode: string;
  category: string;
  name: string;
  modelName: string;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  managementType: string;
  hqPolicy: {
    baseCommission: number;      // 본사 수수료 (참고용)
    hqMargin: number;            // 본사 마진
    partnerCommission: number;   // 영업점수수료 ★ 정책 표기 + 환수 기준
    refundLimitRatio: number;
    installSubsidy: number;
    limitOptionMode?: string;
    limitOptionPeriod?: number;
    optionCount?: number;
  } | null;
  myPolicy: {
    giftAmount: number;
    giftLabel: string | null;
    installAmount: number;
    sellerMarginAmount: number | null;
    sellerMarginPercent: number | null;
  } | null;
};

type Draft = {
  giftLabel: string;
  giftAmount: string;
  installAmount: string;
  // 영업자 마진 override — marginType=null 이면 "협력점 기본값 사용"
  marginType: "fixed" | "percent" | null;
  marginAmount: string;
  marginPercent: string;
};

type Filter = "all" | "missing" | "set";

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("ko-KR"));
const numOrNull = (s: string): number | null => {
  const cleaned = s.replace(/[, ]/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

export default function PolicyEditor() {
  const [items, setItems] = useState<PartnerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string; code?: string } | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/policies/partner", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setError("협력점 권한 필요");
        else throw new Error();
        return;
      }
      const data = await res.json();
      setItems(data.products);
      setError(null);
    } catch {
      setError("정책 데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(p => {
      // 사은품/설치비 환원 어느 하나라도 0보다 크면 "설정됨"
      const isSet = (p.myPolicy?.giftAmount ?? 0) > 0 || (p.myPolicy?.installAmount ?? 0) > 0;
      if (filter === "missing" && isSet) return false;
      if (filter === "set" && !isSet) return false;
      if (q && !`${p.productCode} ${p.name} ${p.modelName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, filter]);

  const setCount = items.filter(i => (i.myPolicy?.giftAmount ?? 0) > 0 || (i.myPolicy?.installAmount ?? 0) > 0).length;
  const missingCount = items.length - setCount;

  const startEdit = (p: PartnerProduct) => {
    setMessage(null);
    setEditingCode(p.productCode);
    const sm = p.myPolicy;
    const marginType: "fixed" | "percent" | null = sm?.sellerMarginAmount != null
      ? "fixed"
      : sm?.sellerMarginPercent != null
        ? "percent"
        : null;
    setDraft({
      giftLabel: sm?.giftLabel ?? "",
      giftAmount: String(sm?.giftAmount ?? ""),
      installAmount: String(sm?.installAmount ?? ""),
      marginType,
      marginAmount: sm?.sellerMarginAmount != null ? String(sm.sellerMarginAmount) : "",
      marginPercent: sm?.sellerMarginPercent != null
        ? ((sm.sellerMarginPercent * 100).toFixed(2).replace(/\.?0+$/, ""))
        : "",
    });
  };
  const cancelEdit = () => {
    setEditingCode(null);
    setDraft(null);
  };

  const save = async () => {
    if (!editingCode || !draft) return;
    setMessage(null);

    const giftAmount = numOrNull(draft.giftAmount) ?? 0;
    const installAmount = numOrNull(draft.installAmount) ?? 0;
    const giftLabel = draft.giftLabel.trim() || null;

    if (giftAmount > 0 && !giftLabel) {
      setMessage({ tone: "err", text: "사은품 금액을 입력하면 사은품 이름도 입력해주세요.", code: editingCode });
      return;
    }

    // 영업자 마진 override
    const marginPayload =
      draft.marginType == null
        ? { sellerMarginAmount: null, sellerMarginPercent: null }
        : draft.marginType === "fixed"
          ? { sellerMarginAmount: numOrNull(draft.marginAmount) ?? 0, sellerMarginPercent: null }
          : { sellerMarginAmount: null, sellerMarginPercent: (Number(draft.marginPercent) || 0) / 100 };

    setSaving(true);
    try {
      const res = await fetch(`/api/policies/partner/${editingCode}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ giftAmount, giftLabel, installAmount, ...marginPayload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error ?? "저장 실패", code: editingCode });
        return;
      }
      setMessage({ tone: "ok", text: "저장 완료 — 우리 협력점 사이트에 즉시 반영됩니다.", code: editingCode });
      setEditingCode(null);
      setDraft(null);
      await fetchData();
    } catch {
      setMessage({ tone: "err", text: "네트워크 오류", code: editingCode });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-rk-line rounded-lg p-4">
        <div className="text-[14px] text-rk-muted py-4 text-center">정책 로딩 중…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-white border border-rk-line rounded-lg p-4">
        <div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded">⚠ {error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">
          🎁 우리 협력점 사은품 · 설치비 정책
        </h3>
        <span className="ml-auto text-[13px] text-rk-muted">{items.length}개 상품 · 변경은 우리 사이트에만 반영</span>
      </div>

      {/* Filter / Search */}
      <div className="flex flex-wrap items-center gap-2 mb-3 sticky top-0 bg-white pb-2 z-10">
        <input
          type="search"
          placeholder="상품명·코드 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] w-[180px] focus:outline-none focus:border-rk-navy"
        />
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={
            "px-2.5 py-1 rounded text-[13px] font-medium border " +
            (filter === "all"
              ? "bg-rk-navy text-white border-rk-navy"
              : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")
          }
        >
          전체 {items.length}
        </button>
        <button
          type="button"
          onClick={() => setFilter("missing")}
          className={
            "px-2.5 py-1 rounded text-[13px] font-medium border " +
            (filter === "missing"
              ? "bg-rk-orange text-white border-rk-orange"
              : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")
          }
        >
          🎁 미설정 {missingCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter("set")}
          className={
            "px-2.5 py-1 rounded text-[13px] font-medium border " +
            (filter === "set"
              ? "bg-rk-success text-white border-rk-success"
              : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")
          }
        >
          ✓ 설정됨 {setCount}
        </button>
        <span className="ml-auto text-[13px] text-rk-muted">표시 {visible.length}개</span>
      </div>

      <div className="bg-rk-tint-blue text-rk-info px-2.5 py-2 rounded text-[13px] mb-3 leading-[1.5]">
        💡 카드 메인 숫자는 <b>영업점수수료</b>(=본사수수료 − 본사마진) 입니다. 사은품·설치 환원은 영업점수수료에서 별도로 차감.
        <br />환원 한도는 <b>가장 낮은 수수료 옵션</b>의 영업점수수료 ⅔ 기준. 환수는 영업점수수료 기준으로 처리됩니다.
      </div>

      <div className="flex flex-col gap-1.5">
        {visible.map(p => {
          const isEditing = editingCode === p.productCode;
          const myPolicy = p.myPolicy;
          const isMissing = !((myPolicy?.giftAmount ?? 0) > 0 || (myPolicy?.installAmount ?? 0) > 0);

          // 정책 표기 = 영업점수수료 (= 본사수수료 - 본사마진). 환수 한도도 이 기준.
          const baseCommission = p.hqPolicy?.baseCommission ?? 0;
          const hqMargin = p.hqPolicy?.hqMargin ?? 0;
          const partnerCommission = p.hqPolicy?.partnerCommission ?? 0;
          const limit = p.hqPolicy ? Math.floor(partnerCommission * p.hqPolicy.refundLimitRatio) : 0;

          // Live calc from draft if editing
          const liveGift = isEditing && draft ? (numOrNull(draft.giftAmount) ?? 0) : (myPolicy?.giftAmount ?? 0);
          const liveInstall = isEditing && draft ? (numOrNull(draft.installAmount) ?? 0) : (myPolicy?.installAmount ?? 0);
          const used = liveGift + liveInstall;
          const remaining = partnerCommission - used;
          const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
          const isOver = limit > 0 && used > limit;
          const isWarn = pct >= 80 && !isOver;

          return (
            <div
              key={p.productCode}
              className={
                "border rounded-md transition-colors " +
                (isEditing
                  ? "border-rk-navy bg-rk-soft-2"
                  : isMissing
                    ? "border-rk-orange/30 bg-rk-tint-orange/30"
                    : "border-rk-line-2 hover:bg-rk-soft-2")
              }
            >
              <div className="px-3 py-2.5 flex items-center gap-3 flex-wrap">
                <div className="min-w-[220px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <b className="text-[14px] text-rk-ink">{p.name}</b>
                    {!p.hqPolicy && (
                      <span className="text-[9px] px-1.5 py-px rounded bg-rk-sale text-white font-semibold">
                        ⚠ 본사 정책 없음
                      </span>
                    )}
                  </div>
                  <small className="text-[12px] text-rk-faint font-mono">
                    {p.modelName} · 월 ₩{fmt(p.rentalPrice)} · 영업점수수료 <b className="text-rk-ink">₩{fmt(partnerCommission)}</b>
                    {p.hqPolicy?.limitOptionMode && p.hqPolicy?.limitOptionPeriod != null && (
                      <span className="ml-1 text-rk-orange-deep">
                        ({p.hqPolicy.limitOptionMode} {p.hqPolicy.limitOptionPeriod}개월
                        {(p.hqPolicy.optionCount ?? 0) > 1 && ` · 총 ${p.hqPolicy.optionCount}옵션`})
                      </span>
                    )}
                  </small>
                  <small className="text-[11px] text-rk-faint block">
                    본사수수료 ₩{fmt(baseCommission)} − 본사마진 ₩{fmt(hqMargin)} = 영업점수수료 ₩{fmt(partnerCommission)}
                  </small>
                </div>

                {!isEditing ? (
                  <>
                    <div className="flex items-center gap-3 text-[13px] flex-1 min-w-[280px]">
                      {myPolicy && myPolicy.giftAmount > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="text-rk-orange">🎁</span>
                          <b className="text-rk-orange-deep">{myPolicy.giftLabel ?? "사은품"}</b>
                          <span className="text-rk-muted">−₩{fmt(myPolicy.giftAmount)}</span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-rk-muted">사은품 없음</span>
                      )}
                      {myPolicy && myPolicy.installAmount > 0 && (
                        <>
                          <div className="h-3 w-px bg-rk-line-2" />
                          <div className="flex items-center gap-1">
                            <span className="text-rk-success">🛠</span>
                            <span className="text-rk-success">설치 ₩{fmt(myPolicy.installAmount)} 면제</span>
                          </div>
                        </>
                      )}
                      {p.hqPolicy && used > 0 && (
                        <>
                          <div className="h-3 w-px bg-rk-line-2" />
                          <div className="flex items-center gap-1">
                            <span className="text-rk-muted">실수령</span>
                            <b className="rk-num text-rk-ink">₩{fmt(remaining)}</b>
                            <span className="text-rk-muted">/대</span>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!p.hqPolicy}
                      onClick={() => startEdit(p)}
                      title={!p.hqPolicy ? "본사 정책이 먼저 설정되어야 합니다" : ""}
                      className={
                        "border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer font-medium ml-auto disabled:opacity-50 disabled:cursor-not-allowed " +
                        (isMissing
                          ? "bg-rk-orange hover:bg-rk-orange-deep text-white"
                          : "bg-rk-navy hover:bg-rk-navy-deep text-white")
                      }
                    >
                      {isMissing ? "+ 사은품 추가" : "✎ 편집"}
                    </button>
                  </>
                ) : (
                  draft && p.hqPolicy && (
                    <div className="flex flex-col gap-2 flex-1 min-w-[400px]">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] text-rk-muted">사은품 이름</span>
                          <input
                            type="text"
                            placeholder="예: 텀블러 세트"
                            value={draft.giftLabel}
                            onChange={e => setDraft(d => d ? { ...d, giftLabel: e.target.value } : d)}
                            className="border border-rk-line rounded px-2 py-1 text-[14px] outline-none focus:border-rk-navy"
                          />
                        </div>
                        <NumInput
                          label="사은품 금액"
                          value={draft.giftAmount}
                          onChange={v => setDraft(d => d ? { ...d, giftAmount: v } : d)}
                          placeholder="0"
                        />
                        <NumInput
                          label="설치비 면제"
                          value={draft.installAmount}
                          onChange={v => setDraft(d => d ? { ...d, installAmount: v } : d)}
                          placeholder="0"
                          hint={`(최대 ${fmt(p.hqPolicy.installSubsidy)})`}
                        />
                      </div>

                      {/* 영업자 마진 override */}
                      <div className="bg-rk-soft border border-rk-line-2 rounded px-2.5 py-2 mt-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[12px] text-rk-muted">영업자 마진 (상품별 override)</span>
                          <div className="flex gap-0.5">
                            <button
                              type="button"
                              onClick={() => setDraft(d => d ? { ...d, marginType: null } : d)}
                              className={"px-1.5 py-0.5 rounded text-[11px] border " + (draft.marginType == null ? "bg-rk-orange border-rk-orange text-white" : "bg-white border-rk-line text-rk-muted")}
                            >협력점 기본값</button>
                            <button
                              type="button"
                              onClick={() => setDraft(d => d ? { ...d, marginType: "fixed" } : d)}
                              className={"px-1.5 py-0.5 rounded text-[11px] border " + (draft.marginType === "fixed" ? "bg-rk-orange border-rk-orange text-white" : "bg-white border-rk-line text-rk-muted")}
                            >₩</button>
                            <button
                              type="button"
                              onClick={() => setDraft(d => d ? { ...d, marginType: "percent" } : d)}
                              className={"px-1.5 py-0.5 rounded text-[11px] border " + (draft.marginType === "percent" ? "bg-rk-orange border-rk-orange text-white" : "bg-white border-rk-line text-rk-muted")}
                            >%</button>
                          </div>
                        </div>
                        {draft.marginType === "fixed" && (
                          <NumInput
                            label="영업점이 가져갈 금액"
                            value={draft.marginAmount}
                            onChange={v => setDraft(d => d ? { ...d, marginAmount: v } : d)}
                            placeholder="0"
                          />
                        )}
                        {draft.marginType === "percent" && (
                          <NumInput
                            label="영업점이 가져갈 비율 (%)"
                            value={draft.marginPercent}
                            onChange={v => setDraft(d => d ? { ...d, marginPercent: v } : d)}
                            placeholder="0"
                          />
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-1 text-[13px] flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                          <span className="text-rk-muted">한도</span>
                          <span className="rk-num">
                            <b className={isOver ? "text-rk-sale" : "text-rk-ink"}>₩{fmt(used)}</b>
                            <span className="text-rk-muted"> / ₩{fmt(limit)}</span>
                          </span>
                          <div className="flex-1 bg-rk-line-2 h-1.5 rounded-full overflow-hidden max-w-[140px]">
                            <div
                              className={"h-full " + (isOver ? "bg-rk-sale" : isWarn ? "bg-rk-warn" : "bg-rk-success")}
                              style={{ width: pct + "%" }}
                            />
                          </div>
                          {isOver && <span className="text-rk-sale text-[13px] font-medium">⚠ 초과</span>}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={saving}
                            className="bg-white border border-rk-line text-rk-text px-3 py-1 rounded text-[13px] cursor-pointer"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            onClick={save}
                            disabled={saving || isOver}
                            className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saving ? "저장 중…" : "저장 · 사이트 반영"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {message?.code === p.productCode && (
                <div
                  className={
                    "px-3 py-1.5 text-[13px] border-t " +
                    (message.tone === "ok"
                      ? "bg-rk-tint-green text-rk-success border-rk-tint-green"
                      : "bg-rk-tint-red text-rk-sale border-rk-tint-red")
                  }
                >
                  {message.tone === "ok" ? "✓ " : "⚠ "}
                  {message.text}
                </div>
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-6 text-center text-rk-muted text-[14px]">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

function NumInput({
  label, value, onChange, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] text-rk-muted">
        {label}
        {hint && <span className="text-rk-faint ml-1">{hint}</span>}
      </span>
      <div className="flex items-stretch border border-rk-line rounded overflow-hidden">
        <span className="bg-rk-soft px-2 grid place-items-center text-[13px] text-rk-muted">₩</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-2 py-1 text-[14px] rk-num text-rk-ink outline-none bg-white"
        />
      </div>
    </div>
  );
}
