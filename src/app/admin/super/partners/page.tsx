import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PartnerActions from "@/components/super/PartnerActions";
import PartnerDomainAction from "@/components/super/PartnerDomainAction";
import { type Tier } from "@/lib/tier";

export const metadata = { title: "협력점 관리 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n.toString();
};

export default async function PartnersPage() {
  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { leads: true, sellers: true, settlements: true } },
    },
  });
  const periodMonth = new Date().toISOString().slice(0, 7);
  const [settlements, activeLeadCounts] = await Promise.all([
    prisma.settlement.groupBy({
      by: ["partnerId"],
      where: { periodMonth, status: { not: "cancelled" } },
      _sum: { netPayout: true },
    }),
    prisma.lead.groupBy({
      by: ["partnerId"],
      where: { status: { notIn: ["consult_closed", "install_cancel", "settle_done"] } },
      _count: { _all: true },
    }),
  ]);
  const sumByPartner = new Map(settlements.map(s => [s.partnerId, s._sum.netPayout ?? 0]));
  const activeByPartner = new Map(activeLeadCounts.map(c => [c.partnerId, c._count._all]));

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">협력점 관리</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        총 <b className="text-rk-ink">{partners.length}</b>개 · 활성{" "}
        <b className="text-rk-success">{partners.filter(p => p.status === "active").length}</b>
        {" · 퇴점 "}<b className="text-rk-muted">{partners.filter(p => p.status === "closed").length}</b>
      </p>

      <div className="bg-white border border-rk-line rounded-lg p-4">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {["협력점", "지역", "Lead", "영업자", "이번달 정산", "상태", "패키지 · 작업"].map(h => (
                <th key={h} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partners.map(p => {
              const isClosed = p.status === "closed";
              return (
                <tr key={p.partnerCode} className={"hover:bg-rk-soft-2 " + (isClosed ? "opacity-60" : "")}>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <b className="block text-rk-ink">{p.partnerName}</b>
                    <small className="text-[12px] text-rk-muted">{p.brandLabel}</small>
                    <small className="block text-[9px] text-rk-faint font-mono">{p.partnerCode}</small>
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 text-rk-text text-[13px]">{p.region ?? "—"}</td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">
                    <div>{p._count.leads}</div>
                    {(activeByPartner.get(p.partnerCode) ?? 0) > 0 && (
                      <small className="text-[12px] text-rk-orange-deep">진행 {activeByPartner.get(p.partnerCode)}</small>
                    )}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">{p._count.sellers}</td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">
                    ₩{fmtCompact(sumByPartner.get(p.partnerCode) ?? 0)}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <span
                      className={
                        "text-[12px] px-1.5 py-px rounded font-medium " +
                        (p.status === "active"
                          ? "bg-rk-tint-green text-rk-success"
                          : p.status === "suspended"
                            ? "bg-rk-tint-orange text-rk-orange-deep"
                            : p.status === "closed"
                              ? "bg-rk-tint-red text-rk-sale"
                              : "bg-rk-soft text-rk-muted")
                      }
                    >
                      {p.status}
                    </span>
                    {p.closedAt && (
                      <small className="block text-[9px] text-rk-faint mt-0.5">{p.closedAt.toISOString().slice(0, 10)}</small>
                    )}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <div className="flex flex-col gap-1 items-end">
                      <PartnerActions
                        partnerCode={p.partnerCode}
                        currentTier={(p.tier ?? "basic") as Tier}
                        status={p.status}
                        activeLeadCount={activeByPartner.get(p.partnerCode) ?? 0}
                      />
                      <PartnerDomainAction
                        partnerCode={p.partnerCode}
                        initialDomain={p.customDomain}
                        initialStatus={p.customDomainStatus}
                      />
                      <Link href={`/p/${p.partnerCode}`} target="_blank" className="text-[12px] text-rk-info no-underline">사이트 →</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 px-3 py-2 bg-rk-tint-blue rounded text-[13px] text-rk-info leading-[1.6]">
        ⓘ <b>퇴점 처리</b> 시 진행중 lead(new/going/warn)는 본사 풀로 이전되며, 영업자 + 배너는 자동 비활성화됩니다.
        퇴점 협력점의 분양 사이트(<code className="font-mono">/p/[code]</code>)는 즉시 차단됩니다.
      </div>
    </>
  );
}
