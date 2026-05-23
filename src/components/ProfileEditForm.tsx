"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initial: {
    name: string;
    email: string;
    phone: string | null;
    telegramChatId?: string | null;
  };
  role: "hq" | "partner_admin" | "seller";
};

export default function ProfileEditForm({ initial, role }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [telegramChatId, setTelegramChatId] = useState(initial.telegramChatId ?? "");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const sellerMode = role === "seller";
  const dirty =
    name.trim() !== initial.name.trim() ||
    email.trim().toLowerCase() !== initial.email.trim().toLowerCase() ||
    (sellerMode && phone.trim() !== (initial.phone ?? "").trim()) ||
    (sellerMode && telegramChatId.trim() !== (initial.telegramChatId ?? "").trim());

  const save = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const payload: { name?: string; email?: string; phone?: string; telegramChatId?: string } = {};
      if (name.trim() !== initial.name.trim()) payload.name = name.trim();
      if (email.trim().toLowerCase() !== initial.email.trim().toLowerCase()) payload.email = email.trim();
      if (sellerMode && phone.trim() !== (initial.phone ?? "").trim()) payload.phone = phone.trim();
      if (sellerMode && telegramChatId.trim() !== (initial.telegramChatId ?? "").trim()) {
        payload.telegramChatId = telegramChatId.trim();
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "저장 실패" }); return; }
      setFlash({
        tone: "ok",
        text: payload.email ? "저장됨. 이메일을 변경했으므로 다음 로그인 시 새 이메일을 사용해주세요." : "저장되었습니다.",
      });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setBusy(false); }
  };

  const reset = () => {
    setName(initial.name);
    setEmail(initial.email);
    setPhone(initial.phone ?? "");
    setTelegramChatId(initial.telegramChatId ?? "");
    setFlash(null);
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-rk-ink">기본 정보 변경</h3>
        <small className="text-[12px] text-rk-muted">이름·이메일{sellerMode ? "·전화" : ""} 본인이 직접 수정</small>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-[13px] items-center">
        <label htmlFor="profile-name" className="text-rk-muted">이름</label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={40}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />

        <label htmlFor="profile-email" className="text-rk-muted">로그인 이메일</label>
        <div className="flex flex-col gap-1">
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={busy}
            className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] font-mono focus:outline-none focus:border-rk-navy disabled:opacity-50"
          />
          <small className="text-[11px] text-rk-faint">변경 시 다음 로그인부터 새 이메일로 접속해야 합니다.</small>
        </div>

        {sellerMode && (
          <>
            <label htmlFor="profile-phone" className="text-rk-muted">전화</label>
            <div className="flex flex-col gap-1">
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010-1234-5678 (비우면 점 대표 번호 사용)"
                maxLength={24}
                disabled={busy}
                className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] font-mono focus:outline-none focus:border-rk-navy disabled:opacity-50"
              />
              <small className="text-[11px] text-rk-faint">내 영업 단독 링크 카톡 공유 문구 + 상담 전화에 노출됩니다.</small>
            </div>

            <label htmlFor="profile-tg" className="text-rk-muted">텔레그램 ID</label>
            <div className="flex flex-col gap-1">
              <input
                id="profile-tg"
                type="text"
                value={telegramChatId}
                onChange={e => setTelegramChatId(e.target.value)}
                placeholder="예: 123456789 (비우면 알림 미발송)"
                maxLength={20}
                disabled={busy}
                className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] font-mono focus:outline-none focus:border-rk-navy disabled:opacity-50"
              />
              <small className="text-[11px] text-rk-faint">
                내가 받은 lead 상담 인입 시 본인 텔레그램에 즉시 알림.
                {" "}@userinfobot 에게 /start 보내면 본인 chat_id 확인 가능.
              </small>
            </div>
          </>
        )}
      </div>

      {flash && (
        <div
          className={
            "mt-3 px-3 py-2 rounded text-[13px] " +
            (flash.tone === "ok"
              ? "bg-rk-tint-green text-rk-success"
              : "bg-rk-tint-red text-rk-sale")
          }
        >
          {flash.text}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={busy || pending || !dirty}
          className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-4 py-1.5 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy || !dirty}
          className="bg-white hover:bg-rk-soft-2 text-rk-ink border border-rk-line rounded px-3 py-1.5 text-[13px] cursor-pointer disabled:opacity-50"
        >
          되돌리기
        </button>
        {dirty && (
          <small className="text-[12px] text-rk-orange-deep ml-2">⚠ 저장하지 않은 변경사항</small>
        )}
      </div>
    </div>
  );
}
