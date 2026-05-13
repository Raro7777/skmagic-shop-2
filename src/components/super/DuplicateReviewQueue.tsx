"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type LeadCard = {
  id: string;
  customerName: string;
  phoneMasked: string;
  productInterest: string;
  region: string | null;
  partnerName: string | null;
  createdAtLabel: string;
  status: string;
};
type MatchCard = LeadCard & { reason: string };

export default function DuplicateReviewQueue({
  cards,
}: {
  cards: Array<{ lead: LeadCard; matches: MatchCard[] }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; tone: "ok" | "err"; text: string } | null>(null);

  if (cards.length === 0) {
    return (
      <div className="bg-white border border-rk-line rounded-lg p-8 text-center">
        <div className="text-[32px] mb-2">✓</div>
        <p className="text-[13px] text-rk-text m-0">대기 중인 중복 후보가 없습니다.</p>
        <small className="text-[13px] text-rk-muted block mt-1">
          신규 lead가 들어와 2/3순위 룰에 걸리면 여기에 표시됩니다.
        </small>
      </div>
    );
  }

  const decide = (leadId: string, verdict: "confirmed" | "bad_db" | "clear") => {
    setBusyId(leadId);
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/duplicate`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ verdict }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ id: leadId, tone: "err", text: data.error ?? "처리 실패" });
          return;
        }
        const labels: Record<string, string> = {
          confirmed: "중복 확정 처리됨",
          bad_db: "불량 DB로 분류됨",
          clear: "정상 lead로 표시됨 (중복 아님)",
        };
        setMessage({ id: leadId, tone: "ok", text: `✓ ${labels[verdict] ?? "처리됨"}` });
        router.refresh();
      } catch {
        setMessage({ id: leadId, tone: "err", text: "네트워크 오류" });
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {cards.map(({ lead, matches }) => (
        <div key={lead.id} className="bg-white border border-rk-line rounded-lg p-4">
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            <span className="bg-rk-tint-orange text-rk-orange-deep px-1.5 py-0.5 rounded text-[12px] font-semibold">검토 대기</span>
            <h4 className="text-[14px] font-semibold text-rk-ink">신규 접수 lead</h4>
            <small className="text-[13px] text-rk-muted">·</small>
            <small className="text-[13px] text-rk-muted rk-num">{lead.createdAtLabel}</small>
            {message?.id === lead.id && (
              <span className={"ml-auto text-[13px] " + (message.tone === "ok" ? "text-rk-success" : "text-rk-sale")}>
                {message.text}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card label="신규 접수 (검토 대상)" highlight>
              <LeadFields lead={lead} />
            </Card>
            <div>
              <h5 className="text-[14px] font-semibold text-rk-ink mb-2">
                매칭된 기존 lead {matches.length}건
              </h5>
              {matches.length === 0 ? (
                <div className="bg-rk-soft-2 rounded p-3 text-[13px] text-rk-muted">
                  매칭 후보를 못 찾음 (시간차로 사라졌을 수 있음)
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {matches.map(m => (
                    <Card key={m.id} label={m.reason}>
                      <LeadFields lead={m} />
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-3 justify-end">
            <button
              type="button"
              disabled={pending && busyId === lead.id}
              onClick={() => decide(lead.id, "clear")}
              className="bg-rk-soft hover:bg-rk-line-2 text-rk-text border-0 px-3 py-1.5 rounded text-[14px] cursor-pointer"
            >
              ✓ 정상 (중복 아님)
            </button>
            <button
              type="button"
              disabled={pending && busyId === lead.id}
              onClick={() => decide(lead.id, "bad_db")}
              className="bg-rk-tint-red hover:brightness-95 text-rk-sale border-0 px-3 py-1.5 rounded text-[14px] cursor-pointer font-medium"
            >
              ⚠ 불량 DB
            </button>
            <button
              type="button"
              disabled={pending && busyId === lead.id}
              onClick={() => decide(lead.id, "confirmed")}
              className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1.5 rounded text-[14px] cursor-pointer font-medium"
            >
              {busyId === lead.id ? "처리중…" : "🔁 중복 확정"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={"rounded-md p-3 border " + (highlight ? "bg-rk-tint-orange border-[#F4DCC9]" : "bg-rk-soft-2 border-rk-line-2")}>
      <small className={"text-[12px] font-semibold uppercase tracking-[.04em] block mb-1.5 " + (highlight ? "text-rk-orange-deep" : "text-rk-muted")}>
        {label}
      </small>
      {children}
    </div>
  );
}

function LeadFields({ lead }: { lead: LeadCard | MatchCard }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-y-1 text-[13px]">
      <span className="text-rk-muted">고객</span>
      <b className="text-rk-ink">{lead.customerName}</b>
      <span className="text-rk-muted">전화</span>
      <span className="text-rk-text font-mono">{lead.phoneMasked}</span>
      <span className="text-rk-muted">관심상품</span>
      <span className="text-rk-text">{lead.productInterest}</span>
      {lead.region && (
        <>
          <span className="text-rk-muted">지역</span>
          <span className="text-rk-text">{lead.region}</span>
        </>
      )}
      {lead.partnerName && (
        <>
          <span className="text-rk-muted">담당점</span>
          <span className="text-rk-text">{lead.partnerName}</span>
        </>
      )}
      <span className="text-rk-muted">상태</span>
      <span className="text-rk-text">{lead.status}</span>
      <span className="text-rk-muted">접수</span>
      <span className="text-rk-text rk-num">{lead.createdAtLabel}</span>
    </div>
  );
}
