import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "렌트왕 · 협력점 분양 플랫폼",
  description: "본사–협력점–소비자, 3계층 렌탈 분양 운영 콘솔",
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
