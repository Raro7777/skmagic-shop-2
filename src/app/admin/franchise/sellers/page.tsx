import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import LinksManager from "@/components/franchise/LinksManager";

export const metadata = { title: "영업자 · 링크 · 협력점 콘솔" };

export default async function SellersPage() {
  const session = await auth();
  const partnerCode = session?.user?.partnerId;
  const partner = partnerCode
    ? await prisma.partner.findUnique({ where: { partnerCode } })
    : null;

  if (!partner) {
    return (
      <div className="bg-rk-tint-orange text-rk-orange-deep p-4 rounded-md text-[14px]">
        협력점 정보를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">영업자 · 링크</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        점 대표 링크 + 영업자별 단독 링크 · QR 다운로드 · 카톡 공유 문구
      </p>

      <LinksManager
        partnerCode={partner.partnerCode}
        partnerName={partner.partnerName}
        hotline={partner.hotlineNumber}
      />
    </>
  );
}
