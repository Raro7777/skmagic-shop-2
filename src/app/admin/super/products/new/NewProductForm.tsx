"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { v: "water",    l: "정수기" },
  { v: "bidet",    l: "비데" },
  { v: "air",      l: "공기청정기" },
  { v: "mattress", l: "매트리스" },
  { v: "massage",  l: "안마의자" },
  { v: "dryer",    l: "건조기" },
];
const MGMT_TYPES = ["자가관리", "방문관리 2개월", "방문관리 4개월", "방문관리 6개월"];

export default function NewProductForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [productCode, setProductCode] = useState("");
  const [name, setName] = useState("");
  const [modelName, setModelName] = useState("");
  const [category, setCategory] = useState("water");
  const [rentalPrice, setRentalPrice] = useState(29900);
  const [cardDiscountPrice, setCardDiscountPrice] = useState<number | "">("");
  const [contractPeriod, setContractPeriod] = useState(60);
  const [warrantyMonths, setWarrantyMonths] = useState(60);
  const [managementType, setManagementType] = useState(MGMT_TYPES[0]);
  const [description, setDescription] = useState("");
  const [keyFeaturesText, setKeyFeaturesText] = useState("");
  const [specsText, setSpecsText] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [baseCommission, setBaseCommission] = useState(30000);
  const [monthIncentive, setMonthIncentive] = useState(0);
  const [installSubsidy, setInstallSubsidy] = useState(30000);
  const [isFeatured, setIsFeatured] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const features = keyFeaturesText.split("\n").map(s => s.trim()).filter(Boolean);
    const specs: Record<string, string> = {};
    for (const line of specsText.split("\n")) {
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (m) specs[m[1].trim()] = m[2].trim();
    }
    const images = imageUrls.split("\n").map(s => s.trim()).filter(Boolean);

    startTransition(async () => {
      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productCode,
            name,
            modelName,
            category,
            rentalPrice,
            cardDiscountPrice: cardDiscountPrice === "" ? null : cardDiscountPrice,
            contractPeriod,
            warrantyMonths,
            managementType,
            description: description.trim() || undefined,
            imageUrls: images,
            keyFeatures: features,
            specs,
            isFeatured,
            baseCommission,
            monthIncentive,
            installSubsidy,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "등록 실패");
          return;
        }
        router.push(`/admin/super/products/${data.product.productCode}`);
        router.refresh();
      } catch {
        setError("네트워크 오류");
      }
    });
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-3">
      <div className="flex flex-col gap-3">
        <Card title="기본 정보">
          <Row>
            <Field label="productCode (영문 대문자/숫자/하이픈)" required>
              <input value={productCode} onChange={e => setProductCode(e.target.value)} className={INPUT + " font-mono"} placeholder="WPU-NEW1" required />
            </Field>
            <Field label="모델번호" required>
              <input value={modelName} onChange={e => setModelName(e.target.value)} className={INPUT + " font-mono"} placeholder="WPU-NEW1" required />
            </Field>
          </Row>
          <Field label="상품명" required>
            <input value={name} onChange={e => setName(e.target.value)} className={INPUT} placeholder="예: 신형 정수기 NEXT" required />
          </Field>
          <Row>
            <Field label="카테고리" required>
              <select value={category} onChange={e => setCategory(e.target.value)} className={INPUT}>
                {CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </Field>
            <Field label="관리방식" required>
              <select value={managementType} onChange={e => setManagementType(e.target.value)} className={INPUT}>
                {MGMT_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
          </Row>
        </Card>

        <Card title="가격 · 약정">
          <Row>
            <Field label="월 렌탈가 (원)" required>
              <input type="number" value={rentalPrice} onChange={e => setRentalPrice(parseInt(e.target.value, 10) || 0)} className={INPUT + " rk-num text-right"} required />
            </Field>
            <Field label="카드할인가 (원, 선택)">
              <input type="number" value={cardDiscountPrice} onChange={e => setCardDiscountPrice(e.target.value === "" ? "" : parseInt(e.target.value, 10) || 0)} className={INPUT + " rk-num text-right"} placeholder="없으면 비워두세요" />
            </Field>
          </Row>
          <Row>
            <Field label="의무사용 (개월)">
              <input type="number" value={contractPeriod} onChange={e => setContractPeriod(parseInt(e.target.value, 10) || 60)} className={INPUT + " rk-num"} />
            </Field>
            <Field label="무상 보증 (개월)">
              <input type="number" value={warrantyMonths} onChange={e => setWarrantyMonths(parseInt(e.target.value, 10) || 60)} className={INPUT + " rk-num"} />
            </Field>
          </Row>
        </Card>

        <Card title="콘텐츠 (선택)">
          <Field label="상품 설명 (문단 사이는 빈 줄)">
            <textarea value={description} onChange={e => setDescription(e.target.value)} className={INPUT + " min-h-[120px] resize-y"} rows={6} placeholder="신형 정수기 NEXT는 ..." />
          </Field>
          <Field label="셀링포인트 (한 줄당 하나)">
            <textarea value={keyFeaturesText} onChange={e => setKeyFeaturesText(e.target.value)} className={INPUT + " min-h-[80px] resize-y"} rows={4} placeholder={"저소음 23dB\n3중 필터 시스템\n에너지 1등급"} />
          </Field>
          <Field label="사양 표 (한 줄당 '라벨: 값' 형식)">
            <textarea value={specsText} onChange={e => setSpecsText(e.target.value)} className={INPUT + " min-h-[80px] resize-y"} rows={4} placeholder={"용량: 3L\n소비전력: 120W\n무게: 8kg"} />
          </Field>
          <Field label="이미지 URL (한 줄당 하나, 외부 호스팅)">
            <textarea value={imageUrls} onChange={e => setImageUrls(e.target.value)} className={INPUT + " font-mono text-[13px] min-h-[60px] resize-y"} rows={3} placeholder="https://example.com/main.jpg" />
            <small className="text-[12px] text-rk-muted block mt-1">
              ⓘ Vercel Blob 직접 업로드는 다음 단계에서. 지금은 외부 URL을 직접 입력하세요.
            </small>
          </Field>
        </Card>
      </div>

      <aside className="flex flex-col gap-3">
        <Card title="본사 정책 (HqPolicy 자동 생성)">
          <Field label="본사 기본 수수료 (원/대)">
            <input type="number" value={baseCommission} onChange={e => setBaseCommission(parseInt(e.target.value, 10) || 0)} className={INPUT + " rk-num text-right"} />
          </Field>
          <Field label="이번 달 인센티브 (원/대)">
            <input type="number" value={monthIncentive} onChange={e => setMonthIncentive(parseInt(e.target.value, 10) || 0)} className={INPUT + " rk-num text-right"} />
          </Field>
          <Field label="설치비 보조 (원/대)">
            <input type="number" value={installSubsidy} onChange={e => setInstallSubsidy(parseInt(e.target.value, 10) || 0)} className={INPUT + " rk-num text-right"} />
          </Field>
        </Card>

        <Card title="기타">
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)} />
            <span>대표 상품 (Featured)</span>
          </label>
        </Card>

        <Card title="등록">
          {error && <div className="bg-rk-tint-red text-rk-sale text-[13px] px-2.5 py-2 rounded mb-2">⚠ {error}</div>}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-rk-orange hover:bg-rk-orange-deep disabled:bg-rk-muted text-white border-0 py-2.5 rounded text-[13px] font-semibold cursor-pointer transition-colors"
          >
            {pending ? "등록 중…" : "신규 상품 등록"}
          </button>
          <small className="text-[13px] text-rk-muted block mt-2 leading-[1.6]">
            등록 후 상품은 즉시 모든 협력점 사이트에 노출됩니다.
            협력점은 자율적으로 사은품 정책을 추가할 수 있습니다.
          </small>
        </Card>
      </aside>
    </form>
  );
}

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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <label className="block text-[12px] text-rk-muted mb-1 font-medium uppercase tracking-[.04em]">
        {label}
        {required && <span className="text-rk-sale ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
