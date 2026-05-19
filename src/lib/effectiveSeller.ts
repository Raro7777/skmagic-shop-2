/**
 * 영업자 콘솔(`/admin/seller`) 에서 "어느 sellerId 로 동작할지" 결정.
 *
 *   - seller       : 본인 (session.user.id → Seller 1:1 join)
 *   - hq           : cookie SELLER_VIEW_COOKIE → 어느 협력점 영업자든 임시 진입 가능
 *   - partner_admin: cookie SELLER_VIEW_COOKIE → 본인 partnerId 소속 영업자만 임시 진입
 *   - 기타         : null
 *
 *  반환 { sellerId, sellerUserId, partnerCode, isImpersonating }
 *  isImpersonating=true 면 UI 가 "본사/협력점 임시 진입" 배지 노출 가능.
 */
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "./prisma";

export const SELLER_VIEW_COOKIE = "console_view_seller";

export type EffectiveSeller = {
  sellerId: string;
  sellerUserId: string | null;
  partnerCode: string;
  isImpersonating: boolean;
};

export async function getEffectiveSeller(): Promise<EffectiveSeller | null> {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role === "seller") {
    const me = await prisma.seller.findFirst({
      where: { userId: session.user.id, status: "active" },
      select: { id: true, userId: true, partnerId: true },
    });
    if (!me) return null;
    return { sellerId: me.id, sellerUserId: me.userId, partnerCode: me.partnerId, isImpersonating: false };
  }

  if (session.user.role !== "hq" && session.user.role !== "partner_admin") return null;
  const c = await cookies();
  const sellerId = c.get(SELLER_VIEW_COOKIE)?.value;
  if (!sellerId) return null;

  const target = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { id: true, userId: true, partnerId: true, status: true },
  });
  if (!target || target.status !== "active") return null;

  if (session.user.role === "partner_admin") {
    if (target.partnerId !== session.user.partnerId) return null;
  }
  return { sellerId: target.id, sellerUserId: target.userId, partnerCode: target.partnerId, isImpersonating: true };
}
