"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DomainState = {
  domain: string | null;
  status: string | null;
  addedAt: string | null;
  verification: Array<{ type: string; domain: string; value: string; reason: string }> | null;
  vercelVerified: boolean;
  vercelMisconfigured: boolean;
  apexName: string | null;
};

export default function PartnerDomainAction({
  partnerCode,
  initialDomain,
  initialStatus,
}: {
  partnerCode: string;
  initialDomain: string | null;
  initialStatus: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DomainState | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const r = await fetch(`/api/partners/${partnerCode}/custom-domain`);
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "조회 실패"); return; }
      setState(j);
      setInput(j.domain ?? "");
    } catch {
      setError("네트워크 오류");
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]); // eslint-disable-line

  const submit = async () => {
    if (!input.trim()) { setError("도메인을 입력해주세요"); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/partners/${partnerCode}/custom-domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: input.trim() }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "등록 실패"); return; }
      await load();
      router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally { setBusy(false); }
  };

  const recheck = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/partners/${partnerCode}/custom-domain`, { method: "PUT" });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "재검증 실패"); return; }
      await load();
      router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm("도메인 연결을 해제하시겠습니까? Vercel 에서도 함께 제거됩니다.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/partners/${partnerCode}/custom-domain`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "해제 실패"); return; }
      setInput("");
      await load();
      router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally { setBusy(false); }
  };

  const statusBadge = (s: string | null) => {
    if (!s) return null;
    const map: Record<string, { label: string; cls: string }> = {
      verified: { label: "✓ 연결됨", cls: "bg-rk-tint-green text-rk-success" },
      pending: { label: "⏳ 대기", cls: "bg-rk-tint-orange text-rk-orange-deep" },
      misconfigured: { label: "⚠ DNS 미설정", cls: "bg-rk-tint-red text-rk-sale" },
      failed: { label: "✗ 실패", cls: "bg-rk-tint-red text-rk-sale" },
    };
    const m = map[s] ?? { label: s, cls: "bg-rk-soft text-rk-muted" };
    return <span className={`text-[12px] px-1.5 py-px rounded font-medium ${m.cls}`}>{m.label}</span>;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-white hover:bg-rk-soft-2 text-rk-ink border border-rk-line rounded px-2 py-0.5 text-[12px] cursor-pointer flex items-center gap-1"
      >
        🌐 도메인
        {initialDomain && statusBadge(initialStatus)}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8" onClick={() => !busy && setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl w-[560px] max-w-[95vw] shadow-2xl">
            <div className="px-5 py-3 border-b border-rk-line flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-rk-ink">🌐 협력점 도메인 — {partnerCode}</h3>
              <button type="button" onClick={() => !busy && setOpen(false)} className="text-rk-muted hover:text-rk-ink text-[20px] bg-transparent border-0 cursor-pointer leading-none">×</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-[12px] text-rk-muted mb-1">연결할 도메인</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="예: yourshop.co.kr"
                    className="flex-1 border border-rk-line rounded px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || !input.trim()}
                    className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50"
                  >
                    {state?.domain && state.domain !== input.trim() ? "변경 적용" : "등록"}
                  </button>
                </div>
                <small className="block text-[11px] text-rk-muted mt-1">
                  www. 없이 루트 도메인 또는 서브도메인 입력 (https 자동 부착, 대소문자 무관).
                </small>
              </div>

              {state?.domain && (
                <div className="bg-rk-soft-2 border border-rk-line rounded p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <b className="text-[13px] text-rk-ink">현재 등록</b>
                    <code className="text-[13px] text-rk-info font-mono">{state.domain}</code>
                    {statusBadge(state.status)}
                  </div>
                  {state.addedAt && (
                    <small className="block text-[11px] text-rk-muted">등록 시각: {new Date(state.addedAt).toLocaleString("ko-KR")}</small>
                  )}

                  {/* DNS 안내 */}
                  {state.verification && state.verification.length > 0 && (
                    <div className="mt-2 bg-white border border-rk-line rounded p-2">
                      <b className="block text-[12px] text-rk-ink mb-1">DNS 설정 안내</b>
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="text-rk-muted">
                            <th className="text-left font-medium pr-2">type</th>
                            <th className="text-left font-medium pr-2">host</th>
                            <th className="text-left font-medium">value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.verification.map((v, i) => (
                            <tr key={i} className="font-mono">
                              <td className="pr-2 text-rk-ink">{v.type}</td>
                              <td className="pr-2 text-rk-info">{v.domain}</td>
                              <td className="text-rk-ink break-all">{v.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {state.status === "pending" && (
                    <div className="bg-rk-tint-blue text-rk-info px-2 py-1.5 rounded text-[12px] leading-[1.5]">
                      ⓘ 도메인 등록업체에서 위 DNS 레코드 설정 → 전파 후 (5분 ~ 24시간) <b>재검증</b> 클릭. SSL 은 검증 완료 시 Vercel 자동 발급.
                    </div>
                  )}
                  {state.status === "misconfigured" && (
                    <div className="bg-rk-tint-orange text-rk-orange-deep px-2 py-1.5 rounded text-[12px] leading-[1.5]">
                      ⚠ DNS 설정이 올바르지 않습니다. 위 안내된 레코드 다시 확인 후 재검증해주세요.
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={recheck}
                      disabled={busy}
                      className="bg-white hover:bg-rk-soft text-rk-ink border border-rk-line rounded px-2.5 py-1 text-[12px] cursor-pointer disabled:opacity-50"
                    >
                      🔄 재검증
                    </button>
                    {state.vercelVerified && (
                      <a
                        href={`https://${state.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white hover:bg-rk-soft text-rk-info border border-rk-line rounded px-2.5 py-1 text-[12px] no-underline"
                      >
                        열기 →
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={remove}
                      disabled={busy}
                      className="ml-auto bg-rk-tint-red hover:bg-rk-sale hover:text-white text-rk-sale border-0 rounded px-2.5 py-1 text-[12px] cursor-pointer disabled:opacity-50"
                    >
                      🗑 연결 해제
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[12px]">⚠ {error}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
