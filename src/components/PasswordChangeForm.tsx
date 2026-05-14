"use client";

import { useState } from "react";
import { PASSWORD_POLICY_TEXT } from "@/lib/passwordPolicy";

export default function PasswordChangeForm({ forceChange = false }: { forceChange?: boolean }) {
  const [current, setCurrent] = useState("");
  const [next1, setNext1] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string; details?: string[] } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlash(null);
    if (!current || !next1) {
      setFlash({ tone: "err", text: "현재 비밀번호와 새 비밀번호를 입력해주세요." });
      return;
    }
    if (next1 !== next2) {
      setFlash({ tone: "err", text: "새 비밀번호 확인이 일치하지 않습니다." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next1 }),
      });
      const j = await res.json();
      if (!res.ok) {
        setFlash({ tone: "err", text: j.error ?? "변경 실패", details: Array.isArray(j.issues) ? j.issues : undefined });
        return;
      }
      setFlash({
        tone: "ok",
        text: forceChange
          ? "비밀번호가 변경되었습니다. 보안을 위해 다시 로그인해주세요."
          : (j.message ?? "비밀번호가 변경되었습니다."),
      });
      setCurrent(""); setNext1(""); setNext2("");
      // 강제 변경 모드면 → 로그아웃 + 로그인 페이지로 (새 JWT 발급 보장)
      if (forceChange) {
        setTimeout(() => {
          void fetch("/api/auth/signout", { method: "POST" }).finally(() => {
            window.location.href = "/login";
          });
        }, 1200);
      }
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-rk-line rounded-lg p-5 mb-3">
      <h3 className="text-[14px] font-semibold text-rk-ink mb-1.5">
        🔐 비밀번호 {forceChange ? "변경 (필수)" : "변경"}
      </h3>
      <div className="mb-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[12px] leading-[1.6]">
        <b className="block mb-1">비밀번호 정책</b>
        <ul className="list-disc pl-5 m-0">
          {PASSWORD_POLICY_TEXT.map(t => <li key={t}>{t}</li>)}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <Field label="현재 비밀번호">
          <input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className="border border-rk-line rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-rk-navy" />
        </Field>
        <Field label="새 비밀번호">
          <input type="password" autoComplete="new-password" value={next1} onChange={e => setNext1(e.target.value)} className="border border-rk-line rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-rk-navy" />
        </Field>
        <Field label="새 비밀번호 확인">
          <input type="password" autoComplete="new-password" value={next2} onChange={e => setNext2(e.target.value)} className="border border-rk-line rounded px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-rk-navy" />
        </Field>
      </div>
      {flash && (
        <div className={"mt-3 px-3 py-2 rounded text-[11px] " + (flash.tone === "ok" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
          {flash.tone === "ok" ? "✓ " : "⚠ "}{flash.text}
          {flash.details && flash.details.length > 1 && (
            <ul className="mt-1 list-disc pl-5">
              {flash.details.map(d => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 bg-rk-navy hover:bg-rk-navy-deep disabled:opacity-50 text-white border-0 px-4 py-1.5 rounded text-[12px] font-medium cursor-pointer"
      >
        {busy ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-rk-muted">{label}</span>
      {children}
    </label>
  );
}
