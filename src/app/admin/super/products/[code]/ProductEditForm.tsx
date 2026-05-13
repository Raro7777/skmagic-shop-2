"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const CATEGORIES = [
  { v: "water",    l: "정수기" },
  { v: "bidet",    l: "비데" },
  { v: "air",      l: "공기청정기" },
  { v: "mattress", l: "매트리스" },
  { v: "massage",  l: "안마의자" },
  { v: "dryer",    l: "건조기" },
];
const MGMT_TYPES = [
  "자가관리",
  "방문관리 2개월",
  "방문관리 4개월",
  "방문관리 6개월",
];

export type ProductDraft = {
  productCode: string;
  category: string;
  name: string;
  modelName: string;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  warrantyMonths: number;
  managementType: string;
  description: string;
  imageUrls: string[];
  keyFeatures: string[];
  specs: Record<string, string>;
  isFeatured: boolean;
  status: "active" | "discontinued";
};

export default function ProductEditForm({ initial }: { initial: ProductDraft }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ProductDraft>(initial);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/products/${draft.productCode}/admin`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ tone: "err", text: data.error ?? "저장 실패" });
          return;
        }
        setMessage({ tone: "ok", text: "저장 완료 — 소비자 화면에 즉시 반영" });
        router.refresh();
      } catch {
        setMessage({ tone: "err", text: "네트워크 오류" });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3">
      {/* Main edit area */}
      <div className="flex flex-col gap-3">
        {/* Basic info */}
        <Card title="기본 정보">
          <Row>
            <Field label="상품명">
              <input className={INPUT} value={draft.name} onChange={e => set("name", e.target.value)} />
            </Field>
            <Field label="모델번호">
              <input className={INPUT + " font-mono"} value={draft.modelName} onChange={e => set("modelName", e.target.value)} />
            </Field>
          </Row>
          <Row>
            <Field label="카테고리">
              <select className={INPUT} value={draft.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </Field>
            <Field label="관리방식">
              <select className={INPUT} value={draft.managementType} onChange={e => set("managementType", e.target.value)}>
                {MGMT_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </Row>
        </Card>

        {/* Pricing */}
        <Card title="가격 · 약정 (전국 동일)">
          <Row>
            <Field label="월 렌탈가 (원)">
              <input
                type="number"
                className={INPUT + " rk-num text-right"}
                value={draft.rentalPrice}
                onChange={e => set("rentalPrice", parseInt(e.target.value, 10) || 0)}
              />
            </Field>
            <Field label="카드할인가 (원)">
              <input
                type="number"
                className={INPUT + " rk-num text-right"}
                value={draft.cardDiscountPrice ?? ""}
                onChange={e => set("cardDiscountPrice", e.target.value ? parseInt(e.target.value, 10) : null)}
                placeholder="없으면 비워두세요"
              />
            </Field>
          </Row>
          <Row>
            <Field label="의무사용 (개월)">
              <input
                type="number"
                className={INPUT + " rk-num"}
                value={draft.contractPeriod}
                onChange={e => set("contractPeriod", parseInt(e.target.value, 10) || 60)}
              />
            </Field>
            <Field label="무상 보증 (개월)">
              <input
                type="number"
                className={INPUT + " rk-num"}
                value={draft.warrantyMonths}
                onChange={e => set("warrantyMonths", parseInt(e.target.value, 10) || 60)}
              />
            </Field>
          </Row>
        </Card>

        {/* Description */}
        <Card title="상품 설명">
          <textarea
            className={INPUT + " resize-y min-h-[180px] leading-[1.7]"}
            value={draft.description}
            onChange={e => set("description", e.target.value)}
            placeholder="문단 사이는 빈 줄로 구분하세요. 소비자 페이지에서 자동으로 단락 처리됩니다."
            rows={10}
          />
          <small className="text-[13px] text-rk-muted mt-1 block">
            {draft.description.length} / 8,000자
          </small>
        </Card>

        {/* Key features */}
        <Card title="핵심 셀링포인트 (bullet)">
          <StringList
            items={draft.keyFeatures}
            onChange={v => set("keyFeatures", v)}
            placeholder="예: 저소음 23dB 정숙 운전"
            max={20}
          />
        </Card>

        {/* Specs */}
        <Card title="사양 표 (key-value)">
          <KeyValueList
            entries={draft.specs}
            onChange={v => set("specs", v)}
          />
        </Card>

        {/* Images */}
        <Card title="상품 이미지 URL">
          <StringList
            items={draft.imageUrls}
            onChange={v => set("imageUrls", v)}
            placeholder="https://example.com/product.jpg"
            max={12}
            mono
          />
          <small className="text-[13px] text-rk-muted mt-1 block">
            URL을 직접 입력합니다. 다음 단계에서 Vercel Blob 업로드 UI 추가 예정.
          </small>
        </Card>
      </div>

      {/* Sidebar */}
      <aside className="flex flex-col gap-3">
        <Card title="상태">
          <label className="flex items-center gap-2 text-[14px] mb-3">
            <input
              type="checkbox"
              checked={draft.isFeatured}
              onChange={e => set("isFeatured", e.target.checked)}
            />
            <span>대표 상품 (Featured) — 베스트 ranking 상위 노출</span>
          </label>

          <Field label="판매 상태">
            <select className={INPUT} value={draft.status} onChange={e => set("status", e.target.value as ProductDraft["status"])}>
              <option value="active">active (판매 중)</option>
              <option value="discontinued">discontinued (단종)</option>
            </select>
          </Field>
        </Card>

        <Card title="저장">
          {message && (
            <div
              className={
                "text-[13px] px-2.5 py-2 rounded mb-2 " +
                (message.tone === "ok" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")
              }
            >
              {message.tone === "ok" ? "✓ " : "⚠ "}{message.text}
            </div>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="w-full bg-rk-navy hover:bg-rk-navy-deep disabled:bg-rk-muted text-white border-0 py-2.5 rounded text-[13px] font-semibold cursor-pointer transition-colors"
          >
            {pending ? "저장 중…" : "저장 — 모든 협력점 즉시 반영"}
          </button>

          <div className="text-[13px] text-rk-muted mt-3 leading-[1.6]">
            ⚠ 가격·의무기간·관리방식 변경은 신규 가입에만 적용되며, 기존 가입자에게는 영향이 없습니다.
            상품 단종 처리 시 기존 가입자는 계약 종료까지 유지됩니다.
          </div>
        </Card>
      </aside>
    </div>
  );
}

/* ============ Sub-components ============ */
const INPUT =
  "w-full px-2.5 py-1.5 border border-rk-line rounded text-[14px] outline-none focus:border-rk-navy bg-white";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <h3 className="text-[13px] font-semibold text-rk-ink mb-2.5">{title}</h3>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <label className="block text-[12px] text-rk-muted mb-1 font-medium uppercase tracking-[.04em]">{label}</label>
      {children}
    </div>
  );
}

function StringList({
  items, onChange, placeholder, max, mono,
}: {
  items: string[]; onChange: (v: string[]) => void; placeholder: string; max: number; mono?: boolean;
}) {
  const update = (i: number, v: string) => onChange(items.map((x, idx) => idx === i ? v : x));
  const add = () => items.length < max && onChange([...items, ""]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-1.5">
      {items.length === 0 && (
        <div className="text-[13px] text-rk-muted py-2">항목이 없습니다. + 추가 버튼으로 시작하세요.</div>
      )}
      {items.map((v, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <span className="text-[12px] font-mono text-rk-faint w-5 text-right">{i + 1}.</span>
          <input
            value={v}
            onChange={e => update(i, e.target.value)}
            placeholder={placeholder}
            className={INPUT + (mono ? " font-mono text-[13px]" : "")}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-rk-faint hover:text-rk-sale border-0 bg-transparent px-1 cursor-pointer text-[14px]"
            title="삭제"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={items.length >= max}
        className="text-[13px] text-rk-info bg-transparent border border-dashed border-rk-line rounded px-2 py-1.5 cursor-pointer hover:border-rk-info self-start mt-1 disabled:opacity-50"
      >
        + 항목 추가 ({items.length}/{max})
      </button>
    </div>
  );
}

function KeyValueList({
  entries, onChange,
}: {
  entries: Record<string, string>; onChange: (v: Record<string, string>) => void;
}) {
  const list = Object.entries(entries);

  const updateKey = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
    const next: Record<string, string> = {};
    for (const [k, v] of list) next[k === oldKey ? newKey : k] = v;
    onChange(next);
  };
  const updateValue = (k: string, v: string) => onChange({ ...entries, [k]: v });
  const remove = (k: string) => {
    const next = { ...entries };
    delete next[k];
    onChange(next);
  };
  const add = () => {
    let i = 1;
    while (entries[`항목 ${i}`] != null) i++;
    onChange({ ...entries, [`항목 ${i}`]: "" });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {list.length === 0 && (
        <div className="text-[13px] text-rk-muted py-2">사양이 없습니다. + 추가 버튼으로 시작하세요.</div>
      )}
      {list.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[140px_1fr_24px] gap-1.5 items-center">
          <input
            value={k}
            onChange={e => updateKey(k, e.target.value)}
            placeholder="라벨"
            className={INPUT + " text-[13px]"}
          />
          <input
            value={v}
            onChange={e => updateValue(k, e.target.value)}
            placeholder="값"
            className={INPUT + " text-[13px]"}
          />
          <button
            type="button"
            onClick={() => remove(k)}
            className="text-rk-faint hover:text-rk-sale border-0 bg-transparent cursor-pointer text-[14px]"
            title="삭제"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-[13px] text-rk-info bg-transparent border border-dashed border-rk-line rounded px-2 py-1.5 cursor-pointer hover:border-rk-info self-start mt-1"
      >
        + 사양 추가
      </button>
    </div>
  );
}
