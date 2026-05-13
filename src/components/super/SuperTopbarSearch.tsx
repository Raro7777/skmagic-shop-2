"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SuperTopbarSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) router.push(`/admin/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit}>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        className="w-[260px] px-2.5 py-1.5 border border-rk-line rounded text-[14px] outline-none focus:border-rk-navy"
        placeholder="🔍 협력점·상품·고객·주문 ID 검색"
      />
    </form>
  );
}
