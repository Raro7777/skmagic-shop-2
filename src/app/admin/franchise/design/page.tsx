import { prisma } from "@/lib/prisma";
import { getEffectivePartner } from "@/lib/effectivePartner";
import DesignClient from "@/components/franchise/DesignClient";

export const dynamic = "force-dynamic";

const ROLLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function DesignPage() {
  const eff = await getEffectivePartner();
  if (!eff?.partnerId) {
    return <div className="text-[14px] text-rk-muted">협력점 컨텍스트가 필요합니다.</div>;
  }

  const partner = await prisma.partner.findUnique({
    where: { partnerCode: eff.partnerId },
    select: { theme: true, previousTheme: true, themeChangedAt: true },
  });
  if (!partner) {
    return <div className="text-[14px] text-rk-muted">협력점 정보를 찾을 수 없습니다.</div>;
  }

  const canRollback =
    !!partner.previousTheme &&
    !!partner.themeChangedAt &&
    Date.now() - partner.themeChangedAt.getTime() < ROLLBACK_WINDOW_MS;

  return (
    <DesignClient
      initialTheme={partner.theme}
      initialCanRollback={canRollback}
      initialPreviousTheme={partner.previousTheme}
      initialRollbackExpiresAt={
        partner.themeChangedAt
          ? new Date(partner.themeChangedAt.getTime() + ROLLBACK_WINDOW_MS).toISOString()
          : null
      }
    />
  );
}
