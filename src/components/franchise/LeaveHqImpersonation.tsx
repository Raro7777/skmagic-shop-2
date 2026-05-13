"use client";

/** 본사 임시 진입 → cookie 제거 후 본사 콘솔로 복귀 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LeaveHqImpersonation() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/admin/hq-view-partner", { method: "DELETE" });
    } catch { /* ignore */ }
    router.push("/admin/super/partners");
  };

  return (
    <a
      href="/admin/super/partners"
      onClick={onClick}
      className="ml-auto text-rk-orange-deep underline text-[12.5px]"
    >
      {loading ? "나가는 중…" : "← 본사 콘솔로"}
    </a>
  );
}
