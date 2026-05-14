/**
 * 협력점이 입력한 배너 HTML 마크업을 안전한 형태로 정제.
 * <script>/<iframe>/on* 이벤트 등 위험 요소 제거, 스타일·이미지·링크는 허용.
 */
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "div", "section", "header", "footer", "main", "article", "aside", "nav",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "small", "b", "strong", "i", "em", "u",
  "ul", "ol", "li",
  "a", "img", "br", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
  "figure", "figcaption",
];

const ALLOWED_ATTRS_GENERAL = ["style", "class", "id", "title", "data-*"];
const ALLOWED_ATTRS = {
  "*": ALLOWED_ATTRS_GENERAL,
  a: [...ALLOWED_ATTRS_GENERAL, "href", "target", "rel"],
  img: [...ALLOWED_ATTRS_GENERAL, "src", "alt", "width", "height", "loading"],
  td: [...ALLOWED_ATTRS_GENERAL, "colspan", "rowspan"],
  th: [...ALLOWED_ATTRS_GENERAL, "colspan", "rowspan"],
};

export function sanitizeBannerHtml(input: string | null | undefined): string {
  if (!input) return "";
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowedStyles: {
      "*": {
        // 자주 쓰는 스타일만. background-image:url() 도 허용.
        "background": [/.*/],
        "background-color": [/.*/],
        "background-image": [/.*/],
        "background-size": [/.*/],
        "background-position": [/.*/],
        "background-repeat": [/.*/],
        "color": [/.*/],
        "font-size": [/.*/],
        "font-weight": [/.*/],
        "font-family": [/.*/],
        "text-align": [/.*/],
        "line-height": [/.*/],
        "padding": [/.*/],
        "padding-top": [/.*/],
        "padding-bottom": [/.*/],
        "padding-left": [/.*/],
        "padding-right": [/.*/],
        "margin": [/.*/],
        "margin-top": [/.*/],
        "margin-bottom": [/.*/],
        "margin-left": [/.*/],
        "margin-right": [/.*/],
        "border": [/.*/],
        "border-radius": [/.*/],
        "border-color": [/.*/],
        "border-width": [/.*/],
        "border-style": [/.*/],
        "width": [/.*/],
        "height": [/.*/],
        "max-width": [/.*/],
        "max-height": [/.*/],
        "min-width": [/.*/],
        "min-height": [/.*/],
        "display": [/.*/],
        "flex": [/.*/],
        "flex-direction": [/.*/],
        "justify-content": [/.*/],
        "align-items": [/.*/],
        "gap": [/.*/],
        "grid": [/.*/],
        "grid-template-columns": [/.*/],
        "opacity": [/.*/],
        "position": [/^(relative|absolute|static)$/], // fixed/sticky 금지 (사이트 침범 방지)
        "top": [/.*/],
        "left": [/.*/],
        "right": [/.*/],
        "bottom": [/.*/],
        "z-index": [/^\d+$/], // 큰 값으로 다른 UI 가리는 거 방지하려면 추후 max 제한
        "overflow": [/.*/],
        "object-fit": [/.*/],
        "letter-spacing": [/.*/],
        "text-decoration": [/.*/],
      },
    },
    // 외부 링크는 새 탭 + nofollow
    transformTags: {
      a: (tag, attribs) => {
        const href = attribs.href ?? "";
        const isExternal = /^https?:\/\//.test(href) && !href.includes("skmagic-shop.com") && !href.includes("rentking-next.vercel.app");
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            ...(isExternal && { target: "_blank", rel: "noreferrer nofollow" }),
          },
        };
      },
    },
  });
}
