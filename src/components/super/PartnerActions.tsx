"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TIER_LIST, TIER_LABEL, TIER_PILL, type Tier } from "@/lib/tier";

type Props = {
  partnerCode: string;
  currentTier: Tier;
  status: string;
  activeLeadCount: number;
};

export default function PartnerActions({ partnerCode, currentTier, status, activeLeadCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const setTier = async (newTier: Tier) => {
    if (newTier === currentTier) return;
    setFlash(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/partners/${partnerCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setTier", tier: newTier }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "변경 실패" }); return; }
      setFlash({ tone: "ok", text: `tier: ${TIER_LABEL[currentTier]} → ${TIER_LABEL[newTier]}` });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setBusy(false); }
  };

  const closeStore = async () => {
    if (status === "closed") return;
    const msg = activeLeadCount > 0
      ? `이 협력점을 퇴점 처리합니다.\n\n진행 중 lead ${activeLeadCount}건은 본사 풀(hq_pool)로 이전되고, 영업자 ${activeLeadCount > 0 ? "전원" : ""}이 비활성화됩니다.\n\n계속하시겠습니까?`
      : "이 협력점을 퇴점 처리합니다.\n\n계속하시겠습니까?";
    if (!window.confirm(msg)) return;
    setFlash(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/partners/${partnerCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "처리 실패" }); return; }
      setFlash({ tone: "ok", text: `퇴점 완료. lead ${j.handedOverLeads}건 인계, 영업자 ${j.deactivatedSellers}명 비활성화.` });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setBusy(false); }
  };

  const reopenStore = async () => {
    if (status !== "closed" && status !== "suspended") return;
    if (!window.confirm("협력점을 다시 활성화합니다. lead 자동 환원은 안 되며 본사가 수동 재배정해야 합니다.")) return;
    setFlash(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/partners/${partnerCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "처리 실패" }); return; }
      setFlash({ tone: "ok", text: "재활성화 완료" });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <div className="flex items-center gap-1.5">
        <span className={"text-[9px] px-1.5 py-px rounded font-medium " + TIER_PILL[currentTier]}>
          {TIER_LABEL[currentTier]}
        </span>
        <select
          value={currentTier}
          disabled={busy || pending || status === "closed"}
          onChange={e => setTier(e.target.value as Tier)}
          className="border border-rk-line rounded px-1.5 py-0.5 text-[12px] bg-white"
          title="패키지 tier 변경"
        >
          {TIER_LIST.map(t => (
            <option key={t} value={t}>{TIER_LABEL[t]}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-1">
        {status === "active" ? (
          <button
            type="button"
            disabled={busy || pending}
            onClick={closeStore}
            className="bg-white hover:bg-rk-tint-red border border-rk-sale text-rk-sale text-[12px] px-2 py-0.5 rounded cursor-pointer disabled:opacity-50"
          >
            {busy ? "처리 중…" : "🚪 퇴점 처리"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || pending}
            onClick={reopenStore}
            className="bg-white hover:bg-rk-tint-green border border-rk-success text-rk-success text-[12px] px-2 py-0.5 rounded cursor-pointer disabled:opacity-50"
          >
            {busy ? "처리 중…" : "↻ 재활성화"}
          </button>
        )}
      </div>
      {flash && (
        <div className={"text-[9px] px-1.5 py-px rounded " + (flash.tone === "ok" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
          {flash.tone === "ok" ? "✓ " : "⚠ "}{flash.text}
        </div>
      )}
    </div>
  );
}
