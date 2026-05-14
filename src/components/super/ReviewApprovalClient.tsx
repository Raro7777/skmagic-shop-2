"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  productCode: string | null;
  productName: string | null;
  partnerCode: string | null;
  partnerName: string | null;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  installPhotoUrl: string | null;
  region: string | null;
  selectedMode: string | null;
  selectedContractPeriod: number | null;
  approvalStatus: string;
  rejectReason: string | null;
  submittedByRole: string | null;
  createdAt: string;
};

export default function ReviewApprovalClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectText, setRejectText] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/super/reviews?status=${filter}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "조회 실패"); return; }
      setItems(j.items ?? []);
      setError(null);
    } catch {
      setError("네트워크 오류");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [filter]);

  const approve = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/super/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? "승인 실패"); return; }
      await load();
    } finally { setBusy(null); }
  };

  const reject = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/super/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectReason: rejectText.trim() || null }),
      });
      if (!res.ok) { const j = await res.json(); setError(j.error ?? "거절 실패"); return; }
      setRejectFor(null); setRejectText("");
      await load();
    } finally { setBusy(null); }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {([
          { v: "pending",  l: "🟡 승인 대기" },
          { v: "approved", l: "✅ 승인됨" },
          { v: "rejected", l: "❌ 거절됨" },
        ] as const).map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => setFilter(o.v)}
            className={"px-3 py-1.5 rounded text-[13px] cursor-pointer border " + (filter === o.v ? "bg-rk-navy text-white border-rk-navy" : "bg-white text-rk-text border-rk-line")}
          >
            {o.l}
          </button>
        ))}
        <span className="ml-auto text-[13px] text-rk-muted">{items.length}건</span>
      </div>

      {error && <div className="bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[13px] mb-2">⚠ {error}</div>}

      {loading ? (
        <div className="text-center text-rk-muted py-8 text-[14px]">로딩 중…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-rk-muted py-8 text-[14px]">{filter === "pending" ? "승인 대기 후기가 없습니다." : "표시할 후기가 없습니다."}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(it => (
            <article key={it.id} className="border border-rk-line-2 rounded-md p-3 flex gap-3">
              {it.installPhotoUrl && (
                <img src={it.installPhotoUrl} alt="" className="w-[120px] h-[120px] object-cover rounded border border-rk-line shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  <span className="text-rk-warn">{"★".repeat(it.rating)}{"☆".repeat(5 - it.rating)}</span>
                  <b className="text-[14px] text-rk-ink">{it.customerName}</b>
                  {it.region && <span className="text-[12px] text-rk-muted">· {it.region}</span>}
                  <span className="text-[12px] text-rk-faint ml-auto rk-num">{it.createdAt.slice(0, 10)}</span>
                </div>
                <div className="text-[12px] text-rk-muted mb-1.5">
                  {it.partnerName ?? "—"} · {it.productName ?? "(상품 미지정)"} {it.selectedMode && `· ${it.selectedMode}`}{it.selectedContractPeriod && ` ${it.selectedContractPeriod}m`}
                  {it.submittedByRole && <span className="ml-1 opacity-70">({it.submittedByRole})</span>}
                </div>
                {it.title && <b className="block text-[14px] text-rk-ink mb-1">{it.title}</b>}
                <p className="text-[13px] text-rk-text leading-[1.55] m-0 whitespace-pre-wrap">{it.body}</p>
                {it.rejectReason && (
                  <div className="mt-1.5 text-[12px] bg-rk-tint-red text-rk-sale px-2 py-1 rounded">
                    거절 사유: {it.rejectReason}
                  </div>
                )}

                {filter === "pending" && (
                  <>
                    {rejectFor === it.id ? (
                      <div className="mt-2 flex gap-2 items-baseline">
                        <input
                          type="text"
                          value={rejectText}
                          onChange={e => setRejectText(e.target.value)}
                          placeholder="거절 사유 (선택)"
                          className="flex-1 px-2 py-1 border border-rk-line rounded text-[13px]"
                        />
                        <button
                          type="button"
                          disabled={busy === it.id}
                          onClick={() => reject(it.id)}
                          className="bg-rk-sale text-white border-0 px-3 py-1 rounded text-[13px] cursor-pointer disabled:opacity-50"
                        >
                          {busy === it.id ? "처리 중…" : "거절 확정"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectFor(null); setRejectText(""); }}
                          className="bg-rk-soft text-rk-text border-0 px-3 py-1 rounded text-[13px] cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={busy === it.id}
                          onClick={() => approve(it.id)}
                          className="bg-rk-success text-white border-0 px-3 py-1.5 rounded text-[13px] cursor-pointer disabled:opacity-50 font-semibold"
                        >
                          {busy === it.id ? "처리 중…" : "✓ 승인"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectFor(it.id); setRejectText(""); }}
                          className="bg-white border border-rk-line text-rk-sale px-3 py-1.5 rounded text-[13px] cursor-pointer hover:bg-rk-tint-red"
                        >
                          ✕ 거절
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
