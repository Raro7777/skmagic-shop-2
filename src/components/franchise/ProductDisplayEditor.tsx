"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Product = {
  productCode: string;
  name: string;
  modelName: string;
  category: string;
  imageUrl: string | null;
  rentalPrice: number;
};

type DisplayConfig = {
  picks: string[];
  ranking: Record<string, string[]>;
};

const fmt = (n: number) => n.toLocaleString("ko-KR");
const SLOTS: Array<{ key: string; label: string; type: "picks" | "ranking"; ranking?: string }> = [
  { key: "picks",         label: "🌟 점장 추천 (메인 picks)", type: "picks" },
  { key: "ranking_water", label: "💧 정수기 랭킹",            type: "ranking", ranking: "water" },
  { key: "ranking_air",   label: "💨 공기청정기 랭킹",        type: "ranking", ranking: "air" },
  { key: "ranking_bidet", label: "🚿 비데 랭킹",              type: "ranking", ranking: "bidet" },
];

const MAX_SIZE: Record<string, number> = {
  picks: 8,
  ranking_water: 4,
  ranking_air: 4,
  ranking_bidet: 4,
};

const CATEGORY_LABEL: Record<string, string> = {
  water: "정수기", air: "공청", bidet: "비데", mattress: "매트리스", dryer: "건조기", kitchen: "주방", massage: "안마",
};

