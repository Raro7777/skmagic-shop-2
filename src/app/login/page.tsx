import LoginForm from "./LoginForm";

export const metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-rk-soft-2 px-4">
      <div className="w-full max-w-[400px] bg-white border border-rk-line rounded-lg p-8 shadow-[0_2px_8px_rgba(20,25,40,.06)]">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 bg-rk-orange text-white rounded grid place-items-center font-bold text-base">SK</div>
          <div>
            <div className="font-bold text-[16px] text-rk-ink">SK매직 인증파트너점</div>
            <div className="text-[11px] text-rk-muted">관리자 로그인</div>
          </div>
        </div>

        <LoginForm callbackUrl={sp.callbackUrl} initialError={sp.error} />
      </div>
    </div>
  );
}
