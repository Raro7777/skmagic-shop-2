"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

/**
 * 본사 HqPolicy 매트릭스 편집기.
 *
 *   - 상품 1개 = (mode, contractPeriod) 옵션 N개.
 *   - 옵션마다 baseCommission · monthIncentive · installSubsidy 편집 가능.
 *   - 옵션 추가 / 옵션 삭제 지원.
 */

type Option = {
  mode: string;
  contractPeriod: number;
  visitInterval: string | null;
  baseCommission: number;
  monthIncentive: number;
  refundLimitRatio: number;
  installSubsidy: number;
  // 본사 마진 override — null 이면 티어 기본값 사용
  marginType: "fixed" | "percent" | null;
  marginAmount: number | null;
  marginPercent: number | null;
};

type ProductPolicy = {
  productCode: string;
  category: string;
  name: string;
  modelName: string;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  managementType: string;
  hqPolicy: (Option & { mode: string; contractPeriod: number }) | null; // 대표 정책 (호환용)
  options: Option[]; // 매트릭스 전체
};

type Filter = "all" | "missing" | "present";

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("ko-KR"));
const numOrNull = (s: string): number | null => {
  const cleaned = s.replace(/[, ]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

const MODE_OPTIONS = ["방문형", "셀프형", "자가관리"] as const;
const PERIOD_OPTIONS = [36, 48, 60, 72, 84];

const CATEGORY_LABEL: Record<string, string> = {
  water: "정수기", bidet: "비데", air: "공기청정기", mattress: "매트리스",
  massage: "안마", dryer: "건조기", kitchen: "주방",
};

export default function HqPolicyEditor() {
  const [items, setItems] = useState<ProductPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ code: string; mode: string; period: number } | null>(null);
  const [draft, setDraft] = useState<{
    baseCommission: string;
    monthIncentive: string;
    installSubsidy: string;
    // 옵션 마진 override — marginType=null 이면 "티어 기본값 사용"
    marginType: "fixed" | "percent" | null;
    marginAmount: string;
    marginPercent: string;
  } | null>(null);
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
      const hasAny = p.options.length > 0;
      if (filter === "missing" && hasAny) return false;
      if (filter === "present" && !hasAny) return false;
      if (q && !`${p.productCode} ${p.name} ${p.modelName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, filter]);

  const missingCount = items.filter(i => i.options.length === 0).length;

  const startEdit = (code: string, opt: Option) => {
    setMessage(null);
    setEditing({ code, mode: opt.mode, period: opt.contractPeriod });
    setDraft({
      baseCommission: String(opt.baseCommission),
      monthIncentive: String(opt.monthIncentive),
      installSubsidy: String(opt.installSubsidy),
      marginType: opt.marginType,
      marginAmount: opt.marginAmount != null ? String(opt.marginAmount) : "",
      marginPercent: opt.marginPercent != null ? String((opt.marginPercent * 100).toFixed(2).replace(/\.?0+$/, "")) : "",
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft(null);
  };

  const save = async () => {
    if (!editing || !draft) return;
    setMessage(null);

    const baseCommission = numOrNull(draft.baseCommission);
    const monthIncentive = numOrNull(draft.monthIncentive) ?? 0;
    const installSubsidy = numOrNull(draft.installSubsidy) ?? 0;

    if (baseCommission == null || baseCommission <= 0) {
      setMessage({ tone: "err", text: "본사 기본 수수료는 0원보다 커야 합니다.", code: editing.code });
      return;
    }

    // 본사마진 override: marginType=null → null/null/null 로 clear, 아니면 해당 값만 set
    const marginPayload: { marginType: "fixed" | "percent" | null; marginAmount: number | null; marginPercent: number | null } =
      draft.marginType == null
        ? { marginType: null, marginAmount: null, marginPercent: null }
        : draft.marginType === "fixed"
          ? { marginType: "fixed", marginAmount: numOrNull(draft.marginAmount) ?? 0, marginPercent: null }
          : { marginType: "percent", marginAmount: null, marginPercent: (Number(draft.marginPercent) || 0) / 100 };

    setSaving(true);
    try {
      const res = await fetch(`/api/policies/hq/${editing.code}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: editing.mode,
          contractPeriod: editing.period,
          baseCommission,
          monthIncentive,
          installSubsidy,
          ...marginPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error ?? "저장 실패", code: editing.code });
        return;
      }
      setMessage({ tone: "ok", text: `${editing.mode} ${editing.period}개월 옵션 저장 완료 — 모든 협력점에 즉시 반영.`, code: editing.code });
      setEditing(null);
      setDraft(null);
      await fetchData();
    } catch {
      setMessage({ tone: "err", text: "네트워크 오류", code: editing.code });
    } finally {
      setSaving(false);
    }
  };

  // "+ 옵션 추가" 클릭 시 DB 에 자동 default 30000 으로 저장하지 않고,
  // 그 셀을 즉시 편집 모드로 열어 정책서 값을 사용자가 직접 입력 + 저장 누를 때 INSERT 되도록.
  // — "정책서 가격 우선" 룰: default 값이 잘못 정착되는 일을 막음.
  const addOption = (code: string, mode: string, period: number) => {
    setMessage(null);
    const existing = items.find(p => p.productCode === code)?.options.find(o => o.mode === mode && o.contractPeriod === period);
    if (existing) {
      setMessage({ tone: "err", text: "이미 존재하는 옵션입니다.", code });
      return;
    }
    setEditing({ code, mode, period });
    setDraft({
      baseCommission: "",          // ← 정책서 값을 직접 입력 (default 자동 채움 X)
      monthIncentive: "",
      installSubsidy: "",
      marginType: null,
      marginAmount: "",
      marginPercent: "",
    });
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
          💰 본사 기준 정책 (옵션 매트릭스)
          <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-tint-green text-rk-success font-medium ml-1.5">live</span>
        </h3>
        <span className="ml-auto text-[13px] text-rk-muted">{items.length}개 상품 · 행 클릭으로 매트릭스 펼침</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3 sticky top-0 bg-white pb-2 z-10">
        <input
          type="search"
          placeholder="상품명·코드 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] w-[200px] focus:outline-none focus:border-rk-navy"
        />
        <button type="button" onClick={() => setFilter("all")} className={"px-2.5 py-1 rounded text-[13px] font-medium border " + (filter === "all" ? "bg-rk-navy text-white border-rk-navy" : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")}>
          전체 {items.length}
        </button>
        <button type="button" onClick={() => setFilter("missing")} className={"px-2.5 py-1 rounded text-[13px] font-medium border " + (filter === "missing" ? "bg-rk-sale text-white border-rk-sale" : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")}>
          ⚠ 옵션 없음 {missingCount}
        </button>
        <button type="button" onClick={() => setFilter("present")} className={"px-2.5 py-1 rounded text-[13px] font-medium border " + (filter === "present" ? "bg-rk-success text-white border-rk-success" : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft")}>
          ✓ 옵션 보유 {items.length - missingCount}
        </button>
        <span className="ml-auto text-[13px] text-rk-muted">표시 {visible.length}개</span>
      </div>

      <div className="bg-rk-tint-orange text-rk-orange-deep px-2.5 py-2 rounded text-[13px] mb-3 leading-[1.5]">
        💡 각 상품은 <b>방문형/셀프형/자가관리 × 36/48/60/72/84개월</b> 옵션마다 본사 수수료가 다릅니다.
        상품 행 클릭으로 매트릭스 펼치고, 셀 클릭으로 편집.
      </div>

      <div className="flex flex-col gap-1.5">
        {visible.map(p => {
          const isExpanded = expandedCode === p.productCode;
          const isMissing = p.options.length === 0;

          return (
            <div
              key={p.productCode}
              className={
                "border rounded-md transition-colors " +
                (isExpanded ? "border-rk-navy bg-rk-soft-2"
                  : isMissing ? "border-rk-sale/30 bg-rk-tint-red/30"
                    : "border-rk-line-2 hover:bg-rk-soft-2")
              }
            >
              <button
                type="button"
                onClick={() => setExpandedCode(isExpanded ? null : p.productCode)}
                className="w-full px-3 py-2.5 flex items-center gap-3 flex-wrap text-left bg-transparent border-0 cursor-pointer"
              >
                <div className="min-w-[260px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <b className="text-[14px] text-rk-ink">{p.name}</b>
                    {isMissing && <span className="text-[9px] px-1.5 py-px rounded bg-rk-sale text-white font-semibold">⚠ 옵션 없음</span>}
                  </div>
                  <small className="text-[12px] text-rk-faint font-mono">
                    {p.modelName} · {CATEGORY_LABEL[p.category] ?? p.category} · 기본 {p.contractPeriod}개월
                  </small>
                </div>
                <div className="flex items-center gap-2 text-[13px] flex-1 flex-wrap">
                  <span className="text-rk-muted">옵션 수</span>
                  <b className="rk-num text-rk-ink">{p.options.length}</b>
                  <span className="text-rk-muted">·</span>
                  <span className="text-rk-muted">월</span>
                  <b className="rk-num text-rk-ink">₩{fmt(p.rentalPrice)}</b>
                  {p.cardDiscountPrice != null && (
                    <small className="text-rk-sale">(카드 ₩{fmt(p.cardDiscountPrice)})</small>
                  )}
                </div>
                <span className="text-[18px] text-rk-muted ml-auto">{isExpanded ? "▾" : "▸"}</span>
              </button>

              {isExpanded && (
                <div className="border-t border-rk-line-2 px-3 py-3">
                  <OptionMatrix
                    product={p}
                    editing={editing}
                    draft={draft}
                    saving={saving}
                    onStartEdit={startEdit}
                    onCancel={cancelEdit}
                    onSave={save}
                    onChangeDraft={(k, v) => setDraft(d => d ? ({ ...d, [k]: v } as typeof d) : d)}
                    onAddOption={addOption}
                  />
                </div>
              )}

              {message?.code === p.productCode && (
                <div className={"px-3 py-1.5 text-[13px] border-t " + (message.tone === "ok" ? "bg-rk-tint-green text-rk-success border-rk-tint-green" : "bg-rk-tint-red text-rk-sale border-rk-tint-red")}>
                  {message.tone === "ok" ? "✓ " : "⚠ "}{message.text}
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

/**
 * 상품 1개의 옵션 매트릭스. mode × contractPeriod 그리드.
 */
function OptionMatrix({
  product, editing, draft, saving,
  onStartEdit, onCancel, onSave, onChangeDraft, onAddOption,
}: {
  product: ProductPolicy;
  editing: { code: string; mode: string; period: number } | null;
  draft: {
    baseCommission: string;
    monthIncentive: string;
    installSubsidy: string;
    marginType: "fixed" | "percent" | null;
    marginAmount: string;
    marginPercent: string;
  } | null;
  saving: boolean;
  onStartEdit: (code: string, opt: Option) => void;
  onCancel: () => void;
  onSave: () => void;
  onChangeDraft: (k: "baseCommission" | "monthIncentive" | "installSubsidy" | "marginType" | "marginAmount" | "marginPercent", v: string | null) => void;
  onAddOption: (code: string, mode: string, period: number) => void;
}) {
  // 매트릭스를 (mode, contractPeriod) 키로 인덱싱
  const matrix: Record<string, Option> = {};
  for (const o of product.options) {
    matrix[`${o.mode}|${o.contractPeriod}`] = o;
  }
  const usedModesSet = new Set(product.options.map(o => o.mode));
  const usedPeriodsSet = new Set(product.options.map(o => o.contractPeriod));
  // 신규 옵션 입력 중(editing) 이면 그 (mode, period) 칸도 매트릭스에 강제 노출 — 입력 셀이 화면에 나타나도록.
  if (editing && editing.code === product.productCode) {
    usedModesSet.add(editing.mode);
    usedPeriodsSet.add(editing.period);
  }
  const usedModes = Array.from(usedModesSet);
  const usedPeriods = Array.from(usedPeriodsSet).sort((a, b) => a - b);
  const displayModes = usedModes.length > 0 ? usedModes : ["방문형"];
  const displayPeriods = usedPeriods.length > 0 ? usedPeriods : [60];

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-rk-muted bg-rk-soft border border-rk-line-2 min-w-[90px]">옵션 / 약정</th>
              {displayPeriods.map(period => (
                <th key={period} className="px-2 py-1.5 text-center font-medium text-rk-muted bg-rk-soft border border-rk-line-2 min-w-[140px]">
                  {period}개월
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayModes.map(mode => (
              <tr key={mode}>
                <td className="px-2 py-1.5 font-medium text-rk-ink bg-rk-soft-2 border border-rk-line-2">{mode}</td>
                {displayPeriods.map(period => {
                  const opt = matrix[`${mode}|${period}`];
                  // editing 일치하면 opt 없어도 편집 UI 노출 (정책서 값 직접 입력 흐름)
                  const isEditing = editing?.code === product.productCode && editing.mode === mode && editing.period === period;

                  if (isEditing && draft) {
                    return (
                      <td key={period} className="px-2 py-2 bg-rk-navy/10 border border-rk-navy">
                        <div className="flex flex-col gap-1">
                          <NumField label="수수료" value={draft.baseCommission} onChange={v => onChangeDraft("baseCommission", v)} />
                          <NumField label="인센티브" value={draft.monthIncentive} onChange={v => onChangeDraft("monthIncentive", v)} />
                          <NumField label="설치보조" value={draft.installSubsidy} onChange={v => onChangeDraft("installSubsidy", v)} />
                          {/* 본사마진 override */}
                          <div className="bg-rk-soft border border-rk-line-2 rounded p-1.5 mt-1">
                            <div className="text-[10px] text-rk-muted mb-1">본사마진 override</div>
                            <div className="flex gap-0.5 mb-1">
                              <button
                                type="button"
                                onClick={() => onChangeDraft("marginType", null)}
                                className={"flex-1 px-1 py-0.5 rounded text-[10px] border " + (draft.marginType == null ? "bg-rk-orange border-rk-orange text-white" : "bg-white border-rk-line text-rk-muted")}
                              >티어값</button>
                              <button
                                type="button"
                                onClick={() => onChangeDraft("marginType", "fixed")}
                                className={"flex-1 px-1 py-0.5 rounded text-[10px] border " + (draft.marginType === "fixed" ? "bg-rk-orange border-rk-orange text-white" : "bg-white border-rk-line text-rk-muted")}
                              >₩</button>
                              <button
                                type="button"
                                onClick={() => onChangeDraft("marginType", "percent")}
                                className={"flex-1 px-1 py-0.5 rounded text-[10px] border " + (draft.marginType === "percent" ? "bg-rk-orange border-rk-orange text-white" : "bg-white border-rk-line text-rk-muted")}
                              >%</button>
                            </div>
                            {draft.marginType === "fixed" && (
                              <NumField label="₩" value={draft.marginAmount} onChange={v => onChangeDraft("marginAmount", v)} />
                            )}
                            {draft.marginType === "percent" && (
                              <NumField label="%" value={draft.marginPercent} onChange={v => onChangeDraft("marginPercent", v)} />
                            )}
                          </div>
                          <div className="flex gap-1 mt-1">
                            <button type="button" onClick={onCancel} disabled={saving} className="flex-1 bg-white border border-rk-line text-rk-text px-1.5 py-0.5 rounded text-[12px] cursor-pointer">취소</button>
                            <button type="button" onClick={onSave} disabled={saving} className="flex-1 bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-1.5 py-0.5 rounded text-[12px] cursor-pointer disabled:opacity-50">
                              {saving ? "저장중" : "저장"}
                            </button>
                          </div>
                        </div>
                      </td>
                    );
                  }

                  if (opt) {
                    const total = opt.baseCommission + opt.monthIncentive;
                    // 본사마진 override 표기 (티어 기본값은 여기서 모르므로 override 만 노출)
                    const marginText = opt.marginType === "fixed" && opt.marginAmount != null
                      ? `−₩${fmt(opt.marginAmount)} (override)`
                      : opt.marginType === "percent" && opt.marginPercent != null
                        ? `−${(opt.marginPercent * 100).toFixed(1)}% (override)`
                        : null;
                    return (
                      <td
                        key={period}
                        onClick={() => onStartEdit(product.productCode, opt)}
                        className="px-2 py-1.5 border border-rk-line-2 hover:bg-rk-tint-orange/40 cursor-pointer"
                      >
                        <div className="rk-num text-rk-ink font-semibold">₩{fmt(opt.baseCommission)}</div>
                        {opt.monthIncentive > 0 && (
                          <div className="rk-num text-[11px] text-rk-orange-deep">+{fmt(opt.monthIncentive)} 인센</div>
                        )}
                        <div className="rk-num text-[11px] text-rk-success">합 ₩{fmt(total)}</div>
                        {marginText && (
                          <div className="text-[10px] text-rk-info mt-0.5">{marginText}</div>
                        )}
                      </td>
                    );
                  }

                  return (
                    <td key={period} className="px-2 py-1.5 border border-rk-line-2 bg-rk-soft/40 text-center">
                      <button
                        type="button"
                        onClick={() => onAddOption(product.productCode, mode, period)}
                        disabled={saving}
                        className="text-[11px] text-rk-info hover:underline cursor-pointer disabled:opacity-50"
                      >
                        + 옵션 추가
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* 추가 모드 row — 매트릭스에 없는 mode 추가 가능 */}
            <tr>
              <td colSpan={displayPeriods.length + 1} className="px-2 py-1.5 bg-rk-soft border border-rk-line-2 text-[12px] text-rk-muted">
                다른 옵션 모드/약정 추가:
                <div className="inline-flex gap-1 ml-2 flex-wrap">
                  {MODE_OPTIONS.map(m => (
                    PERIOD_OPTIONS.map(period => {
                      if (matrix[`${m}|${period}`]) return null;
                      return (
                        <button
                          key={`${m}-${period}`}
                          type="button"
                          onClick={() => onAddOption(product.productCode, m, period)}
                          disabled={saving}
                          className="text-[11px] bg-white border border-rk-line rounded px-1.5 py-0.5 text-rk-muted hover:border-rk-orange hover:text-rk-orange-deep cursor-pointer disabled:opacity-50"
                        >
                          + {m} {period}개월
                        </button>
                      );
                    })
                  ))}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-rk-faint mt-2">
        ⓘ 셀 클릭으로 해당 옵션의 수수료·인센티브·설치보조 편집. 변경 시 정산 계산에 즉시 반영. 협력점 사은품 환원 한도는 옵션별 수수료의 ⅔.
      </p>
    </>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-stretch border border-rk-line rounded overflow-hidden">
      <span className="bg-rk-soft px-1.5 grid place-items-center text-[10px] text-rk-muted min-w-[40px]">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 px-1.5 py-0.5 text-[12px] rk-num text-rk-ink outline-none bg-white w-0 min-w-0"
      />
    </div>
  );
}
