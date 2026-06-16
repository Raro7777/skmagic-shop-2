"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ProductOption = {
  productCode: string;
  name: string;
  modelName: string;
  category: string;
};

type Promotion = {
  id: string;
  productCode: string;
  enabled: boolean;
  badgeText: string;
  startsAt: string | null; // ISO
  endsAt: string | null;
  updatedAt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  water: "정수기", air: "공청", bidet: "비데", mattress: "매트리스", dryer: "건조기", kitchen: "주방", massage: "안마",
};

const isoToInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : "");
const inputToIso = (v: string): string | null => (v ? new Date(v + "T00:00:00.000Z").toISOString() : null);

export default function PromotionsManager() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 작업 중인 promotion id
  const [adding, setAdding] = useState<string>(""); // 추가하려는 productCode

  const productMap = useMemo(() => new Map(products.map(p => [p.productCode, p])), [products]);
  const usedCodes = useMemo(() => new Set(promotions.map(p => p.productCode)), [promotions]);
  const available = useMemo(() => products.filter(p => !usedCodes.has(p.productCode)), [products, usedCodes]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/franchise/promotions");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setPromotions(data.promotions ?? []);
      setProducts(data.products ?? []);
    } catch {
      setError("프로모션 로딩 실패 — 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (productCode: string) => {
    if (!productCode) return;
    setBusy("__new__");
    try {
      const res = await fetch("/api/franchise/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productCode, badgeText: "", enabled: true }),
      });
      if (!res.ok) throw new Error();
      const created = (await res.json()) as Promotion;
      setPromotions(prev => [created, ...prev]);
      setAdding("");
    } catch {
      setError("추가 실패");
    } finally {
      setBusy(null);
    }
  };

  const patch = async (id: string, patch: Partial<Promotion>) => {
    setBusy(id);
    try {
      const res = await fetch("/api/franchise/promotions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as Promotion;
      setPromotions(prev => prev.map(p => (p.id === id ? updated : p)));
    } catch {
      setError("수정 실패");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("이 프로모션을 삭제할까요?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/franchise/promotions?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setPromotions(prev => prev.filter(p => p.id !== id));
    } catch {
      setError("삭제 실패");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="text-center text-[13px] text-rk-muted py-8">로딩 중…</div>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-rk-tint-red text-rk-sale px-3 py-2 rounded text-[13px]">
          ⚠ {error}
        </div>
      )}

      {/* 추가 행 */}
      <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-3 flex items-center gap-2 flex-wrap">
        <b className="text-[13px] text-rk-muted">＋ 프로모션 추가</b>
        <select
          value={adding}
          onChange={e => setAdding(e.target.value)}
          disabled={available.length === 0 || busy === "__new__"}
          className="flex-1 min-w-[200px] border border-rk-line rounded px-2 py-1.5 text-[13px] bg-white"
        >
          <option value="">상품을 선택하세요…</option>
          {available.map(p => (
            <option key={p.productCode} value={p.productCode}>
              [{CATEGORY_LABEL[p.category] ?? p.category}] {p.name} ({p.modelName})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!adding || busy === "__new__"}
          onClick={() => create(adding)}
          className="bg-rk-orange hover:bg-rk-orange-deep disabled:opacity-50 disabled:cursor-not-allowed text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer"
        >
          {busy === "__new__" ? "추가 중…" : "+ 추가"}
        </button>
        {available.length === 0 && (
          <small className="text-[12px] text-rk-muted">모든 활성 상품에 프로모션이 등록됨</small>
        )}
      </div>

      {/* 행 리스트 */}
      {promotions.length === 0 ? (
        <div className="text-center text-[13px] text-rk-muted py-8 border border-dashed border-rk-line-2 rounded">
          등록된 프로모션이 없습니다. 위에서 상품을 선택해 추가하세요.
        </div>
      ) : (
        <div className="space-y-2">
          {promotions.map(p => {
            const product = productMap.get(p.productCode);
            const isBusy = busy === p.id;
            const isActive = isPromotionActive(p);
            return (
              <div
                key={p.id}
                className={
                  "border rounded p-3 flex flex-col gap-2 bg-white " +
                  (isActive ? "border-rk-orange/40 bg-rk-tint-orange/20" : "border-rk-line-2")
                }
              >
                {/* 상단: 상품명 + 상태 + 삭제 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    {product ? (
                      <>
                        <b className="text-[14px] text-rk-ink truncate block">
                          [{CATEGORY_LABEL[product.category] ?? product.category}] {product.name}
                        </b>
                        <small className="text-[12px] text-rk-muted font-mono">{product.modelName}</small>
                      </>
                    ) : (
                      <b className="text-[14px] text-rk-faint">{p.productCode} (상품 없음)</b>
                    )}
                  </div>
                  <label className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.enabled}
                      disabled={isBusy}
                      onChange={e => patch(p.id, { enabled: e.target.checked })}
                      className="w-4 h-4 accent-rk-orange cursor-pointer"
                    />
                    <span className={p.enabled ? "text-rk-orange-deep font-semibold" : "text-rk-muted"}>
                      {p.enabled ? "ON" : "OFF"}
                    </span>
                  </label>
                  <span
                    className={
                      "text-[11px] px-1.5 py-0.5 rounded font-medium " +
                      (isActive
                        ? "bg-rk-success text-white"
                        : "bg-rk-muted/15 text-rk-muted")
                    }
                  >
                    {isActive ? "✓ 노출 중" : "미노출"}
                  </span>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => remove(p.id)}
                    className="text-rk-sale hover:underline text-[12px] cursor-pointer"
                  >
                    삭제
                  </button>
                </div>

                {/* 하단: 문구 + 기간 */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <input
                    type="text"
                    defaultValue={p.badgeText}
                    placeholder="예: 18개월 반값 할인!"
                    maxLength={40}
                    disabled={isBusy}
                    onBlur={e => {
                      const v = e.target.value;
                      if (v !== p.badgeText) patch(p.id, { badgeText: v });
                    }}
                    className="px-2 py-1.5 border border-rk-line rounded text-[13px] bg-white"
                  />
                  <div className="flex items-center gap-1 text-[12px] text-rk-muted">
                    <input
                      type="date"
                      defaultValue={isoToInput(p.startsAt)}
                      disabled={isBusy}
                      onChange={e => patch(p.id, { startsAt: inputToIso(e.target.value) })}
                      className="px-2 py-1.5 border border-rk-line rounded text-[13px] bg-white"
                    />
                    <span>~</span>
                    <input
                      type="date"
                      defaultValue={isoToInput(p.endsAt)}
                      disabled={isBusy}
                      onChange={e => patch(p.id, { endsAt: inputToIso(e.target.value) })}
                      className="px-2 py-1.5 border border-rk-line rounded text-[13px] bg-white"
                    />
                  </div>
                  <small className="text-[11px] text-rk-muted whitespace-nowrap">
                    {isBusy ? "저장 중…" : "변경 시 자동 저장"}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        💡 <b>노출 조건</b> — ON + 문구 입력 + 현재 날짜가 시작일~종료일 범위.<br />
        시작일/종료일을 비워두면 무제한 노출. 사용자 페이지 상품 카드의 "카드할인" 위에 주황 뱃지로 표시됩니다.
      </div>
    </div>
  );
}

function isPromotionActive(p: Promotion): boolean {
  if (!p.enabled) return false;
  if (!p.badgeText.trim()) return false;
  const now = Date.now();
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return false;
  if (p.endsAt && new Date(p.endsAt).getTime() < now) return false;
  return true;
}
