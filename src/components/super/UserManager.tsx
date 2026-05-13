"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type User = {
  id: string;
  email: string;
  name: string | null;
  role: "hq" | "partner_admin" | "seller";
  partnerId: string | null;
  partnerName: string | null;
  sellerCode: string | null;
  status: "active" | "disabled" | string;
  failedLoginAttempts: number;
  isLocked: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
};

const ROLE_LABEL: Record<string, string> = { hq: "본사", partner_admin: "협력점", seller: "영업자" };
const ROLE_PILL: Record<string, string> = {
  hq: "bg-rk-tint-orange text-rk-orange-deep",
  partner_admin: "bg-rk-tint-blue text-rk-info",
  seller: "bg-rk-tint-green text-rk-success",
};

type Partner = { partnerCode: string; partnerName: string };

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [tempReveal, setTempReveal] = useState<{ email: string; pw: string; isNew?: boolean; mailDelivered?: boolean } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{ email: string; name: string; role: "hq" | "partner_admin" | "seller"; partnerId: string }>({
    email: "", name: "", role: "partner_admin", partnerId: "",
  });
  const [creating, setCreating] = useState(false);
  const [_pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (roleFilter !== "all") params.set("role", roleFilter);
      const res = await fetch("/api/admin/users?" + params.toString(), { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setError("본사 권한 필요");
        else throw new Error();
        return;
      }
      const j = await res.json();
      setUsers(j.users);
      setError(null);
    } catch {
      setError("사용자 목록 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter]);

  useEffect(() => { load(); }, [load]);

  // 협력점 목록 (신규 사용자 모달용)
  useEffect(() => {
    void fetch("/api/partners?active=1").then(async r => {
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j?.partners)) setPartners(j.partners);
    }).catch(() => {});
  }, []);

  const createUser = async () => {
    setFlash(null);
    if (!createForm.email || !createForm.role) {
      setFlash({ tone: "err", text: "이메일·권한은 필수입니다." });
      return;
    }
    if ((createForm.role === "partner_admin" || createForm.role === "seller") && !createForm.partnerId) {
      setFlash({ tone: "err", text: "협력점/영업자는 소속 협력점을 선택해야 합니다." });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createForm.email.trim(),
          name: createForm.name.trim(),
          role: createForm.role,
          partnerId: createForm.role === "hq" ? null : createForm.partnerId,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setFlash({ tone: "err", text: j.error ?? "발급 실패" });
        return;
      }
      setCreateOpen(false);
      setCreateForm({ email: "", name: "", role: "partner_admin", partnerId: "" });
      if (j.tempPassword) {
        setTempReveal({
          email: j.user?.email ?? createForm.email,
          pw: j.tempPassword,
          isNew: true,
          mailDelivered: !!j.mailDelivered,
        });
      }
      startTransition(() => load());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setCreating(false); }
  };

  const counts = useMemo(() => {
    const c = { all: users.length, hq: 0, partner_admin: 0, seller: 0, locked: 0, disabled: 0 };
    for (const u of users) {
      if (u.role === "hq") c.hq++;
      if (u.role === "partner_admin") c.partner_admin++;
      if (u.role === "seller") c.seller++;
      if (u.isLocked) c.locked++;
      if (u.status === "disabled") c.disabled++;
    }
    return c;
  }, [users]);

  const action = async (u: User, payload: Record<string, unknown>, label: string) => {
    setFlash(null);
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setFlash({ tone: "err", text: j.error ?? `${label} 실패` });
        return;
      }
      // resetPassword는 임시 비번 1회 노출 모달
      if (j.tempPassword) {
        setTempReveal({ email: u.email, pw: j.tempPassword, mailDelivered: !!j.mailDelivered });
      } else {
        setFlash({ tone: "ok", text: j.message ?? `${label} 완료` });
      }
      startTransition(() => load());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="bg-white border border-rk-line rounded-lg p-4 text-center text-[14px] text-rk-muted py-6">사용자 목록 로딩 중…</div>;
  }
  if (error) {
    return <div className="bg-white border border-rk-line rounded-lg p-4"><div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded">⚠ {error}</div></div>;
  }

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      {/* 임시 비번 모달 */}
      {tempReveal && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50" onClick={() => setTempReveal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg p-5 max-w-[440px] w-full mx-4 shadow-xl">
            <h3 className="text-[15px] font-semibold text-rk-ink mb-2">
              🔑 {tempReveal.isNew ? "신규 계정 발급" : "임시 비밀번호 재설정"}
            </h3>
            <p className="text-[14px] text-rk-muted mb-3">
              <b>{tempReveal.email}</b>의 임시 비밀번호입니다.
              {tempReveal.mailDelivered === true && (
                <span className="block mt-1 text-rk-success text-[12.5px]">📧 사용자 이메일로 자동 발송 완료</span>
              )}
              {tempReveal.mailDelivered === false && (
                <span className="block mt-1 text-rk-orange-deep text-[12.5px]">⚠ 이메일 발송 실패 — 본사가 직접 전달해주세요</span>
              )}
              사용자에게 즉시 전달하시고 첫 로그인 후 본인이 변경하도록 안내해주세요.
            </p>
            <div className="bg-rk-soft-2 border border-rk-line rounded p-3 font-mono text-center text-[16px] tracking-wide text-rk-ink">
              {tempReveal.pw}
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(tempReveal.pw)}
                className="bg-rk-soft hover:bg-rk-line text-rk-text px-3 py-1.5 rounded text-[14px] cursor-pointer border-0"
              >
                복사
              </button>
              <button
                type="button"
                onClick={() => setTempReveal(null)}
                className="bg-rk-navy hover:bg-rk-navy-deep text-white px-3 py-1.5 rounded text-[14px] cursor-pointer border-0"
              >
                닫기
              </button>
            </div>
            <small className="block text-[12px] text-rk-sale mt-2">
              ⚠ 이 창을 닫으면 임시 비밀번호를 다시 조회할 수 없습니다.
            </small>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">👥 사용자 관리</h3>
        <span className="text-[13px] text-rk-muted">총 {counts.all}명 · 잠금 {counts.locked} · 비활성 {counts.disabled}</span>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="ml-auto bg-rk-success hover:opacity-90 text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer"
        >
          ＋ 신규 사용자 발급
        </button>
      </div>

      {/* 신규 사용자 모달 */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50" onClick={() => !creating && setCreateOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-lg p-5 max-w-[480px] w-full mx-4 shadow-xl">
            <h3 className="text-[15px] font-semibold text-rk-ink mb-3">＋ 신규 사용자 발급</h3>
            <div className="space-y-2.5">
              <label className="block">
                <span className="text-[12px] text-rk-muted">이메일 *</span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                  disabled={creating}
                  className="w-full border border-rk-line rounded px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy"
                />
              </label>
              <label className="block">
                <span className="text-[12px] text-rk-muted">이름</span>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="홍길동"
                  disabled={creating}
                  className="w-full border border-rk-line rounded px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy"
                />
              </label>
              <label className="block">
                <span className="text-[12px] text-rk-muted">권한 *</span>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value as "hq" | "partner_admin" | "seller" }))}
                  disabled={creating}
                  className="w-full border border-rk-line rounded px-2.5 py-1.5 text-[14px] bg-white focus:outline-none focus:border-rk-navy"
                >
                  <option value="hq">본사 관리자</option>
                  <option value="partner_admin">협력점 관리자</option>
                  <option value="seller">영업자</option>
                </select>
              </label>
              {createForm.role !== "hq" && (
                <label className="block">
                  <span className="text-[12px] text-rk-muted">소속 협력점 *</span>
                  <select
                    value={createForm.partnerId}
                    onChange={e => setCreateForm(f => ({ ...f, partnerId: e.target.value }))}
                    disabled={creating}
                    className="w-full border border-rk-line rounded px-2.5 py-1.5 text-[14px] bg-white focus:outline-none focus:border-rk-navy"
                  >
                    <option value="">— 선택 —</option>
                    {partners.map(p => (
                      <option key={p.partnerCode} value={p.partnerCode}>{p.partnerName} ({p.partnerCode})</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="bg-rk-tint-blue text-rk-info px-2.5 py-2 rounded text-[11.5px] mt-3 leading-[1.5]">
              ⓘ 임시 비밀번호가 자동 생성되어 사용자 이메일로 발송됩니다. 본사 콘솔에도 1회 노출됩니다.
            </div>
            <div className="flex gap-2 mt-3 justify-end">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                className="bg-rk-soft hover:bg-rk-line text-rk-text px-3 py-1.5 rounded text-[13px] cursor-pointer border-0 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={createUser}
                disabled={creating}
                className="bg-rk-success hover:opacity-90 disabled:opacity-50 text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer"
              >
                {creating ? "발급 중…" : "발급"}
              </button>
            </div>
          </div>
        </div>
      )}

      {flash && (
        <div className={"px-3 py-2 rounded text-[13px] mb-2 " + (flash.tone === "ok" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
          {flash.tone === "ok" ? "✓ " : "⚠ "}{flash.text}
        </div>
      )}

      {/* 검색 + 필터 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="search"
          placeholder="이메일/이름 검색"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] w-[200px] focus:outline-none focus:border-rk-navy"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] bg-white"
        >
          <option value="all">전체 권한 ({counts.all})</option>
          <option value="hq">본사 ({counts.hq})</option>
          <option value="partner_admin">협력점 ({counts.partner_admin})</option>
          <option value="seller">영업자 ({counts.seller})</option>
        </select>
      </div>

      {/* 사용자 표 */}
      <table className="w-full text-[14px]">
        <thead className="bg-rk-soft-2 text-rk-muted">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">이메일 / 이름</th>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">권한</th>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">소속</th>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">상태</th>
            <th className="text-left px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">최근 로그인</th>
            <th className="text-right px-3 py-2 font-medium text-[13px] uppercase tracking-[.04em]">작업</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className="border-t border-rk-line-2">
              <td className="px-3 py-2">
                <b className="text-rk-ink text-[14px] block">{u.name ?? "—"}</b>
                <small className="text-rk-muted font-mono text-[12px]">{u.email}</small>
              </td>
              <td className="px-3 py-2">
                <span className={"text-[12px] px-1.5 py-px rounded font-medium " + ROLE_PILL[u.role]}>
                  {ROLE_LABEL[u.role] ?? u.role}
                </span>
              </td>
              <td className="px-3 py-2 text-[13px] text-rk-text">
                {u.partnerName ?? "—"}
                {u.sellerCode && <small className="block text-rk-faint font-mono text-[12px]">{u.sellerCode}</small>}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col gap-0.5">
                  {u.status === "active" ? (
                    <span className="text-[12px] px-1.5 py-px rounded font-medium bg-rk-tint-green text-rk-success w-fit">active</span>
                  ) : (
                    <span className="text-[12px] px-1.5 py-px rounded font-medium bg-rk-tint-red text-rk-sale w-fit">{u.status}</span>
                  )}
                  {u.isLocked && (
                    <span className="text-[12px] text-rk-sale">🔒 잠금</span>
                  )}
                  {u.failedLoginAttempts > 0 && !u.isLocked && (
                    <span className="text-[12px] text-rk-warn">실패 {u.failedLoginAttempts}회</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-[12px] text-rk-muted rk-num">
                {u.lastLoginAt ? u.lastLoginAt.replace("T", " ").slice(0, 16) : "—"}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex gap-1 justify-end flex-wrap">
                  {(u.isLocked || u.failedLoginAttempts > 0) && (
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => action(u, { action: "unlock" }, "잠금 해제")}
                      className="bg-rk-warn hover:opacity-90 disabled:opacity-50 text-white px-2 py-1 rounded text-[13px] cursor-pointer border-0"
                    >
                      🔓 잠금해제
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => {
                      if (!window.confirm(`${u.email}의 비밀번호를 임시 비밀번호로 리셋합니다. 계속하시겠습니까?`)) return;
                      action(u, { action: "resetPassword" }, "비번 리셋");
                    }}
                    className="bg-rk-navy hover:bg-rk-navy-deep disabled:opacity-50 text-white px-2 py-1 rounded text-[13px] cursor-pointer border-0"
                  >
                    🔑 비번 리셋
                  </button>
                  {u.status === "active" ? (
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => {
                        if (!window.confirm(`${u.email}을 비활성화합니다. 계속하시겠습니까?`)) return;
                        action(u, { action: "setStatus", status: "disabled" }, "비활성화");
                      }}
                      className="bg-white border border-rk-sale hover:bg-rk-tint-red text-rk-sale px-2 py-1 rounded text-[13px] cursor-pointer disabled:opacity-50"
                    >
                      비활성화
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => action(u, { action: "setStatus", status: "active" }, "활성화")}
                      className="bg-white border border-rk-success hover:bg-rk-tint-green text-rk-success px-2 py-1 rounded text-[13px] cursor-pointer disabled:opacity-50"
                    >
                      활성화
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-rk-muted text-[14px]">
                일치하는 사용자가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
