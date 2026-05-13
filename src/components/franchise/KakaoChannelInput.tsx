"use client";

import { useState } from "react";

export default function KakaoChannelInput({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const save = async () => {
    setFlash(null);
    setSaving(true);
    try {
      const res = await fetch("/api/franchise/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kakaoChannelUrl: value.trim() || null }),
      });
      const j = await res.json();
      if (!res.ok) {
        setFlash({ tone: "err", text: j.error ?? "저장 실패" });
        return;
      }
      setFlash({ tone: "ok", text: "저장 완료 — 우리 사이트의 💬 카톡 버튼이 이 URL로 연결됩니다." });
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
      <h3 className="text-[14px] font-semibold text-rk-ink mb-1.5">💬 카카오톡 채널 연결</h3>
      <p className="text-[13px] text-rk-muted mb-3 leading-[1.5]">
        우리 사이트의 카톡 CTA 버튼이 이 URL로 1탭 이동합니다. 카카오톡 채널(@옐로 채널)의 공유 URL을 붙여넣으세요.
        <br />
        예: <code className="font-mono text-rk-info">https://pf.kakao.com/_xxxxxxx</code>
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://pf.kakao.com/_..."
          value={value}
          onChange={e => setValue(e.target.value)}
          className="flex-1 border border-rk-line rounded px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy"
        />
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="bg-rk-navy hover:bg-rk-navy-deep disabled:opacity-50 text-white border-0 px-3.5 py-1.5 rounded text-[14px] font-medium cursor-pointer"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
      {flash && (
        <div className={"mt-2 text-[13px] " + (flash.tone === "ok" ? "text-rk-success" : "text-rk-sale")}>
          {flash.tone === "ok" ? "✓ " : "⚠ "}{flash.text}
        </div>
      )}
      <div className="mt-3 bg-rk-tint-blue text-rk-info px-2.5 py-2 rounded text-[12px] leading-[1.5]">
        💡 <b>채널 만들기</b>: 카카오톡 채널 관리자센터(<a href="https://center-pf.kakao.com" target="_blank" rel="noopener" className="underline">center-pf.kakao.com</a>) → "내 채널 만들기" → 비즈니스 채널 인증 후 채널 URL 받기.
        실제 자동 응답·webhook 연동은 다음 단계에 추가됩니다.
      </div>
    </div>
  );
}
