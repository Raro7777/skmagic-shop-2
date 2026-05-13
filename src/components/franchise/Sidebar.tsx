"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type NavItem = { href: string; ico: string; label: string; badge?: number };

type SidebarProps = {
  user?: { name?: string | null; email: string; role: string };
  partnerName?: string;
};

const NAV_OPS: NavItem[] = [
  { href: "/admin/franchise",             ico: "📊", label: "대시보드" },
  { href: "/admin/franchise/leads",       ico: "💬", label: "상담 / 문의" },
  { href: "/admin/franchise/enrollments", ico: "📝", label: "가입 신청서" },
  { href: "/admin/franchise/sellers",     ico: "👥", label: "영업자 · 링크" },
  { href: "/admin/franchise/products",    ico: "🛒", label: "상품 진열 · 정책" },
  { href: "/admin/franchise/settlements", ico: "💳", label: "정산" },
  { href: "/admin/franchise/analytics",   ico: "📈", label: "마케팅 분석" },
];
const NAV_SITE: NavItem[] = [
  { href: "/admin/franchise/settings", ico: "⚙️", label: "사이트 설정" },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={
        "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded text-[14px] font-normal cursor-pointer transition-colors no-underline " +
        (active
          ? "bg-rk-orange text-white font-medium"
          : "text-white/[.78] hover:bg-white/[.06] hover:text-white")
      }
    >
      <span className="w-4">{item.ico}</span>
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <span
          className={
            "ml-auto text-[12px] px-1.5 py-px rounded-full font-semibold " +
            (active ? "bg-black/30 text-white" : "bg-rk-orange text-white")
          }
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/admin/franchise") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({ user, partnerName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="bg-rk-navy text-white/[.85] p-3.5 sticky top-0 h-screen overflow-y-auto flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 p-1.5">
        <div className="w-[30px] h-[30px] bg-rk-orange text-white rounded grid place-items-center font-bold text-[13px]">SK</div>
        <div>
          <div className="font-semibold text-sm text-white leading-tight">{partnerName ?? "협력점 콘솔"}</div>
          <small className="text-[12px] text-white/50 block mt-0.5">협력점 운영 관리자</small>
        </div>
      </div>

      <div className="bg-white/[.06] rounded p-2.5 text-[13px] leading-relaxed">
        <b className="text-white font-semibold block">{user?.name ?? "로그인 필요"}</b>
        {user && <div className="text-white/40 text-[12px] mt-0.5 break-all">{user.email}</div>}
        <div className="flex justify-between mt-1 text-white/60">
          <span>권한</span>
          <span className="text-white">{user?.role === "hq" ? "본사" : user?.role === "partner_admin" ? "협력점" : "—"}</span>
        </div>
        <div className="flex justify-between mt-1 text-white/60">
          <span>로그인</span>
          <span className="text-[#6FE4A8]">● 정상</span>
        </div>
        {user && (
          <div className="mt-2 flex gap-1">
            <Link
              href="/admin/profile"
              className="flex-1 bg-white/10 hover:bg-white/20 text-white/85 border-0 py-1 rounded text-[13px] cursor-pointer transition-colors text-center no-underline"
            >
              내 계정
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white/85 border-0 py-1 rounded text-[13px] cursor-pointer transition-colors"
            >
              로그아웃
            </button>
          </div>
        )}
      </div>

      <h5 className="text-[12px] text-white/40 tracking-[.12em] px-2 mt-1.5 font-medium uppercase">운영</h5>
      {NAV_OPS.map(item => <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />)}

      <h5 className="text-[12px] text-white/40 tracking-[.12em] px-2 mt-1.5 font-medium uppercase">사이트</h5>
      {NAV_SITE.map(item => <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />)}

      <div className="mt-auto p-2.5 bg-white/[.05] rounded text-[13px]">
        <b className="text-white font-medium block">📈 빠른 링크</b>
        <Link href="/admin/super" className="block text-white/70 hover:text-white text-[13px] mt-1.5 no-underline">
          → 본사 슈퍼관리자 (HQ만)
        </Link>
        <Link href="/" className="block text-white/70 hover:text-white text-[13px] mt-1 no-underline">
          → 허브로
        </Link>
      </div>
    </aside>
  );
}
