"use client";

import { useState } from "react";
import { CARD_DISCOUNT_MAX } from "@/lib/constants/pricing";

/**
 * SK인텔릭스 제휴 카드 혜택 — 매직몰 (2026-05 기준) 정책 반영.
 * 카드사별 전월실적 단계별 차등 + 5월 한정 무실적 신규 신청자 추가 프로모션.
 *
 * 출처: https://www.magic-mall.co.kr (2026-05)
 * 변경 시 카드사 단계별 표·5월 한정 카드만 업데이트.
 */

type CardTier = {
  name: string;
  tiers: Array<{ label: string; amount: number }>; // 전월실적 단계별
  maxKr: number;
};

const CARDS: CardTier[] = [
  { name: "KB국민 올림",   tiers: [{ label: "30만↑", amount: 11000 }, { label: "70만↑", amount: 15000 }, { label: "150만↑", amount: 20000 }], maxKr: 20000 },
  { name: "삼성",         tiers: [{ label: "30만↑", amount:  7000 }, { label: "70만↑", amount: 10000 }, { label: "100만↑", amount: 13000 }], maxKr: 13000 },
  { name: "KJ",          tiers: [{ label: "30만↑", amount: 10000 }, { label: "70만↑", amount: 16000 }, { label: "150만↑", amount: 23000 }], maxKr: 23000 },
  { name: "LOCA",        tiers: [{ label: "30만↑", amount: 13000 }, { label: "70만↑", amount: 16000 }, { label: "150만↑", amount: 25000 }], maxKr: 25000 },
  { name: "하나플러스",     tiers: [{ label: "30만↑", amount: 13000 }, { label: "70만↑", amount: 18000 }, { label: "150만↑", amount: 25000 }], maxKr: 25000 },
  { name: "우리",         tiers: [{ label: "30만↑", amount: 10000 }, { label: "70만↑", amount: 15000 }, { label: "120만↑", amount: 20000 }], maxKr: 20000 },
  { name: "신한",         tiers: [{ label: "30만↑", amount: 12000 }, { label: "70만↑", amount: 15000 }, { label: "150만↑", amount: 25000 }], maxKr: 25000 },
  { name: "현대",         tiers: [{ label: "30만↑", amount:  8000 }, { label: "70만↑", amount: 12000 }, { label: "100만↑", amount: 16000 }], maxKr: 16000 },
];

const MAY_2026_BONUSES = [
  { card: "KB국민 올림", text: "직전 6개월 무실적 신규 신청 + 자동납부 시 5년간 추가 9,000원" },
  { card: "삼성",       text: "직전 6개월 무실적 신청자 5년간 추가 10,000원 (월 최대 24,000원)" },
  { card: "우리",       text: "자동이체 결제 시 구간별 추가 할인" },
  { card: "신한",       text: "직전 6개월 무실적 신청자 5년간 추가 3,000원" },
  { card: "현대",       text: "직전 6개월 무실적 신청자 5년간 추가 (월 최대 26,000원)" },
];

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function CardBenefitsPanel() {
  const [open, setOpen] = useState(false);
  // 본사 매직몰 공식 표시상의 카드할인 최대 금액 cap (민원 방지용 — CARDS 일부는 25k 도 있음)
  const maxAmount = Math.min(CARD_DISCOUNT_MAX, Math.max(...CARDS.map(c => c.maxKr)));

  return (
    <div className="bg-white border border-rk-line rounded-md text-[12px] mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer bg-transparent border-0 text-left"
      >
        <span className="text-rk-sale font-bold">💳</span>
        <span className="flex-1 text-rk-ink font-semibold">
          제휴카드 8개사 · 최대 월 −₩{fmt(maxAmount)} 할인
        </span>
        <span className="bg-rk-tint-red text-rk-sale text-[10px] font-bold px-1.5 py-0.5 rounded">
          5월 한정 추가
        </span>
        <span className="text-rk-muted text-[14px]">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="border-t border-rk-line-2 px-3 py-2.5 flex flex-col gap-2.5">
          {/* 카드사별 차등 표 */}
          <div>
            <div className="text-[11px] font-semibold text-rk-muted mb-1">카드사별 할인액 (전월실적 단계별)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-rk-faint">
                    <th className="text-left pr-2 pb-1 font-medium">카드</th>
                    {["30만↑", "70만↑", "100~120만↑", "150만↑"].map(h => (
                      <th key={h} className="text-right pl-1 pb-1 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CARDS.map(c => (
                    <tr key={c.name} className="border-t border-rk-line-2">
                      <td className="pr-2 py-1 text-rk-ink whitespace-nowrap">{c.name}</td>
                      {["30만↑", "70만↑", "100~120만↑", "150만↑"].map((h, i) => {
                        // h 와 c.tiers[i] 매칭 (정확 매칭 위해 includes 검사)
                        const tier = c.tiers.find(t => t.label === h)
                          ?? c.tiers.find(t => h.startsWith("100") && (t.label === "100만↑" || t.label === "120만↑"));
                        return (
                          <td key={i} className="pl-1 py-1 text-right rk-num text-rk-text whitespace-nowrap">
                            {tier ? `−${fmt(tier.amount)}` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5월 한정 추가 프로모션 */}
          <div className="bg-rk-tint-red rounded-md p-2">
            <div className="text-[11px] font-bold text-rk-sale mb-1">🔥 2026-05 한정 추가 혜택 (무실적 신규 신청자)</div>
            <ul className="m-0 pl-3.5 list-disc text-[11px] leading-[1.55] text-rk-text">
              {MAY_2026_BONUSES.map((b, i) => (
                <li key={i}><b>{b.card}</b>: {b.text}</li>
              ))}
            </ul>
          </div>

          <small className="text-[10px] text-rk-faint leading-[1.5] block">
            ⓘ 전월실적은 카드 발급 직전 1개월 사용액 기준 · 약정 기간 내내 지속 · 자동이체 필수 ·
            반값 프로모션과 중복 불가. 카드 발급은 카드사 별 심사 절차에 따름.
          </small>
        </div>
      )}
    </div>
  );
}
