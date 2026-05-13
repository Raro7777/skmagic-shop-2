"use client";

import { useEffect, useState, useCallback } from "react";

type SettlementRow = {
  id: string;
  leadId: string;
  productCode: string | null;
  productName: string;
  baseCommission: number;
  giftReturned: number;
  installReturned: number;
  rentalSupportReturned: number;
  netPayout: number;
  status: string;
  createdAt: string;
};
type Summary = { count: number; totalPayout: number; periodMonth: string };

const fmt = (n: number) => n.toLocaleString("ko-KR");

const STATUS_PILL: Record<string, { text: string; cls: string }> = {
  pending:   { text: "검증 대기",  cls: "bg-rk-tint-blue text-rk-info" },
  confirmed: { text: "검증 완료",  cls: "bg-rk-tint-green text-rk-success" },
  paid:      { text: "송금 완료",  cls: "bg-rk-tint-green text-rk-success" },
  cancelled: { text: "취소",       cls: "bg-rk-tint-gray text-rk-muted" },
  disputed:  { text: "이의 신청",  cls: "bg-rk-tint-orange text-rk-orange-deep" },
};

export default function SettlementSummary() {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/settlements", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.settlements);
      setSummary(data.summary);
      setError(null);
    } catch {
      setError("정산 데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 8000);
    return () => clearInterval(t);
  }, [fetchData]);

  return (
    <section className="bg-white border border-rk-line rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">💳 이번 달 정산 미리보기</h3>
        <span className="text-[13px] text-rk-muted">· 자동 생성 (lead → 설치 완료 시)</span>
        <div className="ml-auto flex gap-3 items-center">
          {summary && (
            <span className="text-[13px] text-rk-muted">
              {summary.periodMonth} · <b className="text-rk-ink">{summary.count}건</b> · 합계 <b className="text-rk-ink rk-num">₩{fmt(summary.totalPayout)}</b>
            </span>
          )}
          <button type="button" onClick={fetchData} className="text-[14px] text-rk-info bg-transparent border-0 cursor-pointer">↻ 새로고침</button>
        </div>
      </div>

      {error && <div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded mb-2">⚠ {error}</div>}

      {loading && rows.length === 0 ? (
        <div className="text-[14px] text-rk-muted py-6 text-center">로딩 중…</div>
      ) : rows.length === 0 ? (
        <div className="text-[14px] text-rk-muted py-6 text-center">
          이번 달 정산 데이터 없음. lead 상태를 <b className="text-rk-success">설치 완료</b>로 바꾸면 자동으로 생성됩니다.
        </div>
      ) : (
        <table className="w-full text-[14px] border-collapse">
          <thead>
            <tr>
              {["생성", "상품", "본사 수수료", "사은품 환원", "설치비 환원", "렌탈지원 환원", "실수령", "상태"].map((h, i) => (
                <th key={i} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const pill = STATUS_PILL[r.status] ?? STATUS_PILL.pending;
              return (
                <tr key={r.id} className={r.status === "cancelled" ? "opacity-50 line-through" : "hover:bg-rk-soft-2"}>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-rk-muted text-[13px]">
                    {formatTime(r.createdAt)}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <b className="text-rk-ink">{r.productName}</b>
                    {r.productCode && <small className="block text-rk-faint font-mono text-[12px]">{r.productCode}</small>}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-rk-success">+{fmt(r.baseCommission)}</td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">
                    {r.giftReturned > 0 ? <span className="text-rk-orange-deep">−{fmt(r.giftReturned)}</span> : <span className="text-rk-muted">—</span>}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">
                    {r.installReturned > 0 ? <span className="text-rk-orange-deep">−{fmt(r.installReturned)}</span> : <span className="text-rk-muted">—</span>}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">
                    {r.rentalSupportReturned > 0 ? <span className="text-rk-orange-deep">−{fmt(r.rentalSupportReturned)}</span> : <span className="text-rk-muted">—</span>}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num font-semibold text-rk-ink">{fmt(r.netPayout)}</td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <span className={"text-[12px] px-1.5 py-px rounded font-medium " + pill.cls}>{pill.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="mt-3 px-3 py-2 bg-rk-tint-blue rounded text-[13px] text-rk-info leading-[1.6]">
        ⓘ 정산은 lead가 <b>설치 완료(done)</b> 상태가 되면 트랜잭션으로 자동 생성됩니다. 본사가 done → 다른 상태로 되돌리면 해당 정산이 자동 <b>취소</b>됩니다.
      </div>
    </section>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n: number) { return n < 10 ? "0" + n : String(n); }
