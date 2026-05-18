"use client";

import { useState } from "react";
import { getUtm } from "@/components/consumer/UtmTracker";

/**
 * 상담 신청 모달.
 *
 *   - 상품 페이지에서 호출 시: defaultProductCode + defaultProductLabel 받아서
 *     그 상품으로 lock. PriceConfigurator 가 sessionStorage 에 저장한
 *     선택 옵션(mode/contractPeriod/색상 등)을 함께 lead 에 전송.
 *   - 히어로/메인 등 일반 진입 시: defaultProductCode 없음 → 사용자가 "관심 상품" 텍스트 입력.
 *     productCode = null 로 lead 저장.
 */

type Submitted = { leadId: string; assignedPartnerId: string | null; message: string };

export default function ConsultForm({
  partnerCode,
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
  const isLocked = !!defaultProductCode && !!defaultProductLabel;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // 상품 페이지에서 진입한 경우 defaultProductLabel 그대로, 일반 진입은 빈 텍스트 (사용자 자유 입력)
  const [productLabel, setProductLabel] = useState(defaultProductLabel ?? "");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Submitted | null>(null);

  const reset = () => {
    setName(""); setPhone("");
    setProductLabel(defaultProductLabel ?? "");
    setRegion("");
    setError(null); setDone(null); setBusy(false);
  };
  const close = () => { reset(); setOpen(false); };

  const submit = async () => {
    setError(null);
    if (!name.trim() || !phone.trim()) return setError("이름과 휴대폰을 입력해주세요.");
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11 || !digits.startsWith("010")) return setError("휴대폰은 010으로 시작하는 11자리여야 합니다.");
    if (!isLocked && !productLabel.trim()) return setError("관심 상품을 입력해주세요.");

    setBusy(true);
    try {
      // 상품 페이지에서 진입한 경우 defaultProductCode 그대로. 일반 진입은 null.
      const productCode = isLocked ? defaultProductCode! : null;
      const productInterest = isLocked ? defaultProductLabel! : productLabel.trim();
      const utm = getUtm();

      // PriceConfigurator 가 sessionStorage 에 저장한 선택 옵션 첨부 (productCode 일치 시만)
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
        if (raw && productCode) {
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
          productInterest,
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
                  {isLocked ? (
                    <div className="w-full px-3 py-2 border border-rk-line rounded text-[13px] bg-rk-soft-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <b className="text-rk-ink block truncate">{defaultProductLabel}</b>
                        {defaultProductCode && (
                          <small className="text-rk-faint font-mono text-[11px]">{defaultProductCode}</small>
                        )}
                      </div>
                      <span className="text-[11px] text-rk-success font-medium whitespace-nowrap">✓ 이 상품 상담</span>
                    </div>
                  ) : (
                    <input
                      value={productLabel}
                      onChange={e => setProductLabel(e.target.value)}
                      placeholder="예: 정수기 PURE+, 16평 공기청정기, 비데 등"
                      className="w-full px-3 py-2 border border-rk-line rounded text-[13px] outline-none focus:border-rk-navy"
                    />
                  )}
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
                    <span className="text-rk-ink">
                      {sellerName
                        ? `${sellerName} (${partnerName ?? "협력점"})`
                        : done.assignedPartnerId
                          ? (partnerName ?? "협력점 배정 완료")
                          : "본사 풀 (배정 대기)"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-full bg-rk-navy hover:bg-rk-navy-deep text-white border-0 py-2.5 rounded text-[13px] font-semibold cursor-pointer transition-colors"
                >
                  확인
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
    <label className="block mb-3">
      <span className="block text-[12px] text-rk-muted mb-1">
        {label}
        {required && <span className="text-rk-sale ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
