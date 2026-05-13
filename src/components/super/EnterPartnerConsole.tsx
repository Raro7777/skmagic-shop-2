"use client";

/**
 * 본사 → 협력점 콘솔 임시 진입 버튼.
 *  - hq_view_partner cookie 설정 후 /admin/franchise 로 이동.
 *  - 협력점 layout 에 "본사 임시 진입" 배지 + "본사 콘솔로" 링크가 노출됨.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EnterPartnerConsole({
  partnerCode,
  partnerName,
}: {
  partnerCode: string;
  partnerName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onClick = async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/hq-view-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "진입 실패");
        setLoading(false);
        return;
      }
      router.push("/admin/franchise");
    } catch {
      setErr("네트워크 오류");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        title={`${partnerName} 협력점 콘솔로 진입`}
        className="text-[12px] text-rk-orange-deep border border-rk-orange/40 hover:bg-rk-tint-orange px-1.5 py-0.5 rounded font-medium disabled:opacity-60"
      >
        {loading ? "진입중…" : "콘솔 진입"}
      </button>
      {err && <span className="text-[11px] text-rk-sale block">{err}</span>}
    </>
  );
}
