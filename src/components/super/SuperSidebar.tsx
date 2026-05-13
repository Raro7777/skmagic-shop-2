"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type NavItem = { href: string; ico: string; label: string; badge?: number };
type SidebarProps = {
  user?: { name?: string | null; email: string; role: string };
};

const NAV_OPS: NavItem[] = [
  { href: "/admin/super",            ico: "📊", label: "전체 대시보드" },
  { href: "/admin/super/enrollments", ico: "📋", label: "전체 신청서" },
  { href: "/admin/super/verify",     ico: "🔍", label: "인증 처리" },
  { href: "/admin/super/installs",   ico: "📦", label: "설치 완료 처리" },
  { href: "/admin/super/partners",   ico: "🏪", label: "협력점 관리" },
  { href: "/admin/super/users",      ico: "👤", label: "사용자 관리" },
  { href: "/admin/super/audit-log",  ico: "🛡", label: "감사 로그" },
  { href: "/admin/super/approvals",  ico: "✅", label: "승인 대기열" },
  { href: "/admin/super/duplicates", ico: "🔁", label: "중복 DB 판정" },
  { href: "/admin/super/anomalies",  ico: "🚨", label: "운영 이상감지" },
  { href: "/admin/super/analytics",  ico: "📈", label: "마케팅 분석" },
];
const NAV_MASTER: NavItem[] = [
  { href: "/admin/super/products",          ico: "📦", label: "상품 마스터" },
  { href: "/admin/super/policies",          ico: "💰", label: "기준 정책" },
  { href: "/admin/super/banner-templates",  ico: "🎨", label: "배너 템플릿" },
  { href: "/admin/super/broadcasts",        ico: "📢", label: "본사 공지" },
  { href: "/admin/super/crawl",             ico: "🔄", label: "상품 크롤링" },
  { href: "/admin/super/api-partners",      ico: "🔌", label: "외부 API 채널" },
];
const NAV_FINANCE: NavItem[] = [
  { href: "/admin/super/settlements", ico: "💳", label: "정산 / 수수료" },
  { href: "/admin/super/refunds",     ico: "🔄", label: "환수 관리" },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin/super") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={
        "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded text-[14px] cursor-pointer transition-colors no-underline " +
        (active
          ? "bg-rk-navy text-white font-medium"
          : "text-rk-text hover:bg-rk-soft hover:text-rk-ink")
      }
    >
      <span className="w-4">{item.ico}</span>
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <span
          className={
            "ml-auto text-[12px] px-1.5 py-px rounded-full font-semibold " +
            (active ? "bg-rk-orange text-white" : "bg-rk-tint-orange text-rk-orange-deep")
          }
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export default function SuperSidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="bg-white border-r border-rk-line p-3.5 sticky top-0 h-screen overflow-y-auto flex flex-col gap-2">
      <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-3 border-b border-rk-line-2 mb-1.5">
        <div className="w-8 h-8 bg-rk-navy text-white rounded grid place-items-center font-bold text-[14px] tracking-[-.04em]">렌</div>
        <div>
          <div className="font-semibold text-sm text-rk-ink leading-tight">렌트왕 본사</div>
          <small className="text-[12px] text-rk-muted block mt-0.5 tracking-[.04em] uppercase">Super Admin</small>
        </div>
      </div>

      <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-2.5 text-[13px] leading-[1.55]">
        <b className="text-rk-ink font-semibold block">{user?.name ?? "로그인 필요"}</b>
        {user && <small className="block text-rk-muted text-[12px] break-all mt-0.5">{user.email}</small>}
        <div className="flex justify-between mt-1 text-rk-muted">
          <span>권한</span>
          <span className="text-rk-orange-deep font-medium">{user?.role === "hq" ? "Super Admin" : "—"}</span>
        </div>
        <div className="flex justify-between mt-1 text-rk-muted">
          <span>로그인</span>
          <span className="text-rk-success">● 정상</span>
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

      <h5 className="text-[12px] text-rk-faint tracking-[.12em] px-2 pt-1.5 mt-1.5 font-medium uppercase">운영 현황</h5>
      {NAV_OPS.map(i => <NavLink key={i.href} item={i} active={isActive(pathname, i.href)} />)}

      <h5 className="text-[12px] text-rk-faint tracking-[.12em] px-2 pt-1.5 mt-1.5 font-medium uppercase">마스터 데이터</h5>
      {NAV_MASTER.map(i => <NavLink key={i.href} item={i} active={isActive(pathname, i.href)} />)}

      <h5 className="text-[12px] text-rk-faint tracking-[.12em] px-2 pt-1.5 mt-1.5 font-medium uppercase">정산 · 재무</h5>
      {NAV_FINANCE.map(i => <NavLink key={i.href} item={i} active={isActive(pathname, i.href)} />)}

      <div className="mt-auto p-2.5 bg-rk-soft-2 border border-rk-line-2 rounded text-[13px]">
        <b className="text-rk-ink font-medium block">📈 빠른 링크</b>
        <Link href="/admin/franchise" className="block text-rk-info text-[13px] mt-1.5 no-underline">
          → 협력점 콘솔
        </Link>
        <Link href="/" className="block text-rk-info text-[13px] mt-1 no-underline">
          → 허브로
        </Link>
      </div>
    </aside>
  );
}
