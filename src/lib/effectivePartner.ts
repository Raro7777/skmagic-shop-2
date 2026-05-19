/**
 * 협력점 콘솔에서 동작 시 "어느 partnerId 로 동작할지" 결정.
 *
 *   - partner_admin : 본인 session.partnerId (강제)
 *   - hq            : cookie "hq_view_partner" 값 → 없으면 첫 active 협력점 자동
 *                     본사가 협력점 콘솔 진입 시 본사 콘솔 partner row 의 "콘솔 진입" 링크가 cookie 를 세팅.
 *   - seller / 기타 : null
 *
 *  반환 { partnerId, isHqImpersonating } — UI 가 "본사가 OO점으로 보는 중" 배지 노출 가능.
 */
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "./prisma";

export const HQ_VIEW_COOKIE = "hq_view_partner";

export async function getEffectivePartner(): Promise<
  | { partnerId: string; isHqImpersonating: boolean }
  | null
> {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role === "partner_admin") {
    if (!session.user.partnerId) return null;
    return { partnerId: session.user.partnerId, isHqImpersonating: false };
  }

  if (session.user.role === "hq") {
    const c = await cookies();
    const fromCookie = c.get(HQ_VIEW_COOKIE)?.value;
    if (fromCookie) {
      // cookie 가 가리키는 협력점이 active 인지 검증
      const ok = await prisma.partner.findUnique({
        where: { partnerCode: fromCookie },
        select: { status: true },
      });
      if (ok && ok.status === "active") {
        return { partnerId: fromCookie, isHqImpersonating: true };
      }
    }
    // cookie 없거나 invalid — 자동으로 첫 active partner 선택하지 않음.
    // 의도치 않게 우성종합통신 등 옛 partner 데이터가 보이는 사고 방지.
    // /admin/super/partners 의 "콘솔 진입" 버튼으로 명시적으로 들어와야 함.
    return null;
  }

  return null;
}

/** API 측 권한 게이트 — partner_admin OR hq 면 통과, partnerId 반환 */
export async function gatePartnerOrHq(): Promise<
  | { partnerId: string; isHqImpersonating: boolean }
  | { error: "unauthorized" | "forbidden" }
> {
  const session = await auth();
  if (!session?.user) return { error: "unauthorized" };
  if (session.user.role !== "partner_admin" && session.user.role !== "hq") {
    return { error: "forbidden" };
  }
  const eff = await getEffectivePartner();
  if (!eff) return { error: "forbidden" };
  return eff;
}
