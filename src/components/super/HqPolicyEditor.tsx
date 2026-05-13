"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type ProductPolicy = {
  productCode: string;
  category: string;
  name: string;
  modelName: string;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  managementType: string;
  hqPolicy: {
    baseCommission: number;
    monthIncentive: number;
    refundLimitRatio: number;
    installSubsidy: number;
  } | null;
};

type Draft = {
  rentalPrice: string;
  cardDiscountPrice: string;
  baseCommission: string;
  monthIncentive: string;
  installSubsidy: string;
};

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("ko-KR"));
const numOrNull = (s: string): number | null => {
  const cleaned = s.replace(/[, ]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

type Filter = "all" | "missing" | "present";

export default function HqPolicyEditor() {
  const [items, setItems] = useState<ProductPolicy[]>([]);
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
      const res = await fetch("/api/policies/hq", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setError("본사 권한 필요");
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
      if (filter === "missing" && p.hqPolicy) return false;
      if (filter === "present" && !p.hqPolicy) return false;
      if (q && !`${p.productCode} ${p.name} ${p.modelName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, filter]);

  const missingCount = items.filter(i => !i.hqPolicy).length;

  const startEdit = (p: ProductPolicy) => {
    setMessage(null);
    setEditingCode(p.productCode);
    setDraft({
      rentalPrice: String(p.rentalPrice),
      cardDiscountPrice: p.cardDiscountPrice != null ? String(p.cardDiscountPrice) : "",
      baseCommission: String(p.hqPolicy?.baseCommission ?? ""),
      monthIncentive: String(p.hqPolicy?.monthIncentive ?? 0),
      installSubsidy: String(p.hqPolicy?.installSubsidy ?? 30000),
    });
  };
  const cancelEdit = () => {
    setEditingCode(null);
    setDraft(null);
  };

  const save = async () => {
    if (!editingCode || !draft) return;
    setMessage(null);

    const rentalPrice = numOrNull(draft.rentalPrice);
    const cardDiscountPrice = draft.cardDiscountPrice.trim() === "" ? null : numOrNull(draft.cardDiscountPrice);
    const baseCommission = numOrNull(draft.baseCommission);
    const monthIncentive = numOrNull(draft.monthIncentive) ?? 0;
    const installSubsidy = numOrNull(draft.installSubsidy) ?? 0;

    if (rentalPrice == null || rentalPrice <= 0) {
      setMessage({ tone: "err", text: "월 렌탈료(운영가)는 0원보다 커야 합니다.", code: editingCode });
      return;
    }
    if (cardDiscountPrice != null && cardDiscountPrice > rentalPrice) {
      setMessage({ tone: "err", text: "카드할인가는 월 렌탈료보다 클 수 없습니다.", code: editingCode });
      return;
    }
    if (baseCommission == null || baseCommission <= 0) {
      setMessage({ tone: "err", text: "본사 기본 수수료는 0원보다 커야 합니다.", code: editingCode });
      return;
    }

    setSaving(true);
    try {
      // 1) Product 가격 업데이트
      const productRes = await fetch(`/api/products/${editingCode}/admin`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rentalPrice, cardDiscountPrice }),
      });
      if (!productRes.ok) {
        const data = await productRes.json().catch(() => ({}));
        setMessage({ tone: "err", text: data.error ?? "상품 가격 저장 실패", code: editingCode });
        return;
      }

      // 2) HqPolicy 업데이트(없으면 생성)
      const policyRes = await fetch(`/api/policies/hq/${editingCode}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseCommission, monthIncentive, installSubsidy }),
      });
      const policyData = await policyRes.json();
      if (!policyRes.ok) {
        setMessage({ tone: "err", text: policyData.error ?? "정책 저장 실패", code: editingCode });
        return;
      }

      setMessage({ tone: "ok", text: "저장 완료 — 모든 협력점에 즉시 반영됩니다.", code: editingCode });
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
          💰 본사 기준 정책 편집
          <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-tint-green text-rk-success font-medium ml-1.5">live</span>
        </h3>
        <span className="ml-auto text-[13px] text-rk-muted">{items.length}개 상품 · 변경은 모든 협력점에 즉시 반영</span>
      </div>

      {/* Filter / Search toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 sticky top-0 bg-white pb-2 z-10">
        <input
          type="search"
          placeholder="상품명·코드 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] w-[200px] focus:outline-none focus:border-rk-navy"
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
              ? "bg-rk-sale text-white border-rk-sale"
              : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")
          }
        >
          ⚠ 정책 없음 {missingCount}
        </button>
        <button
          type="button"
          onClick={() => setFilter("present")}
          className={
            "px-2.5 py-1 rounded text-[13px] font-medium border " +
            (filter === "present"
              ? "bg-rk-success text-white border-rk-success"
              : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")
          }
        >
          ✓ 입력 완료 {items.length - missingCount}
        </button>
        <span className="ml-auto text-[13px] text-rk-muted">표시 {visible.length}개</span>
      </div>

      <div className="bg-rk-tint-orange text-rk-orange-deep px-2.5 py-2 rounded text-[13px] mb-3 leading-[1.5]">
        💡 정책 입력 시 본사 시트(부가세 제외)의 <b>운영가</b>·<b>판촉가</b>·<b>수수료 합계</b>를 그대로 입력하세요.
      </div>

      <div className="flex flex-col gap-1.5">
        {visible.map(p => {
          const isEditing = editingCode === p.productCode;
          const policy = p.hqPolicy;
          const isMissing = !policy;
          const totalCommission = policy ? policy.baseCommission + policy.monthIncentive : 0;

          return (
            <div
              key={p.productCode}
              className={
                "border rounded-md transition-colors " +
                (isEditing
                  ? "border-rk-navy bg-rk-soft-2"
                  : isMissing
                    ? "border-rk-sale/30 bg-rk-tint-red/30"
                    : "border-rk-line-2 hover:bg-rk-soft-2")
              }
            >
              <div className="px-3 py-2.5 flex items-center gap-3 flex-wrap">
                <div className="min-w-[220px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <b className="text-[14px] text-rk-ink">{p.name}</b>
                    {isMissing && (
                      <span className="text-[9px] px-1.5 py-px rounded bg-rk-sale text-white font-semibold">
                        ⚠ 정책 없음
                      </span>
                    )}
                  </div>
                  <small className="text-[12px] text-rk-faint font-mono">
                    {p.modelName} · {p.managementType} · 의무 {p.contractPeriod}개월
                  </small>
                </div>

                {!isEditing ? (
                  <>
                    <div className="flex items-center gap-3 text-[13px] flex-1 min-w-[280px]">
                      <div className="flex items-center gap-1">
                        <span className="text-rk-muted">월</span>
                        <b className="rk-num text-rk-ink">₩{fmt(p.rentalPrice)}</b>
                        {p.cardDiscountPrice != null && (
                          <small className="text-rk-sale">
                            (카드 ₩{fmt(p.cardDiscountPrice)})
                          </small>
                        )}
                      </div>
                      <div className="h-3 w-px bg-rk-line-2" />
                      {policy ? (
                        <div className="flex items-center gap-1">
                          <span className="text-rk-muted">수수료</span>
                          <b className="rk-num text-rk-success">+₩{fmt(policy.baseCommission)}</b>
                          {policy.monthIncentive > 0 && (
                            <>
                              <span className="text-rk-muted">+</span>
                              <b className="rk-num text-rk-orange-deep">₩{fmt(policy.monthIncentive)}</b>
                              <small className="text-rk-faint">인센</small>
                            </>
                          )}
                          <span className="text-rk-muted">=</span>
                          <b className="rk-num text-rk-ink">₩{fmt(totalCommission)}</b>
                          <span className="text-rk-muted">/대</span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-rk-sale">수수료 미설정</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className={
                        "border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer font-medium ml-auto " +
                        (isMissing
                          ? "bg-rk-sale hover:opacity-90 text-white"
                          : "bg-rk-navy hover:bg-rk-navy-deep text-white")
                      }
                    >
                      {isMissing ? "+ 정책 추가" : "✎ 편집"}
                    </button>
                  </>
                ) : (
                  draft && (
                    <div className="flex flex-col gap-2 flex-1 min-w-[400px]">
                      <div className="grid grid-cols-2 gap-2">
                        <NumInput
                          label="월 렌탈료 (운영가)"
                          value={draft.rentalPrice}
                          onChange={v => setDraft(d => d ? { ...d, rentalPrice: v } : d)}
                          required
                        />
                        <NumInput
                          label="카드할인가 (판촉가)"
                          value={draft.cardDiscountPrice}
                          placeholder="없으면 비우기"
                          onChange={v => setDraft(d => d ? { ...d, cardDiscountPrice: v } : d)}
                        />
                        <NumInput
                          label="본사 기본 수수료"
                          value={draft.baseCommission}
                          onChange={v => setDraft(d => d ? { ...d, baseCommission: v } : d)}
                          required
                          highlight
                        />
                        <NumInput
                          label="이번 달 인센티브"
                          value={draft.monthIncentive}
                          onChange={v => setDraft(d => d ? { ...d, monthIncentive: v } : d)}
                          hint="(기간 한정)"
                        />
                        <NumInput
                          label="설치비 보조"
                          value={draft.installSubsidy}
                          onChange={v => setDraft(d => d ? { ...d, installSubsidy: v } : d)}
                        />
                      </div>
                      <div className="flex justify-between items-center mt-1 text-[13px] flex-wrap gap-2">
                        <span className="text-rk-muted">
                          → 협력점 수령 합계: <b className="rk-num text-rk-ink">
                            ₩{fmt((numOrNull(draft.baseCommission) ?? 0) + (numOrNull(draft.monthIncentive) ?? 0))}
                          </b>
                        </span>
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
                            disabled={saving}
                            className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1 rounded text-[13px] cursor-pointer font-medium disabled:opacity-50"
                          >
                            {saving ? "저장 중…" : "저장 · 일괄 적용"}
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
  label, value, onChange, placeholder, hint, required, highlight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] text-rk-muted">
        {label}
        {required && <span className="text-rk-sale ml-0.5">*</span>}
        {hint && <span className="text-rk-faint ml-1">{hint}</span>}
      </span>
      <div className={"flex items-stretch border rounded overflow-hidden " + (highlight ? "border-rk-navy" : "border-rk-line")}>
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
