import Link from "next/link";
import { auth } from "@/auth";
import SuperSidebar from "@/components/super/SuperSidebar";
import SuperTopbarSearch from "@/components/super/SuperTopbarSearch";
import HqNotificationBell from "@/components/super/HqNotificationBell";
import { getHqNotifications } from "@/lib/hqNotifications";

export default async function SuperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const notifications = await getHqNotifications();

  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen bg-rk-admin-bg">
      <SuperSidebar user={session?.user} />
      <main className="px-[22px] pt-[18px] pb-[60px] max-w-[1500px]">
        <div className="flex items-center gap-3.5 mb-3.5 flex-wrap">
          <Link href="/" className="text-[14px] text-rk-muted no-underline">← 허브</Link>
          <span className="text-[14px] text-rk-muted">본사 슈퍼관리자</span>
          <div className="ml-auto flex gap-2 items-center">
            <SuperTopbarSearch />
            <HqNotificationBell initial={notifications} />
            <button className="bg-rk-orange hover:bg-rk-orange-deep text-white px-3.5 py-1.5 rounded text-[14px] border-0 font-medium cursor-pointer transition-colors">
              ⚡ 일괄 배포
            </button>
            <div className="w-7 h-7 rounded-full bg-rk-navy text-white grid place-items-center text-[13px] font-semibold">
              {session?.user?.name?.[0] ?? "?"}
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
