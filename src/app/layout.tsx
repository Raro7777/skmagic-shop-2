import type { Metadata } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SK매직 공식인증점 — 동네 인증판매점 한 번에 비교",
    template: "%s · SK매직 공식인증점",
  },
  description:
    "정수기·공기청정기·비데·매트리스 렌탈 — SK매직 공식인증점에서 사은품 차별화된 가격으로 상담받으세요.",
  keywords: ["SK매직", "공식인증점", "렌탈", "정수기", "공기청정기", "비데", "매트리스", "사은품"],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "SK매직 공식인증점",
    title: "SK매직 공식인증점 — 동네 인증판매점 한 번에 비교",
    description:
      "정수기·공기청정기·비데·매트리스 렌탈을 SK매직 공식인증점에서 상담받으세요. 인증판매점마다 사은품·설치비 혜택이 다릅니다.",
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
