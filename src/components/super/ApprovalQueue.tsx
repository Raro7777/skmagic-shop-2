"use client";

import { useEffect, useState, useCallback } from "react";

type Approval = {
  id: string;
  kind: "partner_signup" | "commission_increase" | "settlement_dispute" | "brand_listing" | string;
  title: string;
  body: string | null;
  status: string;
  partnerCode: string | null;
  partnerName: string | null;
  productCode: string | null;
  proposedBaseCommission: number | null;
  proposedMonthIncentive: number | null;
  settlementId: string | null;
  reason: string | null;
  requestedByEmail: string | null;
  createdAt: string;
  ageHours: number;
};

const fmt = (n: number) => n.toLocaleString("ko-KR");

const KIND_META: Record<string, { label: string; icon: string }> = {
  partner_signup:      { label: "신규 협력점 가입", icon: "🏪" },
  commission_increase: { label: "수수료 인상 요청", icon: "💰" },
  settlement_dispute:  { label: "정산 이의제기",   icon: "💳" },
  brand_listing:       { label: "브랜드 입점 신청", icon: "🏷️" },
};

const ACTIONS_BY_KIND: Record<string, Array<{ action: "approve" | "reject" | "resolve"; label: string; tone: "ok" | "no" | "view" }>> = {
  partner_signup:      [{ action: "approve", label: "승인", tone: "ok" }, { action: "reject", label: "반려", tone: "no" }],
  commission_increase: [{ action: "approve", label: "승인", tone: "ok" }, { action: "reject", label: "반려", tone: "no" }],
  settlement_dispute:  [{ action: "resolve", label: "처리", tone: "ok" }, { action: "reject", label: "반려", tone: "no" }],
  brand_listing:       [{ action: "approve", label: "검토 완료", tone: "ok" }],
};
const TONE_CLASS: Record<string, string> = {
  ok: "bg-rk-navy hover:bg-rk-navy-deep text-white",
  no: "bg-rk-tint-red text-rk-sale",
  view: "bg-rk-soft text-rk-text",
};

export default function ApprovalQueue() {
  const [items, setItems] = useState<Approval[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals?status=pending", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 403) setError("본사 권한 필요");
        else throw new Error();
        return;
      }
      const data = await res.json();
      setItems(data.approvals);
      setError(null);
    } catch {
      setError("승인 데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (appr: Approval, action: "approve" | "reject" | "resolve") => {
    if (action === "reject" && appr.kind === "commission_increase") {
      const ok = confirm("수수료 인상을 반려합니다. 진행할까요?");
      if (!ok) return;
    }
    setBusyId(appr.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/approvals/${appr.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error ?? "처리 실패" });
        return;
      }
      // Optimistically remove from pending list
      setItems(prev => (prev ? prev.filter(a => a.id !== appr.id) : prev));
      setMessage({
        tone: "ok",
        text:
          (action === "approve" ? "✓ 승인 완료 " : action === "reject" ? "✓ 반려 완료 " : "✓ 처리 완료 ") +
          (data.sideEffect ? `· ${data.sideEffect}` : ""),
      });
    } catch {
      setMessage({ tone: "err", text: "네트워크 오류" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">
          ✅ 승인 대기열
          <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-tint-green text-rk-success font-medium ml-1.5">live</span>
        </h3>
        <div className="ml-auto flex gap-2 items-center">
          <span className="text-[13px] text-rk-muted">
            대기 <b>{items?.length ?? "—"}</b>건
          </span>
          <button type="button" onClick={fetchData} className="text-[14px] text-rk-info bg-transparent border-0 cursor-pointer">
            ↻
          </button>
        </div>
      </div>

      {message && (
        <div
          className={
            "text-[13px] px-2.5 py-2 rounded mb-2 " +
            (message.tone === "ok" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")
          }
        >
          {message.text}
        </div>
      )}

      {error && (
        <div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded mb-2">⚠ {error}</div>
      )}

      {loading ? (
        <div className="text-[14px] text-rk-muted py-4 text-center">로딩 중…</div>
      ) : items && items.length === 0 ? (
        <div className="text-[14px] text-rk-muted py-4 text-center">처리할 승인 요청이 없습니다.</div>
      ) : (
        items?.map(a => {
          const meta = KIND_META[a.kind] ?? { label: a.kind, icon: "•" };
          const actions = ACTIONS_BY_KIND[a.kind] ?? [{ action: "approve" as const, label: "처리", tone: "ok" as const }];
          return (
            <div key={a.id} className="bg-white border border-rk-line rounded-md p-3 mb-2">
              <div className="flex items-baseline gap-2 mb-1">
                <b className="text-[13px] text-rk-ink font-medium">{meta.icon} {meta.label}</b>
                <small className="text-[13px] text-rk-muted">·</small>
                <small className="text-[13px] text-rk-muted rk-num">
                  {a.ageHours < 1 ? "방금" : a.ageHours < 24 ? `${a.ageHours}시간 전` : `${Math.floor(a.ageHours / 24)}일 전`}
                </small>
                {a.partnerName && <small className="text-[13px] text-rk-muted">· {a.partnerName}</small>}
              </div>
              <h6 className="text-[13px] text-rk-ink font-medium mb-1">{a.title}</h6>
              {a.body && <p className="text-[13px] text-rk-muted m-0 leading-[1.5]">{a.body}</p>}

              {a.kind === "commission_increase" && a.productCode && (
                <div className="text-[13px] text-rk-text mt-2 px-2 py-1.5 bg-rk-soft-2 rounded font-mono">
                  {a.productCode} ·{" "}
                  {a.proposedBaseCommission != null && `기본 → ₩${fmt(a.proposedBaseCommission)} `}
                  {a.proposedMonthIncentive != null && `인센티브 → +₩${fmt(a.proposedMonthIncentive)}`}
                </div>
              )}

              <div className="flex gap-1 mt-2">
                {actions.map(act => (
                  <button
                    key={act.action}
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => handleAction(a, act.action)}
                    className={
                      "border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50 " +
                      TONE_CLASS[act.tone]
                    }
                  >
                    {busyId === a.id ? "…" : act.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
