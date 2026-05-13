"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { label: string; href: (partner: string) => string; match: (path: string, partner: string) => boolean };

// 비활성 카테고리(안마의자/건조기) + 이벤트 메뉴는 일시 hide. 추후 다시 켤 때 주석만 풀면 됨.
const TABS: Tab[] = [
  { label: "홈",       href: p => `/p/${p}`,                  match: (path, p) => path === `/p/${p}` || path === `/p/${p}/` },
  { label: "정수기",   href: p => `/p/${p}/category/water`,    match: path => path.endsWith("/category/water") },
  { label: "비데",     href: p => `/p/${p}/category/bidet`,    match: path => path.endsWith("/category/bidet") },
  { label: "공기청정기", href: p => `/p/${p}/category/air`,     match: path => path.endsWith("/category/air") },
  { label: "매트리스", href: p => `/p/${p}/category/mattress`,  match: path => path.endsWith("/category/mattress") },
  // { label: "안마의자", href: p => `/p/${p}/category/massage`,   match: path => path.endsWith("/category/massage") },
  // { label: "건조기",   href: p => `/p/${p}/category/dryer`,     match: path => path.endsWith("/category/dryer") },
  // { label: "이벤트",   href: p => `/p/${p}/events`,             match: path => path.endsWith("/events") },
  { label: "후기",     href: p => `/p/${p}/reviews`,            match: path => path.endsWith("/reviews") },
];

export default function NavTabs({ partnerCode }: { partnerCode: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-3.5 px-4 py-2.5 overflow-x-auto border-b border-rk-line text-[13px] font-medium whitespace-nowrap">
      {TABS.map(tab => {
        const active = tab.match(pathname, partnerCode);
        return (
          <Link
            key={tab.label}
            href={tab.href(partnerCode)}
            className={
              "py-1 cursor-pointer no-underline " +
              (active
                ? "text-rk-orange border-b-2 border-rk-orange pb-1.5 font-semibold"
                : "text-rk-text")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
