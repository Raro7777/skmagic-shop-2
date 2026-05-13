"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PriceOption } from "@/lib/partnerSite";
import { PRICE_CONFIG_STORAGE_KEY, type PurchaseConfigPayload } from "@/components/consumer/PriceConfigurator";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const MODE_LABEL: Record<string, string> = { 방문형: "방문형", 셀프형: "셀프형" };

/**
 * 상품 상세 우측 sticky 패널 — PC 버전.
 *  - 가격 큰 글씨
 *  - 운영방식 / 의무기간 chip
 *  - 타사보상 토글
 *  - 가입 시뮬레이션 컴팩트 박스
 *  - 큰 상담 CTA 버튼
 */
export default function PriceConfiguratorPC({
  productCode,
  productName,
  defaultRental,
  defaultCard,
  defaultContract,
  defaultManagement,
  priceMatrix,
  giftLabel,
  giftAmount,
  hotline,
  kakaoChannelUrl,
}: {
  productCode: string;
  productName: string;
  defaultRental: number;
  defaultCard: number | null;
  defaultContract: number;
  defaultManagement: string;
  priceMatrix: PriceOption[];
  giftLabel: string | null;
  giftAmount: number;
  hotline: string;
  kakaoChannelUrl: string | null;
}) {
  const hasMatrix = priceMatrix.length > 0;

  const modes = useMemo(() => {
    if (!hasMatrix) return [] as Array<"방문형" | "셀프형" | "단일">;
    const set = new Set<string>();
    for (const o of priceMatrix) set.add(o.mode ?? "단일");
    return [...set] as Array<"방문형" | "셀프형" | "단일">;
  }, [priceMatrix, hasMatrix]);

  const [selectedMode, setSelectedMode] = useState<"방문형" | "셀프형" | "단일" | null>(() => modes[0] ?? null);
  const modeOptions = useMemo(() => hasMatrix ? priceMatrix.filter(o => (o.mode ?? "단일") === selectedMode) : [], [priceMatrix, selectedMode, hasMatrix]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(() => {
    if (!hasMatrix) return null;
    const sixty = priceMatrix.find(o => o.contractPeriod === 60);
    return sixty?.contractPeriod ?? priceMatrix[0]?.contractPeriod ?? null;
  });
  const onModeChange = (m: "방문형" | "셀프형" | "단일") => {
    setSelectedMode(m);
    const opts = priceMatrix.filter(o => (o.mode ?? "단일") === m);
    if (opts.length === 0) return;
    if (selectedPeriod && opts.find(o => o.contractPeriod === selectedPeriod)) return;
    const sixty = opts.find(o => o.contractPeriod === 60);
    setSelectedPeriod(sixty?.contractPeriod ?? opts[0].contractPeriod);
  };

  const currentOption = useMemo(() => {
    if (!hasMatrix) return null;
    return modeOptions.find(o => o.contractPeriod === selectedPeriod) ?? modeOptions[0] ?? null;
  }, [modeOptions, selectedPeriod, hasMatrix]);

  const baseRental = currentOption?.rentalPrice ?? defaultRental;
  const baseCard = currentOption?.cardDiscountPrice ?? defaultCard;
  const contractPeriod = currentOption?.contractPeriod ?? defaultContract;

  // 타사보상
  const [rivalApplied, setRivalApplied] = useState(false);
  const rivalPrice = currentOption?.rivalCompensationPrice ?? null;
  const rivalHalfMonths = currentOption?.rivalCompensationHalfPriceMonths ?? null;
  const useRivalNew = rivalPrice != null;
  const rental = rivalApplied && useRivalNew ? rivalPrice! : baseRental;
  const card = baseCard; // 카드할인은 별개로 적용

  // 시뮬레이션
  const totalOperational = baseRental * contractPeriod;
  const halfDiscount = rivalApplied && useRivalNew && rivalHalfMonths
    ? (rivalPrice! * 0.5) * rivalHalfMonths
    : 0;
  const totalAfterRival = rivalApplied && useRivalNew
    ? rental * contractPeriod - halfDiscount
    : totalOperational;
  const cardSavings = card != null ? (baseRental - card) * contractPeriod : 0;
  const totalFinal = Math.max(0, totalAfterRival - cardSavings);
  const totalSavings = totalOperational - totalFinal;

  // sessionStorage 동기화 — ConsultForm 호환
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: PurchaseConfigPayload = {
      productCode,
      selectedMode: (currentOption?.mode as "방문형" | "셀프형" | null) ?? null,
      selectedContractPeriod: contractPeriod,
      selectedRentalPrice: baseRental,
      selectedCardDiscountPrice: card,
      rivalCompensationRequested: rivalApplied,
    };
    try { sessionStorage.setItem(PRICE_CONFIG_STORAGE_KEY, JSON.stringify(payload)); } catch { /* noop */ }
  }, [productCode, currentOption, contractPeriod, baseRental, card, rivalApplied]);

  return (
    <aside className="bg-white border border-rk-line rounded-xl p-5 sticky top-20 self-start">
      {/* 상품명 */}
      <small className="block text-[10px] uppercase tracking-[.06em] text-rk-muted font-medium">SK매직 인증판매점</small>
      <h2 className="text-[18px] font-bold text-rk-ink leading-[1.3] tracking-[-.02em] mt-1 m-0">{productName}</h2>
      <div className="mt-1 text-[10px] text-rk-faint font-mono">{productCode}</div>

      {/* 가격 strip */}
      <div className="mt-4 pt-4 border-t border-rk-line-2">
        <small className="block text-[11px] text-rk-muted mb-0.5">월 렌탈료</small>
        <div className="flex items-baseline gap-2">
          <b className="text-[32px] font-bold tracking-[-.025em] text-rk-ink rk-num">₩{fmt(rental)}</b>
          <small className="text-[12px] text-rk-muted">/월</small>
        </div>
        {card != null && (
          <div className="mt-1.5 flex items-baseline gap-2 bg-rk-tint-red rounded px-2.5 py-1.5">
            <small className="text-[10px] text-rk-sale font-semibold">신용카드 할인가</small>
            <b className="text-[18px] tracking-[-.02em] text-rk-sale rk-num ml-auto">₩{fmt(card)}</b>
            <small className="text-[10px] text-rk-sale">/월</small>
          </div>
        )}
      </div>

      {/* 운영방식 */}
      {hasMatrix && modes.length > 1 && (
        <div className="mt-3">
          <small className="block text-[10px] uppercase tracking-[.04em] text-rk-muted mb-1.5">운영 방식</small>
          <div className="flex gap-1.5">
            {modes.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={
                  "flex-1 px-3 py-2 rounded text-[13px] font-medium border transition-colors " +
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

      {/* 의무기간 */}
      {hasMatrix && modeOptions.length > 1 && (
        <div className="mt-3">
          <small className="block text-[10px] uppercase tracking-[.04em] text-rk-muted mb-1.5">의무사용기간</small>
          <div className="flex gap-1 flex-wrap">
            {modeOptions.map(o => (
              <button
                key={o.contractPeriod}
                type="button"
                onClick={() => setSelectedPeriod(o.contractPeriod)}
                className={
                  "px-2.5 py-1.5 rounded text-[12px] font-medium border transition-colors " +
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

      {/* 타사보상 */}
      {useRivalNew && (
        <label className={
          "mt-3 flex items-start gap-2 px-3 py-2.5 rounded-md border cursor-pointer transition-colors " +
          (rivalApplied ? "bg-rk-tint-orange border-rk-orange" : "bg-white border-rk-line hover:border-rk-orange")
        }>
          <input
            type="checkbox"
            checked={rivalApplied}
            onChange={e => setRivalApplied(e.target.checked)}
            className="mt-0.5 w-4 h-4 cursor-pointer accent-rk-orange"
          />
          <div className="flex-1 text-[12px] leading-[1.5]">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <b className={rivalApplied ? "text-rk-orange-deep" : "text-rk-ink"}>🔄 타사보상</b>
              <small className={rivalApplied ? "text-rk-orange-deep" : "text-rk-muted"}>
                월 ₩{fmt(rivalPrice!)} {rivalHalfMonths ? `· 첫 ${rivalHalfMonths}개월 반값` : ""}
              </small>
            </div>
            <small className="block text-rk-muted mt-0.5 text-[10px]">
              타사 제품 렌탈료 영수증 증빙 시. 카드할인은 별개로 추가.
            </small>
          </div>
        </label>
      )}

      {/* 시뮬레이션 (컴팩트) */}
      <div className="mt-3 bg-rk-tint-blue border border-[#D8E4F4] rounded-md p-3 text-[11px]">
        <b className="block text-rk-info mb-1.5">💰 {contractPeriod}개월 총 시뮬</b>
        <div className="flex justify-between mb-0.5">
          <span className="text-rk-muted">운영가</span>
          <span className="rk-num">₩{fmt(totalOperational)}</span>
        </div>
        {rivalApplied && useRivalNew && (
          <div className="flex justify-between mb-0.5 text-rk-orange-deep font-medium">
            <span>타사보상</span>
            <span className="rk-num">−₩{fmt(Math.round(totalOperational - totalAfterRival))}</span>
          </div>
        )}
        {cardSavings > 0 && (
          <div className="flex justify-between mb-0.5 text-rk-sale font-medium">
            <span>카드할인</span>
            <span className="rk-num">−₩{fmt(cardSavings)}</span>
          </div>
        )}
        <div className="mt-1.5 pt-1.5 border-t border-[#D8E4F4] flex justify-between items-baseline">
          <b className="text-rk-info">실제 지불</b>
          <b className="text-[16px] text-rk-info tracking-[-.02em] rk-num">₩{fmt(Math.round(totalFinal))}</b>
        </div>
        {totalSavings > 0 && (
          <div className="text-right text-[10px] text-rk-sale font-medium mt-0.5">총 −₩{fmt(Math.round(totalSavings))} 절약</div>
        )}
      </div>

      {/* 사은품 */}
      {giftLabel && giftAmount > 0 && (
        <div className="mt-3 bg-rk-tint-orange rounded-md p-2.5 text-[12px] text-rk-orange-deep">
          🎁 본 매장 단독 사은품 <b>{giftLabel}</b>
        </div>
      )}

      {/* CTA */}
      <div className="mt-4 flex flex-col gap-2">
        <Link href="#consult-form" className="bg-rk-orange hover:bg-rk-orange-deep text-white px-4 py-3 rounded-md text-[14px] font-bold no-underline text-center transition-colors">
          📞 상담 신청
        </Link>
        <a href={`tel:${hotline}`} className="bg-white border border-rk-line hover:border-rk-navy text-rk-ink px-4 py-2.5 rounded-md text-[12px] font-medium no-underline text-center">
          전화: {hotline}
        </a>
        {kakaoChannelUrl && (
          <a href={kakaoChannelUrl} target="_blank" rel="noreferrer" className="bg-[#FEE500] hover:brightness-95 text-[#1A1D24] px-4 py-2.5 rounded-md text-[12px] font-semibold no-underline text-center">
            💬 카톡 1:1 상담
          </a>
        )}
      </div>

      <p className="mt-3 text-[10px] text-rk-faint leading-[1.55] m-0">
        가입 후 5/19까지 발송 · 가구당 1개 한정 · 7일 청약 철회 가능
      </p>
    </aside>
  );
}
