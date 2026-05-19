import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveSeller } from "@/lib/effectiveSeller";
import SellerSidebar from "@/components/seller/SellerSidebar";
import LeaveSellerImpersonation from "@/components/seller/LeaveSellerImpersonation";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fadmin%2Fseller");
  }

  const eff = await getEffectiveSeller();
  // role=seller 본인이지만 Seller row 가 없는 경우 + hq/partner_admin 이지만 cookie 없는 경우
  if (!eff) {
    // hq/partner_admin: cookie 안 가지고 들어왔으면 협력점 콘솔 영업자 목록으로 안내
    if (session.user.role === "hq" || session.user.role === "partner_admin") {
      return (
        <div className="p-8 max-w-[640px] mx-auto">
          <div className="bg-rk-tint-orange text-rk-orange-deep px-4 py-4 rounded text-[14px] leading-[1.7]">
            <b className="block text-[16px] mb-1">🎯 어느 영업자 콘솔로 들어가시겠어요?</b>
            <p className="m-0 text-rk-text">
              영업자 콘솔은 협력점 콘솔의 <b>영업자 · 링크</b> 페이지에서 각 영업자 옆 <code className="bg-white/60 px-1 rounded text-[12px]">🎯 콘솔 진입</code> 버튼으로 들어옵니다.
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/admin/franchise/sellers" className="bg-rk-orange hover:bg-rk-orange-deep text-white px-4 py-2 rounded text-[13px] font-medium no-underline">
                협력점 영업자 목록 →
              </Link>
              {session.user.role === "hq" && (
                <Link href="/admin/super/partners" className="bg-white border border-rk-line text-rk-text px-4 py-2 rounded text-[13px] no-underline">
                  본사 콘솔로
                </Link>
              )}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="p-8">
        <div className="bg-rk-tint-red text-rk-sale px-3 py-2 rounded text-[13px]">
          영업자 프로필이 없습니다. 협력점 관리자에게 문의해주세요.
        </div>
      </div>
    );
  }

  const seller = await prisma.seller.findUnique({
    where: { id: eff.sellerId },
    include: { partner: { select: { partnerName: true } } },
  });
  if (!seller) {
    return (
      <div className="p-8">
        <div className="bg-rk-tint-red text-rk-sale px-3 py-2 rounded text-[13px]">
          영업자 정보를 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[220px_1fr] min-h-screen bg-rk-admin-bg">
      <SellerSidebar
        user={session.user}
        partnerName={seller.partner.partnerName}
        sellerName={seller.name}
      />
      <main className="px-[22px] pt-[18px] pb-[60px] max-w-[1500px]">
        {/* 임시 진입 배지 — hq 또는 협력점 관리자가 다른 영업자 콘솔로 진입한 경우 */}
        {eff.isImpersonating && (
          <div className="mb-3 bg-rk-tint-orange text-rk-orange-deep px-3 py-2 rounded-md text-[13px] flex items-center gap-2 flex-wrap">
            <span className="bg-rk-orange text-white text-[12px] font-semibold px-1.5 py-0.5 rounded">
              {session.user.role === "hq" ? "본사 임시 진입" : "협력점 임시 진입"}
            </span>
            <span>현재 <b>{seller.name}</b> ({seller.partner.partnerName}) 영업자 콘솔을 보고 있습니다.</span>
            <LeaveSellerImpersonation />
          </div>
        )}
        <div className="flex items-center gap-3.5 mb-3.5 flex-wrap">
          <Link href="/" className="text-[14px] text-rk-muted no-underline">← 허브</Link>
          <span className="text-[14px] text-rk-muted">영업자 콘솔</span>
          <div className="ml-auto flex gap-2 items-center">
            <span className="text-[14px] text-rk-muted">{seller.partner.partnerName}</span>
            <div className="w-7 h-7 rounded-full bg-rk-orange text-white grid place-items-center text-[13px] font-semibold">
              {seller.name?.[0] ?? "?"}
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