export default function ProductDisplayEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<DisplayConfig>({ picks: [], ranking: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<string>("picks");
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const productMap = useMemo(() => new Map(products.map(p => [p.productCode, p])), [products]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/franchise/display-config", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setError("협력점 권한 필요");
        else throw new Error();
        return;
      }
      const j = await res.json();
      setConfig(j.config);
      setProducts(j.products);
      setError(null);
    } catch {
      setError("진열 설정 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Slot에 따라 현재 codes 가져오기/설정
  const slotDef = SLOTS.find(s => s.key === activeSlot)!;
  const currentCodes: string[] = useMemo(() => {
    if (slotDef.type === "picks") return config.picks ?? [];
    return config.ranking?.[slotDef.ranking!] ?? [];
  }, [config, slotDef]);

  const setSlotCodes = (next: string[]) => {
    setDirty(true);
    if (slotDef.type === "picks") {
      setConfig(c => ({ ...c, picks: next }));
    } else {
      setConfig(c => ({
        ...c,
        ranking: { ...(c.ranking ?? {}), [slotDef.ranking!]: next },
      }));
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const codes = currentCodes;
    const oldIndex = codes.indexOf(active.id as string);
    const newIndex = codes.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    setSlotCodes(arrayMove(codes, oldIndex, newIndex));
  };

  const addToSlot = (code: string) => {
    if (currentCodes.includes(code)) return;
    if (currentCodes.length >= (MAX_SIZE[activeSlot] ?? 99)) {
      setFlash(`최대 ${MAX_SIZE[activeSlot]}개까지 추가 가능합니다`);
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    setSlotCodes([...currentCodes, code]);
  };

  const removeFromSlot = (code: string) => {
    setSlotCodes(currentCodes.filter(c => c !== code));
  };

  const save = async () => {
    setSaving(true);
    setFlash(null);
    try {
      const res = await fetch("/api/franchise/display-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const j = await res.json();
      if (!res.ok) {
        setFlash(j.error ?? "저장 실패");
        return;
      }
      setFlash("저장 완료 — 우리 사이트에 즉시 반영");
      setConfig(j.config);
      setDirty(false);
    } catch {
      setFlash("네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  // 좌측 패널용 — 현재 slot에 안 들어간 상품들
  const availableProducts = useMemo(() => {
    let pool = products;
    if (slotDef.type === "ranking") {
      pool = pool.filter(p => p.category === slotDef.ranking);
    }
    if (filter !== "all" && slotDef.type === "picks") {
      pool = pool.filter(p => p.category === filter);
    }
    return pool.filter(p => !currentCodes.includes(p.productCode));
  }, [products, slotDef, filter, currentCodes]);

  if (loading) {
    return <div className="bg-white border border-rk-line rounded-lg p-4 text-center text-[14px] text-rk-muted py-6">진열 설정 로딩 중…</div>;
  }
  if (error) {
    return <div className="bg-white border border-rk-line rounded-lg p-4"><div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded">⚠ {error}</div></div>;
  }

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">🎯 메인 페이지 진열 순서 편집</h3>
        <span className="text-[13px] text-rk-muted">드래그로 순서 변경 · 좌측 카드 클릭으로 추가 · 저장 시 사이트 즉시 반영</span>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={save}
          className="ml-auto bg-rk-navy hover:bg-rk-navy-deep disabled:opacity-50 disabled:cursor-not-allowed text-white border-0 px-3.5 py-1.5 rounded text-[14px] font-medium cursor-pointer"
        >
          {saving ? "저장 중…" : dirty ? "💾 변경 저장" : "변경 없음"}
        </button>
      </div>

      {flash && (
        <div className="bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] mb-2">{flash}</div>
      )}

      {/* Slot 선택 */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {SLOTS.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveSlot(s.key)}
            className={
              "px-3 py-1.5 rounded text-[13px] font-medium border " +
              (activeSlot === s.key
                ? "bg-rk-orange text-white border-rk-orange"
                : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft-2")
            }
          >
            {s.label}
            {(() => {
              const codes = s.type === "picks" ? (config.picks ?? []) : (config.ranking?.[s.ranking!] ?? []);
              return codes.length > 0 ? <span className="ml-1.5 opacity-80">{codes.length}</span> : null;
            })()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 좌: 추가 가능한 상품 */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <h4 className="text-[14px] font-semibold text-rk-muted">사용 가능 상품 ({availableProducts.length})</h4>
            {slotDef.type === "picks" && (
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="ml-auto border border-rk-line rounded px-2 py-0.5 text-[13px] bg-white"
              >
                <option value="all">전체</option>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            )}
          </div>
          <div className="border border-rk-line-2 rounded p-2 max-h-[400px] overflow-y-auto bg-rk-soft-2">
            {availableProducts.map(p => (
              <button
                key={p.productCode}
                type="button"
                onClick={() => addToSlot(p.productCode)}
                className="w-full bg-white border border-rk-line-2 rounded mb-1 p-2 text-left hover:border-rk-orange transition-colors cursor-pointer flex items-center gap-2"
              >
                <ProductThumb url={p.imageUrl} category={p.category} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-rk-ink truncate">{p.name}</div>
                  <div className="text-[12px] text-rk-muted font-mono">{p.modelName} · {CATEGORY_LABEL[p.category] ?? p.category}</div>
                </div>
                <span className="text-rk-muted text-[12px]">+ 추가</span>
              </button>
            ))}
            {availableProducts.length === 0 && (
              <div className="text-center text-[13px] text-rk-muted py-4">
                {slotDef.type === "ranking"
                  ? `이 카테고리에 더 추가할 상품이 없습니다`
                  : "추가할 상품이 없습니다"}
              </div>
            )}
          </div>
        </div>

        {/* 우: 진열 순서 (드래그 가능) */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <h4 className="text-[14px] font-semibold text-rk-orange-deep">
              진열 순서 ({currentCodes.length}/{MAX_SIZE[activeSlot] ?? "∞"})
            </h4>
            <small className="text-[12px] text-rk-muted">위에서 아래 = 메인의 표시 순서</small>
          </div>
          <div className="border-2 border-rk-orange/30 rounded p-2 bg-rk-tint-orange/30 min-h-[200px]">
            {currentCodes.length === 0 ? (
              <div className="text-center text-[13px] text-rk-muted py-8">
                좌측 상품을 클릭하면 여기에 추가됩니다.<br />
                추가 후 드래그로 순서 변경.
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={currentCodes} strategy={verticalListSortingStrategy}>
                  {currentCodes.map((code, idx) => {
                    const p = productMap.get(code);
                    if (!p) return null;
                    return (
                      <SortableItem key={code} id={code} index={idx} product={p} onRemove={removeFromSlot} />
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      <div className="bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] mt-3 leading-[1.6]">
        💡 <b>점장 추천</b>은 메인 페이지의 "오늘의 점장 픽" 영역에 위→아래 순서로 노출됩니다.
        <b> 카테고리 랭킹</b>은 해당 카테고리 페이지(예: /products?cat=water) 상단에 노출됩니다.
        설정 안 한 영역은 사은품 차별화 기준으로 자동 산출됩니다.
      </div>
    </div>
  );
}

function SortableItem({
  id, index, product, onRemove,
}: {
  id: string; index: number; product: Product; onRemove: (code: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 1,
    touchAction: "none",
  };

  // 카드 전체가 드래그 핸들. ✕ 버튼은 pointerdown stop 으로 클릭만 동작.
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border border-rk-line rounded mb-1 p-2 flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
      title="드래그로 순서 변경"
    >
      <span className="text-rk-muted text-[14px] select-none" aria-hidden="true">⋮⋮</span>
      <span className="text-[12px] text-rk-orange-deep font-bold rk-num min-w-[18px]">{index + 1}</span>
      <ProductThumb url={product.imageUrl} category={product.category} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-rk-ink truncate">{product.name}</div>
        <div className="text-[12px] text-rk-muted font-mono">{product.modelName} · ₩{(product.rentalPrice).toLocaleString()}</div>
      </div>
      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onRemove(product.productCode)}
        className="text-rk-sale text-[13px] hover:underline cursor-pointer px-1"
      >
        ✕
      </button>
    </div>
  );
}

const CATEGORY_BG: Record<string, string> = {
  water:    "linear-gradient(160deg,#D8E2F0,#A4B4D0)",
  bidet:    "linear-gradient(160deg,#F0E5DA,#D6BFA8)",
  air:      "linear-gradient(160deg,#E5EAEF,#B8C2CD)",
  mattress: "linear-gradient(160deg,#DEE5F0,#A8B5CC)",
  massage:  "linear-gradient(160deg,#F0E8E0,#D0BFAE)",
};
function ProductThumb({ url, category }: { url: string | null; category: string }) {
  const bg = CATEGORY_BG[category] ?? CATEGORY_BG.water;
  return (
    <div
      className="w-9 h-9 rounded shrink-0 overflow-hidden bg-rk-soft-2 relative"
      style={url ? undefined : { backgroundImage: bg }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      )}
    </div>
  );
}
