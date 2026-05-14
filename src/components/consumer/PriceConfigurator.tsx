"use client";

import { useEffect, useMemo, useState } from "react";
import type { PriceOption } from "@/lib/partnerSite";
import { rentalSupportFor } from "@/lib/rentalSupport";

type RivalCompensation = {
  enabled: boolean;
  monthlyDiscount: number;
  months: number;
  note: string;
};

type Props = {
  productCode: string;
  defaultRental: number;
  defaultCard: number | null;
  defaultContract: number;
  defaultManagement: string;
  priceMatrix: PriceOption[];
  rivalCompensation: RivalCompensation;
  colorOptions?: string[]; // specs["색상"] split — 가격 영향 X, 표시·선택용
  // 협력점 렌탈지원금 — 옵션별 수수료 한도 ≥ 설정값이면 노출, 부족 시 0 표기
  partnerRentalSupportAmount?: number;
  // 협력점 사이트 표시 ON/OFF 토글 (Partner.rentalSupportEnabled). false 면 박스 자체 숨김.
  partnerRentalSupportEnabled?: boolean;
  partnerGiftAmount?: number;
  partnerInstallAmount?: number;
};

// 한 페이지에서 PriceConfigurator → ConsultForm으로 옵션 전달 (sessionStorage 공유)
export const PRICE_CONFIG_STORAGE_KEY = "rk:purchase-config";
export type PurchaseConfigPayload = {
  productCode: string;
  selectedMode: "방문형" | "셀프형" | null;
  selectedContractPeriod: number;
  selectedRentalPrice: number;
  selectedCardDiscountPrice: number | null;
  rivalCompensationRequested: boolean;
  selectedColor?: string | null;
};

const fmt = (n: number) => n.toLocaleString("ko-KR");

const MODE_LABEL: Record<string, string> = {
  방문형: "방문형",
  셀프형: "셀프형",
};

