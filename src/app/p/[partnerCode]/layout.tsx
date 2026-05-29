import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

// 협력점 정보 1회만 쿼리 (generateMetadata + layout 함수 둘 다 호출됨)
const getPartner = cache(async (partnerCode: string) => {
  return prisma.partner.findUnique({
    where: { partnerCode },
    select: { partnerName: true, brandLabel: true, theme: true, naverWcsId: true },
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerCode: string }>;
}): Promise<Metadata> {
  const { partnerCode } = await params;
  const partner = await getPartner(partnerCode);
  if (!partner) return {};
  const titleStr = `${partner.partnerName} — ${partner.brandLabel}`;
  const desc = `${partner.partnerName} (${partner.brandLabel}) — 정수기·공기청정기·비데·매트리스 SK매직 렌탈 상담`;
  return {
    // default: 메인 분양 페이지에서 사용 (page.tsx 에 별도 title 없음)
    // template: 하위 페이지(상품/카테고리/검색 등)가 plain string title 을 설정할 때 감싸는 룰
    //   → "상품명 · 인터넷끝판왕" 식으로 협력점 이름이 사이트 이름처럼 노출됨 (렌트왕 노출 X)
    title: { default: titleStr, template: `%s · ${partner.partnerName}` },
    description: desc,
    openGraph: {
      type: "website",
      locale: "ko_KR",
      siteName: partner.partnerName,
      title: titleStr,
      description: desc,
    },
  };
}

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
  const partner = await getPartner(partnerCode);
  const theme = partner?.theme ?? "default";
  const wcsId = partner?.naverWcsId?.trim() || null;
  // 네이버 검색광고 전환 추적 — 협력점 wa 값 설정 시 SSR HTML 에 직접 inline 으로 inject.
  // next/script(strategy=afterInteractive) 는 RSC payload 안에만 직렬화되어 네이버 정적 검사 도구가 인식 못 함.
  // raw <script> 태그로 출력해야 페이지 소스 보기 / 네이버 추적 진단 도구에서 인식.
  const wcsInitCode = wcsId
    ? `if (!window.wcs_add) window.wcs_add = {};` +
      `window.wcs_add["wa"] = ${JSON.stringify(wcsId)};` +
      `if (!window._nasa) window._nasa = {};` +
      `if (window.wcs) { window.wcs.inflow(); }` +
      `/* wcs_do(전환)은 상담신청 완료 시점에 ConsultForm 에서 호출 */`
    : null;

  return (
    <div data-theme={theme}>
      {wcsId && (
        <>
          <script async src="//wcs.naver.net/wcslog.js" />
          <script dangerouslySetInnerHTML={{ __html: wcsInitCode! }} />
        </>
      )}
      {children}
    </div>
  );
}
