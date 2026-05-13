"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const TITLES: Record<string, string> = {
  "/admin/franchise":             "대시보드",
  "/admin/franchise/leads":       "상담 / 문의",
  "/admin/franchise/sellers":     "영업자 · 링크",
  "/admin/franchise/products":    "상품 진열 · 배너",
  "/admin/franchise/policies":    "사은품 · 정책",
  "/admin/franchise/settlements": "정산",
  "/admin/franchise/analytics":   "마케팅 분석",
  "/admin/franchise/settings":    "사이트 설정",
};

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const title = TITLES[pathname] ?? "협력점 콘솔";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) router.push(`/admin/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="flex items-center gap-3.5 mb-3.5 flex-wrap">
      <Link href="/" className="text-[14px] text-rk-muted no-underline">← 허브</Link>
      <span className="text-[14px] text-rk-muted">
        협력점 운영 · <b className="text-rk-ink">{title}</b>
      </span>
      <form onSubmit={submit} className="ml-auto flex gap-2 items-center">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-[240px] px-2.5 py-1.5 border border-rk-line rounded text-[14px] outline-none focus:border-rk-navy"
          placeholder="🔍 영업자·상품·고객 검색"
        />
        <a
          className="bg-rk-orange hover:bg-rk-orange-deep text-white px-3 py-1.5 rounded text-[14px] no-underline font-medium transition-colors"
          href="/"
          target="_blank"
        >
          🔗 내 사이트 열기
        </a>
        <div className="w-7 h-7 rounded-full bg-rk-navy text-white grid place-items-center text-[13px] font-semibold">
          박
        </div>
      </form>
    </div>
  );
}
