"use client";

import { rawAnchorHtml } from "@/lib/naverConvButton";

/**
 * 우측 하단 카카오톡 플로팅 버튼 (FAB).
 *
 *   - 모든 컨슈머 페이지의 sticky CTA 와 별개로 항상 우측 하단에 노출.
 *   - 60×60 노란 동그라미. 모바일 우선.
 *   - 클릭 시 partner.kakaoChannelUrl 새 탭. URL 없으면 렌더 안 함.
 *   - 네이버 진단: onmousedown="javascript:try{NA_CONV_CUSTOM002();}catch(e){}" 정적 속성.
 *   - sticky bottom CTA 위로 살짝 띄움 — bottom 90px (safe-area 포함).
 */
export default function KakaoFab({ kakaoChannelUrl, partnerName }: { kakaoChannelUrl: string | null; partnerName: string }) {
  if (!kakaoChannelUrl) return null;
  const html = rawAnchorHtml({
    href: kakaoChannelUrl,
    conv: "custom002",
    target: "_blank",
    rel: "noopener noreferrer",
    className: "flex items-center justify-center w-[56px] h-[56px] rounded-full bg-[#FEE500] hover:bg-[#F4DC00] shadow-[0_6px_16px_rgba(0,0,0,0.18)] no-underline cursor-pointer transition-transform hover:-translate-y-0.5",
    title: `${partnerName} 카톡 상담`,
    innerHtml: `<span style="font-size:26px;line-height:1;">💬</span>`,
  });
  return (
    <div
      className="fixed right-3 z-40 pointer-events-none"
      style={{ bottom: "calc(90px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="pointer-events-auto" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
