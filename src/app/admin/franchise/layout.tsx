import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePartner } from "@/lib/effectivePartner";
import Sidebar from "@/components/franchise/Sidebar";
import Topbar from "@/components/franchise/Topbar";
import LeaveHqImpersonation from "@/components/franchise/LeaveHqImpersonation";

export default async function FranchiseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const eff = await getEffectivePartner();
  const partner = eff?.partnerId
    ? await prisma.partner.findUnique({ where: { partnerCode: eff.partnerId } })
    : null;

  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen bg-rk-admin-bg">
      <Sidebar
        user={session?.user}
        partnerName={partner?.partnerName}
      />
      <main className="px-[22px] pt-[18px] pb-[60px] max-w-[1400px]">
        {/* 본사 임시 진입 배지 */}
        {eff?.isHqImpersonating && (
          <div className="mb-3 bg-rk-tint-orange text-rk-orange-deep px-3 py-2 rounded-md text-[13px] flex items-center gap-2">
            <span className="bg-rk-orange text-white text-[11.5px] font-semibold px-1.5 py-0.5 rounded">본사 임시 진입</span>
            <span>현재 <b>{partner?.partnerName ?? eff.partnerId}</b> 콘솔을 보고 있습니다.</span>
            <LeaveHqImpersonation />
          </div>
        )}
        <Topbar />
        {children}
      </main>
    </div>
  );
}
