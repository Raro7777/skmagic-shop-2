import type { Metadata } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SK매직 인증파트너점 — 동네 인증판매점 한 번에 비교",
    template: "%s · SK매직 인증파트너점",
  },
  description:
    "정수기·공기청정기·비데·매트리스 렌탈 — SK매직 인증파트너점에서 사은품 차별화된 가격으로 상담받으세요.",
  keywords: ["SK매직", "인증파트너점", "렌탈", "정수기", "공기청정기", "비데", "매트리스", "사은품"],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "SK매직 인증파트너점",
    title: "SK매직 인증파트너점 — 동네 인증판매점 한 번에 비교",
    description:
      "정수기·공기청정기·비데·매트리스 렌탈을 SK매직 인증파트너점에서 상담받으세요. 인증판매점마다 사은품·설치비 혜택이 다릅니다.",
  },
  robots: { index: true, follow: true },
  // 파비콘 세트 — favicon.ico 는 app/favicon.ico 컨벤션이 처리. 여기서는 다양한 크기의
  // PNG / apple-touch / android-chrome 등을 명시. manifest/msapplication 도 함께 정의해
  // PWA 설치 및 네이버 검색 표시 URL 아이콘 호환성을 높임.
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/android-icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon-57x57.png", sizes: "57x57" },
      { url: "/apple-icon-60x60.png", sizes: "60x60" },
      { url: "/apple-icon-72x72.png", sizes: "72x72" },
      { url: "/apple-icon-76x76.png", sizes: "76x76" },
      { url: "/apple-icon-114x114.png", sizes: "114x114" },
      { url: "/apple-icon-120x120.png", sizes: "120x120" },
      { url: "/apple-icon-144x144.png", sizes: "144x144" },
      { url: "/apple-icon-152x152.png", sizes: "152x152" },
      { url: "/apple-icon-180x180.png", sizes: "180x180" },
    ],
  },
  manifest: "/manifest.json",
  other: {
    "msapplication-TileColor": "#ffffff",
    "msapplication-TileImage": "/ms-icon-144x144.png",
    "msapplication-config": "/browserconfig.xml",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
