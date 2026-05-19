import Link from "next/link";
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

  // hq 가 cookie 없이 진입한 경우 — 어느 협력점 콘솔로 들어갈지 선택 안내.
  // 자동으로 첫 active partner (우성종합통신 등) 선택하면 데이터를 잘못 볼 위험.
  if (!eff && session?.user?.role === "hq") {
    return (
      <div className="grid grid-cols-[220px_1fr] min-h-screen bg-rk-admin-bg">
        <Sidebar user={session.user} partnerName={undefined} />
        <main className="px-[22px] pt-[18px] pb-[60px] max-w-[1400px]">
          <div className="bg-white border border-rk-line rounded-lg p-8 max-w-[640px] mt-8 mx-auto text-center">
            <div className="text-[40px] mb-3">🏪</div>
            <h2 className="text-[18px] font-bold text-rk-ink mb-2">어느 협력점 콘솔에 들어가시겠어요?</h2>
            <p className="text-[13px] text-rk-muted leading-[1.6] mb-5">
              본사 관리자는 협력점별 데이터를 별도로 봅니다. 본인이 어떤 협력점 시야로 작업할지
              <br /> <Link href="/admin/super/partners" className="text-rk-info underline">협력점 관리</Link> 페이지에서 명시적으로 선택해 주세요.
            </p>
            <div className="flex gap-2 justify-center">
              <Link
                href="/admin/super/partners"
                className="bg-rk-orange hover:bg-rk-orange-deep text-white px-4 py-2 rounded text-[14px] font-medium no-underline"
              >
                🏪 협력점 선택하러 가기
              </Link>
              <Link
                href="/admin/super"
                className="bg-rk-soft text-rk-text px-4 py-2 rounded text-[14px] no-underline"
              >
                ← 본사 콘솔로
              </Link>
            </div>
            <small className="block text-[11px] text-rk-faint mt-4">
              ⓘ 협력점 관리 페이지의 각 행에서 "콘솔 진입" 버튼을 누르면 해당 협력점 시야로 전환됩니다.
            </small>
          </div>
        </main>
      </div>
    );
  }

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
            <span className="bg-rk-orange text-white text-[12px] font-semibold px-1.5 py-0.5 rounded">본사 임시 진입</span>
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
