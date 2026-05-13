"use client";

import { useState } from "react";
import { getUtm } from "@/components/consumer/UtmTracker";

const PRODUCTS: { label: string; code: string | null }[] = [
  { label: "정수기 PURE+",       code: "WPU-A700C" },
  { label: "에코미니 RO 정수기", code: "WPU-M200C" },
  { label: "얼음정수기 ICE COOL", code: "WPU-IAC302" },
  { label: "슬림형 정수기 II",   code: "WPU-S210C" },
  { label: "비데 BIDET PRO",     code: "BID-S17D" },
  { label: "기타 / 상담 후 결정", code: null },
];

type Submitted = { leadId: string; assignedPartnerId: string | null; message: string };

export default function ConsultForm({
  partnerCode = "gangnam-skmagic",
  partnerName,
  sellerCode,
  sellerName,
  defaultProductCode,
  defaultProductLabel,
  buttonLabel,
  buttonClassName,
}: {
  partnerCode?: string;
  partnerName?: string;
  sellerCode?: string;
  sellerName?: string;
  defaultProductCode?: string | null;
  defaultProductLabel?: string;
  buttonLabel?: string;
  buttonClassName?: string;
}) {
  const initialProduct = defaultProductLabel
    ? defaultProductLabel
    : defaultProductCode
      ? PRODUCTS.find(p => p.code === defaultProductCode)?.label ?? PRODUCTS[0].label
      : PRODUCTS[0].label;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [product, setProduct] = useState(initialProduct);
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Submitted | null>(null);

  const reset = () => {
    setName(""); setPhone(""); setProduct(initialProduct); setRegion("");
    setError(null); setDone(null); setBusy(false);
  };
  const close = () => { reset(); setOpen(false); };

  const submit = async () => {
    setError(null);
    if (!name.trim() || !phone.trim()) return setError("이름과 휴대폰을 입력해주세요.");
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11 || !digits.startsWith("010")) return setError("휴대폰은 010으로 시작하는 11자리여야 합니다.");

    setBusy(true);
    try {
      const productCode = PRODUCTS.find(p => p.label === product)?.code ?? null;
      const utm = getUtm();

      // PriceConfigurator가 sessionStorage에 저장한 선택 옵션 첨부 (해당 productCode와 일치할 때만)
      let purchaseConfig: {
        selectedMode?: "방문형" | "셀프형" | null;
        selectedContractPeriod?: number;
        selectedRentalPrice?: number;
        selectedCardDiscountPrice?: number | null;
        rivalCompensationRequested?: boolean;
        selectedColor?: string | null;
      } | null = null;
      try {
        const raw = sessionStorage.getItem("rk:purchase-config");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.productCode === productCode) {
            purchaseConfig = {
              selectedMode: parsed.selectedMode ?? null,
              selectedContractPeriod: parsed.selectedContractPeriod,
              selectedRentalPrice: parsed.selectedRentalPrice,
              selectedCardDiscountPrice: parsed.selectedCardDiscountPrice ?? null,
              rivalCompensationRequested: !!parsed.rivalCompensationRequested,
              selectedColor: typeof parsed.selectedColor === "string" ? parsed.selectedColor : null,
            };
          }
        }
      } catch { /* noop */ }

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          phone: digits,
          productInterest: product,
          productCode,
          region,
          landingType: sellerCode ? "consumer_seller" : "consumer_partner",
          partnerId: partnerCode,
          sellerCode: sellerCode ?? undefined,
          utm: utm ?? undefined,
          ...(purchaseConfig ?? {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "접수 실패");
      } else {
        setDone(data);
      }
    } catch {
      setError("네트워크 오류 — 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          buttonClassName ??
          "flex-1 bg-rk-orange hover:bg-rk-orange-deep text-white py-3 rounded-lg font-semibold text-[13px] text-center flex gap-1.5 items-center justify-center cursor-pointer border-0 transition-colors"
        }
      >
        {buttonLabel ?? "✍ 상담 신청"}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center"
          onClick={close}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white w-full md:max-w-[420px] rounded-t-2xl md:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
          >
            {!done ? (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <h3 className="text-[16px] font-bold text-rk-ink">상담 신청</h3>
                  <small className="text-[13px] text-rk-muted">{partnerName ?? partnerCode}</small>
                </div>
                {sellerName && (
                  <div className="text-[13px] text-rk-orange-deep mb-2">
                    👤 담당 영업: <b>{sellerName}</b>
                  </div>
                )}
                <p className="text-[14px] text-rk-muted m-0 mb-4">
                  접수 후 30분 이내 카톡 또는 전화로 연락드립니다.
                </p>

                <Field label="이름" required>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full px-3 py-2 border border-rk-line rounded text-[13px] outline-none focus:border-rk-navy"
                  />
                </Field>

                <Field label="휴대폰" required>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    inputMode="tel"
                    className="w-full px-3 py-2 border border-rk-line rounded text-[13px] outline-none focus:border-rk-navy rk-num"
                  />
                </Field>

                <Field label="관심 상품" required>
                  <select
                    value={product}
                    onChange={e => setProduct(e.target.value)}
                    className="w-full px-3 py-2 border border-rk-line rounded text-[13px] outline-none bg-white focus:border-rk-navy"
                  >
                    {PRODUCTS.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
                  </select>
                </Field>

                <Field label="설치 희망 지역">
                  <input
                    value={region}
                    onChange={e => setRegion(e.target.value)}
                    placeholder="예) 강남구 역삼동"
                    className="w-full px-3 py-2 border border-rk-line rounded text-[13px] outline-none focus:border-rk-navy"
                  />
                </Field>

                <div className="text-[13px] text-rk-muted leading-[1.5] mb-3">
                  ⓘ 신청 시 <a href="/legal/privacy" target="_blank" rel="noreferrer" className="text-rk-info underline">개인정보 수집·이용</a>에 동의한 것으로 간주합니다. (3년 보유 후 자동 익명화)
                </div>

                {error && (
                  <div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded mb-3">⚠ {error}</div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2.5 border border-rk-line bg-white rounded text-[13px] cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className="flex-1 bg-rk-orange hover:bg-rk-orange-deep disabled:bg-rk-muted text-white border-0 py-2.5 rounded text-[13px] font-semibold cursor-pointer transition-colors"
                  >
                    {busy ? "접수 중…" : "신청하기"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-[36px] mb-2">✅</div>
                <h3 className="text-[16px] font-bold text-rk-ink mb-1">접수 완료</h3>
                <p className="text-[14px] text-rk-text leading-[1.6] mb-3">{done.message}</p>
                <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-2.5 text-[13px] mb-4">
                  <div className="flex justify-between text-rk-muted">
                    <span>접수번호</span>
                    <span className="font-mono text-rk-ink">{done.leadId}</span>
                  </div>
                  <div className="flex justify-between text-rk-muted mt-1">
                    <span>담당</span>
                    <span className="text-rk-ink">{done.assignedPartnerId ?? "본사 풀 (배정 대기)"}</span>
                  </div>
                </div>
                <button
                  onClick={close}
                  className="w-full bg-rk-navy hover:bg-rk-navy-deep text-white border-0 py-2.5 rounded text-[13px] font-semibold cursor-pointer transition-colors"
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[13px] text-rk-muted mb-1">
        {label}
        {required && <span className="text-rk-sale ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
