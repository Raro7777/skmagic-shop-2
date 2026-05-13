"use client";

import { useState } from "react";

export default function ApplyInline() {
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setOk(null);
    if (!name.trim() || !store.trim() || !phone.trim()) {
      setErr("이름·상호명·휴대폰은 필수입니다.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantName: name, storeName: store, phone, region, email }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "접수 실패"); return; }
      setOk(j.message ?? "분양 신청이 접수됐습니다. 본사 검토 후 연락드립니다.");
      setName(""); setStore(""); setPhone(""); setRegion(""); setEmail("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-rk-line rounded-xl p-5">
      <h3 className="text-[18px] font-bold text-rk-ink mb-1 tracking-[-.02em]">📝 분양 신청</h3>
      <p className="text-[12px] text-rk-muted mb-3">본사 검토 후 1~2 영업일 내 연락드립니다.</p>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <Field label="이름" value={name} onChange={setName} placeholder="홍길동" required />
        <Field label="상호명" value={store} onChange={setStore} placeholder="○○센터" required />
        <Field label="휴대폰" value={phone} onChange={setPhone} placeholder="01012345678" required />
        <Field label="지역" value={region} onChange={setRegion} placeholder="강남구" />
      </div>
      <Field label="이메일 (선택)" value={email} onChange={setEmail} placeholder="you@example.com" />

      {err && <div className="mt-2 bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[11px]">⚠ {err}</div>}
      {ok && <div className="mt-2 bg-rk-tint-green text-rk-success px-3 py-1.5 rounded text-[11px]">✓ {ok}</div>}

      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full bg-rk-orange hover:bg-rk-orange-deep disabled:opacity-50 text-white border-0 px-4 py-2.5 rounded-md text-[13px] font-medium cursor-pointer transition-colors"
      >
        {busy ? "접수 중…" : "분양 신청 보내기"}
      </button>

      <small className="block text-[10px] text-rk-faint mt-2 text-center">
        제출 시 본사 콘솔의 승인 대기열로 즉시 접수됩니다.
      </small>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (s: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <small className="text-[10px] text-rk-muted block mb-0.5">{label}{required && <span className="text-rk-sale">*</span>}</small>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-rk-line rounded-md px-2.5 py-1.5 text-[12px] focus:outline-none focus:border-rk-navy"
      />
    </label>
  );
}
