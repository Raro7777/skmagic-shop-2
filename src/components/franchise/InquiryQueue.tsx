"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InquirySnapshot } from "@/lib/franchiseDashboard";
import type { LeadStatus } from "@/lib/leadStatus";

const PILL: Record<string, string> = {
  consult_wish:  "bg-rk-tint-blue text-rk-info",
  respond:       "bg-rk-tint-red text-rk-sale",
};

const SOURCE_AVATAR: Record<string, { letter: string; bg: string; fg: string }> = {
  kakao:         { letter: "K", bg: "bg-[#FEE500]", fg: "text-[#1A1D24]" },
  phone:         { letter: "📞", bg: "bg-rk-tint-green", fg: "text-rk-success" },
  consumer_form: { letter: "🌐", bg: "bg-rk-tint-blue", fg: "text-rk-info" },
  api_partner:   { letter: "🔌", bg: "bg-rk-tint-orange", fg: "text-rk-orange-deep" },
};

export default function InquiryQueue({ data }: { data: InquirySnapshot }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transition = async (id: string, status: LeadStatus, reason?: string) => {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/leads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "상태 변경 실패");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">💬 응대 대기열 · {data.items.length}건</h3>
        <div className="ml-auto flex gap-2 items-center">
          {data.avgResponseMinutes != null && (
            <span className="text-[13px] text-rk-muted">평균 응답 {data.avgResponseMinutes}분</span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[13px] mb-2">⚠ {error}</div>
      )}

      {data.items.length === 0 ? (
        <div className="bg-rk-tint-green rounded p-4 text-center text-[14px] text-rk-success">
          ✓ 응대 대기 중인 lead가 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map(q => {
            const avatar = SOURCE_AVATAR[q.source] ?? SOURCE_AVATAR.consumer_form;
            return (
              <div
                key={q.id}
                className={"rounded p-3 border " + (q.isUrgent ? "border-rk-tint-red" : "border-rk-line")}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={"w-7 h-7 rounded-full grid place-items-center text-[13px] font-semibold " + avatar.bg + " " + avatar.fg}>
                    {avatar.letter}
                  </div>
                  <b className="text-rk-ink text-[14px]">{q.customerName}</b>
                  <span className={"font-mono font-medium text-[13px] " + (q.isUrgent ? "text-rk-sale" : "text-rk-muted")}>
                    {q.ageLabel}
                  </span>
                  <span className={"ml-auto text-[12px] px-1.5 py-px rounded font-medium " + PILL[q.status]}>
                    {q.statusLabel}
                  </span>
                </div>
                <p className="m-0 mb-1.5 text-[14px] text-rk-text bg-rk-soft px-2.5 py-2 rounded leading-[1.5]">
                  {q.message}
                </p>
                <div className="flex gap-1 flex-wrap">
                  {q.status === "consult_wish" ? (
                    <button
                      type="button"
                      disabled={busyId === q.id || pending}
                      onClick={() => transition(q.id, "consult_active")}
                      className="border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer bg-rk-navy hover:bg-rk-navy-deep text-white font-medium disabled:opacity-50"
                    >
                      {busyId === q.id ? "처리 중…" : "응대 시작"}
                    </button>
                  ) : (
                    // respond — 회신 작성 (사유 입력은 OrderPipeline 행에서 처리, 여기는 단축 이동만)
                    <a
                      href="#order-pipeline"
                      className="text-[13px] text-rk-info underline"
                    >
                      ↓ 아래 행에서 회신 작성
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center px-3 py-2 bg-rk-tint-green rounded text-[13px] text-rk-success mt-2">
        ✓ 오늘 완료 {data.doneToday}건 · 이번 주 누적 {data.doneWeek}건
      </div>
    </div>
  );
}
