"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchInput({
  partnerCode,
  initialQuery,
}: {
  partnerCode: string;
  initialQuery: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) {
      router.push(`/p/${partnerCode}/search`);
      return;
    }
    router.push(`/p/${partnerCode}/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <span className="text-[18px]">🔍</span>
      <input
        autoFocus={!initialQuery}
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="상품명 / 모델번호로 검색"
        className="flex-1 px-3 py-2 border border-rk-line rounded text-[13px] outline-none focus:border-rk-navy"
      />
      <button
        type="submit"
        className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-2 rounded text-[14px] font-medium cursor-pointer transition-colors"
      >
        검색
      </button>
    </form>
  );
}
