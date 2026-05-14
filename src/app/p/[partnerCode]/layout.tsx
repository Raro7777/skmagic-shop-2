import { prisma } from "@/lib/prisma";

// 협력점 사이트 외형 프리셋 적용 — data-theme 래퍼 한 곳에서 모든 하위 라우트에 자동 반영.
// CSS 변수 override 정의: src/app/globals.css 의 [data-theme="<id>"] 블록.
// 카탈로그: src/lib/themes.ts
export default async function PartnerConsumerLayout({
  params,
  children,
}: {
  params: Promise<{ partnerCode: string }>;
  children: React.ReactNode;
}) {
  const { partnerCode } = await params;
  const partner = await prisma.partner.findUnique({
    where: { partnerCode },
    select: { theme: true },
  });
  const theme = partner?.theme ?? "default";
  return <div data-theme={theme}>{children}</div>;
}
