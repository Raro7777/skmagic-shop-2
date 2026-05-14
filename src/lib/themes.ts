// 협력점 사이트 외형 프리셋 카탈로그 (Phase 1 — 컬러만)
//
// CSS variable override 는 src/app/globals.css 의 [data-theme="<id>"] 블록에 있음.
// 새 프리셋 추가 시 두 곳을 같이 업데이트할 것.
//
// 절대 손대지 않는 토큰 (브랜드 보호):
//   - --color-rk-sale (가격 빨강) — 신뢰성 직결
//   - --color-rk-ink / --color-rk-text — 본문 가독성
//   - SK 로고 배지의 오렌지 — 컴포넌트 안에 #F26A1F hard-pinned

export type ThemePreset = {
  id: string;
  label: string;
  tagline: string;
  chips: [string, string, string, string]; // primary / dark / tint / soft-2
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    label: "기본형 (SK매직 오렌지)",
    tagline: "현재 사이트 톤. 가장 검증된 SK매직 정체성",
    chips: ["#F26A1F", "#1A2A52", "#FCEFE5", "#F8F9FB"],
  },
  {
    id: "navyTrust",
    label: "신뢰 네이비",
    tagline: "금융사 톤. 시니어/40~60대 고가 렌탈 상권에 어울림",
    chips: ["#C9A24D", "#1A2A52", "#F5EDD9", "#F8F9FB"],
  },
  {
    id: "warmth",
    label: "따뜻한 베이지",
    tagline: "가정·주부 타깃. 정수기·매트리스에 잘 맞음",
    chips: ["#B85C3E", "#4A3729", "#F2E4D7", "#F8F5F0"],
  },
  {
    id: "premiumMono",
    label: "프리미엄 모노톤",
    tagline: "차콜+골드. 고가 공기청정기/프리미엄 라인 강조",
    chips: ["#B8893C", "#2A2D33", "#ECE3CC", "#F4F5F7"],
  },
  {
    id: "vibrantCoral",
    label: "활기찬 코랄",
    tagline: "신혼/2030 타깃. 비데·소형가전에 활기 더함",
    chips: ["#F87060", "#1E4E5F", "#FCE5E1", "#F4F5F7"],
  },
  {
    id: "naturalGreen",
    label: "내추럴 그린",
    tagline: "친환경 메시지 강함. 정수기·공기청정기에 잘 어울림",
    chips: ["#C9A23E", "#2F4D3A", "#F0E8D0", "#F2F5F0"],
  },
];

export const DEFAULT_THEME_ID = "default";

export function getThemePreset(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find(t => t.id === id) ?? THEME_PRESETS[0];
}
