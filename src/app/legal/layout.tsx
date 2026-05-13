import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-rk-soft-2 min-h-screen">
      <div className="max-w-[760px] mx-auto px-4 sm:px-8 py-8 md:py-12">
        <header className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-[12px] text-rk-info no-underline">← 허브로</Link>
          <span className="text-[12px] text-rk-muted">·</span>
          <Link href="/legal/terms" className="text-[12px] text-rk-muted no-underline">이용약관</Link>
          <Link href="/legal/privacy" className="text-[12px] text-rk-muted no-underline">개인정보처리방침</Link>
        </header>
        <article className="bg-white border border-rk-line rounded-lg p-6 md:p-10 leading-[1.75]">
          {children}
        </article>
        <div className="text-[11px] text-rk-faint text-center mt-6">
          © 렌트왕 협력점 분양 플랫폼 · 시행일자 2026.05.01
        </div>
      </div>
    </div>
  );
}
