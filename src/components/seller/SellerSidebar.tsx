"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type SidebarProps = {
  user?: { name?: string | null; email: string; role: string };
  partnerName: string;
  sellerName: string;
};

const NAV: Array<{ href: string; ico: string; label: string }> = [
  { href: "/admin/seller",             ico: "📊", label: "내 대시보드" },
  { href: "/admin/seller/leads",       ico: "💬", label: "내 lead" },
  { href: "/admin/seller/enrollments", ico: "📝", label: "내 신청서" },
  { href: "/admin/seller/links",       ico: "🔗", label: "공유 링크" },
  { href: "/admin/seller/footer",      ico: "📄", label: "내 푸터 정보" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin/seller") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SellerSidebar({ user, partnerName, sellerName }: SidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="bg-white border-r border-rk-line p-3.5 sticky top-0 h-screen overflow-y-auto flex flex-col gap-2">
      <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-3 border-b border-rk-line-2 mb-1.5">
        <div className="w-8 h-8 bg-rk-orange text-white rounded grid place-items-center font-bold text-[14px] tracking-[-.04em]">영</div>
        <div>
          <div className="font-semibold text-sm text-rk-ink leading-tight">{sellerName}</div>
          <small className="text-[12px] text-rk-muted block mt-0.5">{partnerName}</small>
        </div>
      </div>

      <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-2.5 text-[13px] leading-[1.55]">
        <b className="text-rk-ink font-semibold block">{user?.name ?? "로그인 필요"}</b>
        {user && <small className="block text-rk-muted text-[12px] break-all mt-0.5">{user.email}</small>}
        <div className="flex justify-between mt-1 text-rk-muted">
          <span>권한</span>
          <span className="text-rk-orange-deep font-medium">영업자</span>
        </div>
        {user && (
          <div className="mt-2 flex gap-1">
            <Link
              href="/admin/profile"
              className="flex-1 bg-rk-soft hover:bg-rk-line-2 text-rk-text border-0 py-1 rounded text-[13px] cursor-pointer transition-colors text-center no-underline"
            >
              내 계정
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex-1 bg-rk-soft hover:bg-rk-line-2 text-rk-text border-0 py-1 rounded text-[13px] cursor-pointer transition-colors"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>

      <h5 className="text-[12px] text-rk-faint tracking-[.12em] px-2 pt-1.5 mt-1.5 font-medium uppercase">개인 콘솔</h5>
      {NAV.map(item => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded text-[14px] cursor-pointer transition-colors no-underline " +
              (active ? "bg-rk-orange text-white font-medium" : "text-rk-text hover:bg-rk-soft hover:text-rk-ink")
            }
          >
            <span className="w-4">{item.ico}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
