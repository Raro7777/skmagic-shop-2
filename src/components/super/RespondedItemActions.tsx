"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Decision = "pass" | "fail" | "revise";

const META: Record<Decision, { to: string; label: string; tone: string; needsReason: boolean; placeholder: string }> = {
  pass:   { to: "verify_passed",  label: "✅ 인증 완료",   tone: "bg-rk-success hover:brightness-90 text-white",     needsReason: false, placeholder: "" },
  fail:   { to: "verify_failed",  label: "🚨 인증 실패",   tone: "bg-rk-sale text-white",                            needsReason: true,  placeholder: "자격 미달 / 신분증 위조 등 사유" },
  revise: { to: "verify_revise",  label: "↪ 추가 회송",    tone: "bg-rk-orange hover:bg-rk-orange-deep text-white",  needsReason: true,  placeholder: "협력점 회신에 대한 답변 / 추가 보완 요청" },
};

export default function RespondedItemActions({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [modal, setModal] = useState<Decision | null>(null);
  const [reasonText, setReasonText] = useState("");

  const send = async (decision: Decision, reason?: string) => {
    setError(null);
    setBusy(true);
    try {
      const m = META[decision];
      const r = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: m.to, ...(reason ? { reason, memo: `[본사 답변] ${reason}` } : {}) }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "처리 실패"); return; }
      setDone(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(false);
      setModal(null);
      setReasonText("");
    }
  };

  const onClick = (decision: Decision) => {
    if (META[decision].needsReason) { setModal(decision); setReasonText(""); return; }
    if (!confirm("인증 완료 처리합니다. 자동으로 설치대기 단계로 넘어갑니다. 계속?")) return;
    void send(decision);
  };

  if (done) return <span className="text-[12px] text-rk-success font-medium">✓ 처리됨</span>;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {(["pass", "revise", "fail"] as Decision[]).map(d => (
        <button
          key={d}
          type="button"
          disabled={busy || pending}
          onClick={() => onClick(d)}
          className={"border-0 px-2 py-1 rounded text-[12px] cursor-pointer font-medium disabled:opacity-50 " + META[d].tone}
        >
          {busy ? "처리…" : META[d].label}
        </button>
      ))}
      {error && <span className="text-[12px] text-rk-sale">⚠ {error}</span>}

      {modal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg p-4 w-[400px] shadow-lg" onClick={e => e.stopPropagation()}>
            <h4 className="text-[14px] font-semibold mb-1">{META[modal].label} 사유</h4>
            <p className="text-[13px] text-rk-muted mb-2">협력점이 본사 답변으로 확인합니다.</p>
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              rows={4}
              autoFocus
              className="w-full border border-rk-line rounded p-2 text-[14px] focus:outline-none focus:border-rk-navy"
              placeholder={META[modal].placeholder}
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button type="button" onClick={() => setModal(null)}
                className="bg-rk-soft hover:bg-rk-line text-rk-ink border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer">
                취소
              </button>
              <button
                type="button"
                disabled={busy || reasonText.trim().length < 3}
                onClick={() => send(modal, reasonText.trim())}
                className="bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer disabled:opacity-50"
              >
                {busy ? "처리 중…" : "전송"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
