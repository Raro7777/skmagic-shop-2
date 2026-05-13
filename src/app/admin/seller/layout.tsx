import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import SellerSidebar from "@/components/seller/SellerSidebar";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "seller") {
    redirect("/login?callbackUrl=%2Fadmin%2Fseller");
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    include: { partner: { select: { partnerName: true } } },
  });
  if (!seller) {
    return (
      <div className="p-8">
        <div className="bg-rk-tint-red text-rk-sale px-3 py-2 rounded text-[13px]">
          영업자 프로필이 없습니다. 협력점 관리자에게 문의해주세요.
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
