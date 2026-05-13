"use client";

import { useState } from "react";
import { products as initialProducts, type Product } from "@/lib/mockData";

const STATUS_PILL: Record<Product["status"], string> = {
  event: "bg-rk-tint-orange text-rk-orange-deep",
  on:    "bg-rk-tint-green text-rk-success",
  off:   "bg-rk-tint-gray text-rk-muted",
};
const STATUS_LABEL: Record<Product["status"], string> = {
  event: "EVENT",
  on:    "노출중",
  off:   "비노출",
};
const ROW_BG: Record<string, string> = {
  event: "bg-rk-tint-orange",
  fade:  "opacity-55",
};

export default function ProductTable() {
  const [products, setProducts] = useState<Product[]>(initialProducts);

  const togglePin = (id: string) => {
    setProducts(p => p.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x));
  };

  return (
    <section className="bg-white border border-rk-line rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">🛒 상품 진열 순서 · 정수기 카테고리 (드래그로 순서 변경)</h3>
        <div className="ml-auto flex gap-2 items-center">
          <span className="text-[14px] text-rk-info cursor-pointer">필터: 정수기 ▾</span>
          <span className="text-[14px] text-rk-info cursor-pointer">+ 본사 마스터에서 추가</span>
        </div>
      </div>

      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr>
            <th className="w-[22px] text-left px-1.5 py-2 border-b border-rk-line"></th>
            <th className="w-[40px] text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">순서</th>
            <th className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">상품</th>
            <th className="w-[60px] text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">PIN</th>
            <th className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">월 렌탈료 (전국 동일)</th>
            <th className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">본사 판매수수료</th>
            <th className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">내 사은품/설치 ±</th>
            <th className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">이번 달</th>
            <th className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">상태</th>
            <th className="w-[120px] text-left px-1.5 py-2 border-b border-rk-line"></th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className={(p.rowTone ? ROW_BG[p.rowTone] : "") + " hover:bg-rk-soft-2"}>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <span className="text-rk-faint cursor-grab select-none">⋮⋮</span>
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2 font-mono text-rk-muted font-medium">
                {p.order}
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <span
                  className={
                    "w-9 h-9 rounded-[5px] inline-block align-middle " +
                    (p.thumbTone === "ice"
                      ? "bg-gradient-to-br from-[#DDE2EC] to-[#A0AEC0]"
                      : "bg-gradient-to-br from-[#E0E5EF] to-[#B8C2D2]")
                  }
                />
                <span className="inline-block align-middle ml-2">
                  <b className="block font-medium text-rk-ink">{p.name}</b>
                  <small className="text-rk-faint font-mono text-[12px]">{p.model}</small>
                </span>
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <button
                  type="button"
                  onClick={() => togglePin(p.id)}
                  title="PIN 고정"
                  className={
                    "w-8 h-[18px] rounded-full relative cursor-pointer inline-block align-middle border-0 p-0 transition-colors " +
                    (p.pinned ? "bg-rk-orange" : "bg-rk-line")
                  }
                >
                  <span
                    className="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all"
                    style={{ left: p.pinned ? 16 : 2 }}
                  />
                </button>
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <span className="rk-num">{p.rental}</span>
                <small className="block text-rk-muted text-[12px]">{p.rentalNote}</small>
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                {p.commission === "—" ? (
                  <span className="rk-num">—</span>
                ) : (
                  <>
                    <b className="rk-num text-rk-success font-semibold">{p.commission}</b>
                    <small className="block text-rk-muted text-[12px]">{p.commissionNote}</small>
                  </>
                )}
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2 leading-[1.4]">
                <div className={"rk-num " + (p.reductionTone === "orange" ? "text-rk-orange-deep" : "text-rk-muted")}>
                  {p.reduction}
                </div>
                {p.finalReceive && (
                  <div className="rk-num text-[13px] text-rk-muted font-medium">{p.finalReceive}</div>
                )}
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                {p.monthlyCount === "—" ? (
                  <span className="rk-num">—</span>
                ) : (
                  <>
                    <b className="rk-num">{p.monthlyCount}</b>
                    <small className="block text-rk-muted text-[12px]">{p.monthlyAmount}</small>
                  </>
                )}
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <span className={"text-[12px] px-1.5 py-px rounded font-medium " + STATUS_PILL[p.status]}>
                  {STATUS_LABEL[p.status]}
                </span>
              </td>
              <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                <button className="bg-rk-soft border-0 px-2 py-1 rounded text-[13px] cursor-pointer mr-0.5">편집</button>
                <button className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-2 py-1 rounded text-[13px] cursor-pointer">상세</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
