"use client";

import { useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: string;
  action: string;
  actorEmail: string | null;
  actorId: string | null;
  targetEmail: string | null;
  targetUserId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  login_success: "🟢 로그인 성공",
  login_fail: "🔴 로그인 실패",
  login_locked: "🔒 로그인 잠금",
  account_create: "➕ 계정 발급",
  password_change: "🔐 비번 변경 (본인)",
  password_reset: "🔑 비번 재설정 (본사)",
  account_unlock: "🔓 잠금 해제",
  account_status_change: "⚙ 상태 변경",
  session_logout: "🚪 로그아웃",
};
const ACTION_TONE: Record<string, string> = {
  login_success: "bg-rk-tint-green text-rk-success",
  login_fail: "bg-rk-tint-red text-rk-sale",
  login_locked: "bg-rk-tint-red text-rk-sale",
  account_create: "bg-rk-tint-green text-rk-success",
  password_change: "bg-rk-tint-blue text-rk-info",
  password_reset: "bg-rk-tint-orange text-rk-orange-deep",
  account_unlock: "bg-rk-tint-blue text-rk-info",
  account_status_change: "bg-rk-tint-orange text-rk-orange-deep",
  session_logout: "bg-rk-soft text-rk-muted",
};

export default function AuditLogViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("30");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (actor.trim()) params.set("actor", actor.trim());
      if (target.trim()) params.set("target", target.trim());
      params.set("days", days);
      params.set("limit", "300");
      const res = await fetch("/api/admin/audit-log?" + params.toString(), { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 403 ? "본사 권한 필요" : "조회 실패");
        return;
      }
      const j = await res.json();
      setRows(j.rows);
      setCounts(j.counts ?? {});
    } catch {
      setError("네트워크 오류");
    } finally { setLoading(false); }
  }, [actionFilter, actor, target, days]);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      {/* 요약 카운트 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([a, c]) => (
            <button
              key={a}
              type="button"
              onClick={() => { setActionFilter(a); void load(); }}
              className={
                "text-[12px] px-2 py-1 rounded cursor-pointer border-0 " +
                (actionFilter === a ? "bg-rk-navy text-white" : (ACTION_TONE[a] ?? "bg-rk-soft text-rk-muted"))
              }
            >
              {ACTION_LABEL[a] ?? a} <b className="rk-num">{c}</b>
            </button>
          ))}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] bg-white"
        >
          <option value="all">전체 액션</option>
          {Object.keys(ACTION_LABEL).map(a => (
            <option key={a} value={a}>{ACTION_LABEL[a]}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="행위자 (이메일/id)"
          value={actor}
          onChange={e => setActor(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void load(); }}
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] w-[180px] focus:outline-none focus:border-rk-navy"
        />
        <input
          type="search"
          placeholder="대상 (이메일/id)"
          value={target}
          onChange={e => setTarget(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void load(); }}
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] w-[180px] focus:outline-none focus:border-rk-navy"
        />
        <select
          value={days}
          onChange={e => setDays(e.target.value)}
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] bg-white"
        >
          <option value="1">1일</option>
          <option value="7">7일</option>
          <option value="30">30일</option>
          <option value="90">90일</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="bg-rk-navy hover:bg-rk-navy-deep disabled:opacity-50 text-white border-0 px-3 py-1 rounded text-[14px] cursor-pointer"
        >
          {loading ? "조회 중…" : "조회"}
        </button>
        <span className="ml-auto text-[13px] text-rk-muted">{rows.length}건 표시</span>
      </div>

      {error && <div className="bg-rk-tint-red text-rk-sale text-[13px] px-3 py-2 rounded mb-2">⚠ {error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-rk-soft-2 text-rk-muted">
            <tr>
              <th className="text-left px-2 py-1.5 font-medium text-[12px] uppercase tracking-[.04em]">시각</th>
              <th className="text-left px-2 py-1.5 font-medium text-[12px] uppercase tracking-[.04em]">액션</th>
              <th className="text-left px-2 py-1.5 font-medium text-[12px] uppercase tracking-[.04em]">행위자</th>
              <th className="text-left px-2 py-1.5 font-medium text-[12px] uppercase tracking-[.04em]">대상</th>
              <th className="text-left px-2 py-1.5 font-medium text-[12px] uppercase tracking-[.04em]">IP</th>
              <th className="text-left px-2 py-1.5 font-medium text-[12px] uppercase tracking-[.04em]">User-Agent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <>
                <tr
                  key={r.id}
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  className="border-t border-rk-line-2 hover:bg-rk-soft-2 cursor-pointer"
                >
                  <td className="px-2 py-1.5 rk-num text-rk-muted text-[12px] whitespace-nowrap">
                    {r.createdAt.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={"text-[12px] px-1.5 py-px rounded font-medium " + (ACTION_TONE[r.action] ?? "bg-rk-soft text-rk-muted")}>
                      {ACTION_LABEL[r.action] ?? r.action}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-[12px] text-rk-text">{r.actorEmail ?? "—"}</td>
                  <td className="px-2 py-1.5 text-[12px] text-rk-text">{r.targetEmail ?? "—"}</td>
                  <td className="px-2 py-1.5 rk-num text-[12px] text-rk-muted">{r.ip ?? "—"}</td>
                  <td className="px-2 py-1.5 text-[12px] text-rk-muted max-w-[260px] truncate">{r.userAgent ?? "—"}</td>
                </tr>
                {expandedId === r.id && r.metadata && Object.keys(r.metadata).length > 0 && (
                  <tr key={r.id + "-meta"} className="bg-rk-soft-2">
                    <td colSpan={6} className="px-2 py-2 text-[12px] text-rk-text font-mono whitespace-pre-wrap">
                      {JSON.stringify(r.metadata, null, 2)}
                    </td>
                  </tr>
                )}
              </>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-rk-muted text-[14px]">
                  조건에 맞는 로그가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
