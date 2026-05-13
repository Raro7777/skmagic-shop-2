import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://skmagic-shop.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "렌트왕 — 동네 SK매직 공식 협력점 한 번에 비교",
    template: "%s · 렌트왕",
  },
  description:
    "정수기·공기청정기·비데·매트리스 렌탈 — 동네 SK매직 공식 협력점에서 사은품 차별화된 가격으로 상담받으세요.",
  keywords: ["SK매직", "렌탈", "정수기", "공기청정기", "비데", "매트리스", "협력점", "사은품"],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "렌트왕",
    title: "렌트왕 — 동네 SK매직 공식 협력점 한 번에 비교",
    description:
      "정수기·공기청정기·비데·매트리스 렌탈을 동네 협력점에서 상담받으세요. 협력점마다 사은품·설치비 혜택이 다릅니다.",
  },
  robots: { index: true, follow: true },
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
