"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

export default function LoginForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl?: string;
  initialError?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ? "이메일 또는 비밀번호가 올바르지 않습니다." : null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      // router.push 는 방금 set 된 세션 쿠키를 다음 RSC fetch 에 못 전달할 수 있어 /login 으로 되돌아오는 이슈가 있음.
      // 풀-페이지 네비게이션(window.location)으로 강제해서 쿠키가 적용된 새 HTTP 요청을 보내게 함.
      window.location.href = callbackUrl ?? "/admin";
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label className="block text-[11px] text-rk-muted mb-1">이메일</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoFocus
          autoComplete="email"
          className="w-full px-3 py-2 border border-rk-line rounded text-[13px] outline-none focus:border-rk-navy"
        />
      </div>

      <div>
        <label className="block text-[11px] text-rk-muted mb-1">비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full px-3 py-2 border border-rk-line rounded text-[13px] outline-none focus:border-rk-navy"
        />
      </div>

      {error && (
        <div className="bg-rk-tint-red text-rk-sale text-[12px] px-3 py-2 rounded">⚠ {error}</div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-rk-navy hover:bg-rk-navy-deep disabled:bg-rk-muted text-white border-0 py-2.5 rounded text-[13px] font-semibold cursor-pointer transition-colors"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
