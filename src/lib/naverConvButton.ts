/**
 * 네이버 검색광고 전환 버튼 raw HTML 생성 헬퍼.
 *
 * React 의 onClick/onMouseDown 은 hydration 후 등록되어 SSR HTML 에 안 보임.
 * 네이버 진단 도구는 정적 HTML 의 `onmousedown="javascript:try{NA_CONV_*()}catch(e){}"`
 * 패턴을 정규식으로 검사 → React JSX 핸들러로는 통과 불가.
 *
 * 우회: dangerouslySetInnerHTML 로 button/a 자체를 raw HTML 출력.
 */
export type NaverConvType = "lead" | "custom001" | "custom002" | "custom003";

const FN_NAME: Record<NaverConvType, string> = {
  lead: "NA_CONV_LEAD",
  custom001: "NA_CONV_CUSTOM001",
  custom002: "NA_CONV_CUSTOM002",
  custom003: "NA_CONV_CUSTOM003",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function rawAnchorHtml(args: {
  href: string;
  conv: NaverConvType;
  className: string;
  title?: string;
  target?: string;
  rel?: string;
  innerHtml: string; // 이미 escape 된 inner content (예: "📞 전화상담" 또는 img + 텍스트)
}): string {
  const target = args.target ? ` target="${esc(args.target)}"` : "";
  const rel = args.rel ? ` rel="${esc(args.rel)}"` : "";
  const title = args.title ? ` title="${esc(args.title)}"` : "";
  return `<a href="${esc(args.href)}" onmousedown="javascript:try{${FN_NAME[args.conv]}();}catch(e){}" class="${esc(args.className)}"${target}${rel}${title}>${args.innerHtml}</a>`;
}

export function rawButtonHtml(args: {
  conv: NaverConvType;
  className: string;
  innerHtml: string;
  type?: string;
}): string {
  const type = args.type ?? "button";
  return `<button type="${esc(type)}" onmousedown="javascript:try{${FN_NAME[args.conv]}();}catch(e){}" class="${esc(args.className)}">${args.innerHtml}</button>`;
}
