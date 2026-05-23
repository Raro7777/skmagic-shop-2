import Link from "next/link";
import { getEffectivePartner } from "@/lib/effectivePartner";
import { prisma } from "@/lib/prisma";
import KpiGrid from "@/components/franchise/KpiGrid";
import LiveLeads from "@/components/franchise/LiveLeads";
import SettlementSummary from "@/components/franchise/SettlementSummary";
import HqBroadcastBanner from "@/components/franchise/HqBroadcastBanner";
import JoinConditionsButton from "@/components/JoinConditionsButton";

export const metadata = { title: "대시보드 · 협력점 콘솔" };

export default async function FranchiseDashboard() {
  const eff = await getEffectivePartner();
  const partnerCode = eff?.partnerId;
  const partner = partnerCode
    ? await prisma.partner.findUnique({ where: { partnerCode } })
    : null;

  return (
    <>
      <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">
          {partner?.partnerName ?? "협력점"} 운영 대시보드
        </h1>
        <div className="ml-auto">
          <JoinConditionsButton />
        </div>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        {partner?.region ? `${partner.region} · ` : ""}{partner?.brandLabel ?? "—"}
      </p>

      <HqBroadcastBanner />

      <KpiGrid partnerCode={partnerCode ?? null} />
      <LiveLeads />
      <SettlementSummary />

      {/* Quick links to sub-sections */}
      <div className="grid grid-cols-4 gap-2.5 mb-3">
        <QuickLink href="/admin/franchise/leads"       icon="💬" title="상담 / 문의" desc="실시간 lead + 상태 관리" />
        <QuickLink href="/admin/franchise/sellers"     icon="👥" title="영업자 · 링크" desc="QR + 카톡 공유 문구" />
        <QuickLink href="/admin/franchise/products"    icon="🛒" title="상품 진열 · 정책" desc="사은품 · 설치비 환원" />
        <QuickLink href="/admin/franchise/settlements" icon="💳" title="정산" desc="이번 달 정산 + 이력" />
      </div>
    </>
  );
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block bg-white border border-rk-line rounded-lg p-3.5 hover:border-rk-navy transition-colors no-underline"
    >
      <div className="text-[20px] mb-1">{icon}</div>
      <b className="text-[13px] text-rk-ink block">{title}</b>
      <small className="text-[13px] text-rk-muted mt-0.5 block">{desc}</small>
    </Link>
  );
}