export default function PriceConfigurator({
  productCode,
  defaultRental,
  defaultCard,
  defaultContract,
  defaultManagement,
  priceMatrix,
  rivalCompensation,
  colorOptions = [],
  partnerRentalSupportAmount = 0,
  partnerRentalSupportEnabled = true,
  partnerGiftAmount = 0,
  partnerInstallAmount = 0,
}: Props) {
  // 색상 chip — 가격 영향 X. 디폴트는 첫 번째 색상 (있으면).
  const [selectedColor, setSelectedColor] = useState<string | null>(() => colorOptions[0] ?? null);
  // 매트릭스가 비어있으면 단일 옵션만 표시 (기본값)
  const hasMatrix = priceMatrix.length > 0;

  // 사용 가능한 모드 목록
  const modes = useMemo(() => {
    if (!hasMatrix) return [] as Array<"방문형" | "셀프형" | "단일">;
    const set = new Set<string>();
    for (const o of priceMatrix) set.add(o.mode ?? "단일");
    return [...set] as Array<"방문형" | "셀프형" | "단일">;
  }, [priceMatrix, hasMatrix]);

  // 기본 mode = 첫 번째
  const [selectedMode, setSelectedMode] = useState<"방문형" | "셀프형" | "단일" | null>(
    () => modes[0] ?? null,
  );

  // 선택된 mode의 옵션들
  const modeOptions = useMemo(() => {
    if (!hasMatrix) return [];
    return priceMatrix.filter(o => (o.mode ?? "단일") === selectedMode);
  }, [priceMatrix, selectedMode, hasMatrix]);

  // 기본 contractPeriod = 60 (있으면) 또는 첫 옵션
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(() => {
    if (!hasMatrix) return null;
    const sixty = priceMatrix.find(o => o.contractPeriod === 60);
    return sixty?.contractPeriod ?? priceMatrix[0]?.contractPeriod ?? null;
  });

  // mode 변경 시 해당 mode 안에서 가까운 contractPeriod로 자동 매칭
  const onModeChange = (m: "방문형" | "셀프형" | "단일") => {
    setSelectedMode(m);
    const optsForMode = priceMatrix.filter(o => (o.mode ?? "단일") === m);
    if (optsForMode.length === 0) return;
    if (selectedPeriod && optsForMode.find(o => o.contractPeriod === selectedPeriod)) return;
    const sixty = optsForMode.find(o => o.contractPeriod === 60);
    setSelectedPeriod(sixty?.contractPeriod ?? optsForMode[0].contractPeriod);
  };

  // 현재 선택된 옵션
  const currentOption = useMemo(() => {
    if (!hasMatrix) return null;
    return modeOptions.find(o => o.contractPeriod === selectedPeriod) ?? modeOptions[0] ?? null;
  }, [modeOptions, selectedPeriod, hasMatrix]);

  // 표시 가격
  const baseRental = currentOption?.rentalPrice ?? defaultRental;
  const baseCard = currentOption?.cardDiscountPrice ?? defaultCard;
  const contractPeriod = currentOption?.contractPeriod ?? defaultContract;
  const ownership = currentOption?.ownershipPeriod ?? null;
  const visitInterval = currentOption?.visitInterval ?? "";

  // 타사보상 적용 — 신정책 우선 (옵션별 rivalCompensationPrice), 없으면 기존 일률 placeholder
  const [rivalApplied, setRivalApplied] = useState(false);
  const newPolicyRival = currentOption?.rivalCompensationPrice ?? null;
  const newPolicyHalfMonths = currentOption?.rivalCompensationHalfPriceMonths ?? null;
  const useNewPolicy = newPolicyRival != null;

  // 신정책: 렌탈가 자체가 rivalCompensationPrice 로 대체. 카드할인 효과(=baseRental-baseCard)는
  //         타사보상 적용 후에도 동일하게 유지되어 카드할인가도 함께 내려감.
  // 구정책 fallback: 월 −N원 일률 차감.
  const rental = rivalApplied && useNewPolicy ? newPolicyRival! : baseRental;
  const rivalLegacyDiscount = rivalApplied && !useNewPolicy && rivalCompensation.enabled
    ? rivalCompensation.monthlyDiscount
    : 0;
  const finalRental = Math.max(0, rental - rivalLegacyDiscount);
  // 카드할인 효과 (예: baseRental 57,900 − baseCard 50,400 = 7,500) 를 finalRental 에서도 동일하게 차감
  const cardDiscountEffect = baseCard != null && baseCard < baseRental ? baseRental - baseCard : 0;
  const finalCard = baseCard != null
    ? Math.max(0, finalRental - cardDiscountEffect)
    : null;
  const savings = finalCard != null ? finalRental - finalCard : null;
  // 신정책 절약 표시용 — 기본가 대비 차감액
  const rivalNewSavings = rivalApplied && useNewPolicy ? Math.max(0, baseRental - newPolicyRival!) : 0;

  // 선택 변경 시 sessionStorage에 페이로드 저장 — ConsultForm이 submit 시 읽어 함께 전송
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: PurchaseConfigPayload = {
      productCode,
      selectedMode: (currentOption?.mode as "방문형" | "셀프형" | null) ?? null,
      selectedContractPeriod: contractPeriod,
      selectedRentalPrice: rental,           // 타사보상 적용 전 운영가
      selectedCardDiscountPrice: baseCard,
      rivalCompensationRequested: rivalApplied,
      selectedColor,
    };
    try {
      sessionStorage.setItem(PRICE_CONFIG_STORAGE_KEY, JSON.stringify(payload));
    } catch { /* noop */ }
  }, [productCode, currentOption, contractPeriod, rental, baseCard, rivalApplied, selectedColor]);

  // 관리방식 표시 (선택 옵션 기반 또는 default)
  const mgmtLabel = currentOption
    ? (currentOption.mode === "방문형"
        ? `방문관리 ${currentOption.visitInterval || ""}`.trim()
        : currentOption.mode === "셀프형"
          ? "자가관리"
          : defaultManagement)
    : defaultManagement;

  return (
    <section className="bg-white px-4 py-3 border-b-8 border-rk-soft">
      {/* Mode selector — 멀티 모드일 때만 노출 */}
      {hasMatrix && modes.length > 1 && (
        <div className="mb-2.5">
          <div className="text-[13px] text-rk-muted mb-1">운영 방식</div>
          <div className="flex gap-1.5">
            {modes.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={
                  "flex-1 px-2.5 py-1.5 rounded text-[14px] font-medium border transition-colors " +
                  (selectedMode === m
                    ? "bg-rk-navy text-white border-rk-navy"
                    : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft-2")
                }
              >
                {MODE_LABEL[m] ?? m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Period selector */}
      {hasMatrix && modeOptions.length > 1 && (
        <div className="mb-2.5">
          <div className="text-[13px] text-rk-muted mb-1">의무사용기간</div>
          <div className="flex gap-1.5 flex-wrap">
            {modeOptions.map(o => (
              <button
                key={o.contractPeriod}
                type="button"
                onClick={() => setSelectedPeriod(o.contractPeriod)}
                className={
                  "px-2.5 py-1 rounded text-[13px] font-medium border transition-colors " +
                  (o.contractPeriod === selectedPeriod
                    ? "bg-rk-navy text-white border-rk-navy"
                    : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft-2")
                }
              >
                {o.contractPeriod}개월
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color selector — 정책표의 컬러/사이즈 변형. 가격에는 영향 없음 */}
      {colorOptions.length > 0 && (
        <div className="mb-2.5">
          <div className="text-[13px] text-rk-muted mb-1">색상 / 변형</div>
          {colorOptions.length === 1 ? (
            <div className="text-[14px] text-rk-ink font-medium">{colorOptions[0]}</div>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {colorOptions.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={
                    "px-2.5 py-1 rounded text-[13px] font-medium border transition-colors " +
                    (c === selectedColor
                      ? "bg-rk-navy text-white border-rk-navy"
                      : "bg-white text-rk-muted border-rk-line hover:bg-rk-soft-2")
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Price block */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[14px] text-rk-muted">월 렌탈가</span>
        <div>
          <span className="text-[24px] font-bold tracking-[-.02em] text-rk-ink rk-num">{fmt(finalRental)}</span>
          <small className="text-[14px] font-medium text-rk-muted">원</small>
        </div>
      </div>
      {finalCard != null && (
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[14px] text-rk-sale font-medium">신용카드 할인가</span>
          <div>
            <span className="text-[20px] font-bold tracking-[-.02em] text-rk-sale rk-num">{fmt(finalCard)}</span>
            <small className="text-[13px] font-medium text-rk-sale">원/월</small>
            {savings != null && savings > 0 && (
              <small className="block text-[12px] text-rk-muted text-right">−{fmt(savings)}원/월 절약</small>
            )}
          </div>
        </div>
      )}

      {/* 협력점 렌탈지원금 — 옵션의 baseCommission 한도 ≥ 협력점 설정값이면 노출, 부족 시 0 */}
      {partnerRentalSupportEnabled && partnerRentalSupportAmount > 0 && (
        <div className="mt-2 flex items-start justify-between gap-2 px-2.5 py-2 rounded border border-[#F4DCC9] bg-rk-tint-orange">
          <div className="flex-1 text-[14px] leading-[1.4]">
            <b className="text-rk-orange-deep">🎁 협력점 렌탈지원금</b>
            <small className="block text-rk-orange-deep text-[12px] mt-0.5">
              개통 후 1회 현금 캐시백 지급
            </small>
            <small className="block text-rk-muted text-[10px] mt-0.5">
              ⓘ 가입 취소 시 전액 환수
            </small>
          </div>
          <div className="text-right">
            {(() => {
              const support = rentalSupportFor(
                currentOption?.baseCommission,
                partnerRentalSupportAmount,
                partnerGiftAmount,
                partnerInstallAmount,
              );
              return (
                <>
                  <span className="text-[18px] font-bold tracking-[-.02em] text-rk-orange-deep rk-num">
                    {support === 0 ? "0" : `+${fmt(support)}`}
                  </span>
                  <small className="text-[13px] font-medium text-rk-orange-deep">원</small>
                  <small className="block text-[12px] text-rk-success font-medium">현금으로 지급</small>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Rival compensation toggle */}
      {(useNewPolicy || rivalCompensation.enabled) && (
        <label className={
          "mt-2 flex items-start gap-2 px-2.5 py-2 rounded border cursor-pointer transition-colors " +
          (rivalApplied
            ? "bg-rk-tint-orange border-rk-orange"
            : "bg-rk-soft-2 border-rk-line-2 hover:border-rk-orange")
        }>
          <input
            type="checkbox"
            checked={rivalApplied}
            onChange={e => setRivalApplied(e.target.checked)}
            className="mt-0.5 w-4 h-4 cursor-pointer accent-rk-orange"
          />
          <div className="flex-1 text-[14px] leading-[1.4]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <b className={rivalApplied ? "text-rk-orange-deep" : "text-rk-ink"}>🔄 타사보상</b>
              {useNewPolicy ? (
                <span className={"text-[13px] " + (rivalApplied ? "text-rk-orange-deep" : "text-rk-muted")}>
                  월 {fmt(newPolicyRival!)}원으로 적용
                  {newPolicyHalfMonths ? ` · 첫 ${newPolicyHalfMonths}개월 반값` : ""}
                </span>
              ) : (
                <span className={"text-[13px] " + (rivalApplied ? "text-rk-orange-deep" : "text-rk-muted")}>
                  월 −{fmt(rivalCompensation.monthlyDiscount)}원 × {rivalCompensation.months}개월
                </span>
              )}
            </div>
            <small className="block text-rk-muted mt-0.5 text-[13px]">
              {useNewPolicy
                ? "타사 제품 렌탈료 납부 영수증 증빙 필요 (신규·단품 한정). 카드할인은 별개로 추가 적용."
                : rivalCompensation.note}
            </small>
            {rivalApplied && useNewPolicy && (
              <div className="mt-1 text-[13px] text-rk-orange-deep">
                ✓ 월 절약 <b>{fmt(rivalNewSavings)}원</b>
                {newPolicyHalfMonths ? ` (첫 ${newPolicyHalfMonths}개월은 반값 추가 적용)` : ""}
              </div>
            )}
            {rivalApplied && !useNewPolicy && (
              <div className="mt-1 text-[13px] text-rk-orange-deep">
                ✓ 첫 {rivalCompensation.months}개월 총 절약 <b>{fmt(rivalCompensation.monthlyDiscount * rivalCompensation.months)}원</b>
              </div>
            )}
          </div>
        </label>
      )}

      {/* 가입 시뮬레이터 박스는 컨슈머 노출 회피로 비활성화됨 — SignupSimulator 함수 본체는 보존 */}

      {/* Spec hint */}
      <div className="mt-2 flex items-center justify-between text-[12px] text-rk-muted">
        <div>
          {ownership && ownership !== contractPeriod && (
            <span>총 사용 {ownership}개월 (의무 {contractPeriod})</span>
          )}
          {visitInterval && (
            <span> · {mgmtLabel}</span>
          )}
        </div>
        <span>전국 동일가 · 36개월 무이자 가능</span>
      </div>
    </section>
  );
}

function SignupSimulator({
  contractPeriod,
  operationalRental,
  rentalNow,
  baseCard,
  rivalLegacyDiscount,
  rivalLegacyMonths,
  rivalHalfMonths,
}: {
  contractPeriod: number;
  /** 운영가 (기본 렌탈료) */
  operationalRental: number;
  /** 타사보상 적용 후 렌탈료 (신정책) — 미적용이면 operationalRental 과 동일 */
  rentalNow: number;
  baseCard: number | null;
  /** 구 정책: 월 일률 차감 */
  rivalLegacyDiscount: number;
  rivalLegacyMonths: number;
  /** 신정책: rentalNow 기준 첫 N개월 반값 */
  rivalHalfMonths: number;
}) {
  // 운영가 총합 (기준)
  const totalOperational = operationalRental * contractPeriod;

  // 신정책 / 구정책 분기
  const usingNew = rentalNow !== operationalRental || rivalHalfMonths > 0;

  // 타사보상 적용 시 실제 렌탈료 흐름
  // 신정책: 첫 rivalHalfMonths 개월 = rentalNow × 0.5, 그 후 contractPeriod-rivalHalfMonths 개월 = rentalNow
  // 구정책: rivalLegacyDiscount × rivalLegacyMonths 만큼만 별도 차감
  const totalAfterRival = usingNew
    ? rentalNow * 0.5 * rivalHalfMonths + rentalNow * (contractPeriod - rivalHalfMonths)
    : operationalRental * contractPeriod - rivalLegacyDiscount * rivalLegacyMonths;

  // 카드할인 별개 — 운영가 대비 카드 절약은 정보 표시용
  const cardSavingsMonthly = baseCard != null ? operationalRental - baseCard : 0;
  const totalCardSavings = cardSavingsMonthly * contractPeriod;

  const totalFinal = Math.max(0, totalAfterRival - totalCardSavings);
  const totalSavings = totalOperational - totalFinal;

  return (
    <div className="mt-3 bg-rk-tint-blue border border-[#D8E4F4] rounded-md p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[14px]">💰</span>
        <b className="text-[14px] text-rk-info">가입 시뮬레이션 — {contractPeriod}개월 기준</b>
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-[13px]">
        <dt className="text-rk-muted">운영가 총 지출</dt>
        <dd className="rk-num text-rk-text">{fmt(totalOperational)}원</dd>
        {usingNew && rentalNow !== operationalRental && (
          <>
            <dt className="text-rk-muted">타사보상 가격 적용</dt>
            <dd className="rk-num text-rk-orange-deep font-medium">−{fmt((operationalRental - rentalNow) * contractPeriod)}원 절약</dd>
          </>
        )}
        {usingNew && rivalHalfMonths > 0 && (
          <>
            <dt className="text-rk-muted">첫 {rivalHalfMonths}개월 반값</dt>
            <dd className="rk-num text-rk-orange-deep font-medium">−{fmt(rentalNow * 0.5 * rivalHalfMonths)}원 절약</dd>
          </>
        )}
        {!usingNew && rivalLegacyDiscount * rivalLegacyMonths > 0 && (
          <>
            <dt className="text-rk-muted">타사보상 ({rivalLegacyMonths}개월)</dt>
            <dd className="rk-num text-rk-orange-deep font-medium">−{fmt(rivalLegacyDiscount * rivalLegacyMonths)}원 절약</dd>
          </>
        )}
        {baseCard != null && totalCardSavings > 0 && (
          <>
            <dt className="text-rk-muted">카드할인 별개 적용</dt>
            <dd className="rk-num text-rk-sale font-medium">−{fmt(totalCardSavings)}원 절약</dd>
          </>
        )}
      </dl>
      <div className="mt-2 pt-2 border-t border-[#D8E4F4] flex items-baseline justify-between">
        <span className="text-[13px] text-rk-info font-medium">실제 지불 합계</span>
        <div className="text-right">
          <b className="text-[18px] tracking-[-.02em] text-rk-info rk-num">{fmt(Math.round(totalFinal))}<small className="text-[13px] font-medium">원</small></b>
          {totalSavings > 0 && (
            <div className="text-[12px] text-rk-sale font-medium">총 −{fmt(Math.round(totalSavings))}원 절약</div>
          )}
        </div>
      </div>
    </div>
  );
}
