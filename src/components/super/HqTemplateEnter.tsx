"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HqTemplateEnter({ partnerCode }: { partnerCode: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const enter = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/hq-view-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerCode }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error ?? "진입 실패"); return; }
      router.push("/admin/franchise");
    } catch {
      setErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-5">
      <h3 className="text-[14px] font-semibold text-rk-ink mb-2">편집 진입</h3>
      <p className="text-[13px] text-rk-muted mb-3">
        클릭 시 본사 콘솔이 협력점 콘솔로 임시 진입합니다. 편집 항목:
      </p>
      <ul className="text-[13px] text-rk-text leading-[1.6] mb-3 list-disc pl-5">
        <li>메인 슬라이드 배너 · 통합 배너 관리</li>
        <li>메인 페이지 상품 진열 · 카테고리 랭킹</li>
        <li>테마 프리셋 (theme)</li>
        <li>렌탈지원금 보장 · 영업자 마진 기본값</li>
      </ul>
      <button
        type="button"
        onClick={enter}
        disabled={busy}
        className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-4 py-2 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50"
      >
        {busy ? "진입 중…" : "📐 본사 표준 편집 진입"}
      </button>
      {err && <small className="ml-3 text-rk-sale text-[13px]">⚠ {err}</small>}
    </div>
  );
}
