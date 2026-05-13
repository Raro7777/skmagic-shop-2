import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/franchise/Sidebar";
import SuperSidebar from "@/components/super/SuperSidebar";

export default async function AdminSearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  const partnerCode = session?.user?.partnerId;
  const partner = partnerCode
    ? await prisma.partner.findUnique({ where: { partnerCode } })
    : null;

  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen bg-rk-admin-bg">
      {role === "hq" ? (
        <SuperSidebar user={session?.user} />
      ) : (
        <Sidebar user={session?.user} partnerName={partner?.partnerName} />
      )}
      <main className="px-[22px] pt-[18px] pb-[60px] max-w-[1500px]">
        <div className="flex items-center gap-3.5 mb-3.5">
          <Link href="/" className="text-[14px] text-rk-muted no-underline">← 허브</Link>
          <span className="text-[14px] text-rk-muted">
            {role === "hq" ? "본사 슈퍼관리자" : "협력점 운영"} · <b className="text-rk-ink">통합 검색</b>
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}
