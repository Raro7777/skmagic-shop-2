import { prisma } from "@/lib/prisma";
import DuplicateReviewQueue from "@/components/super/DuplicateReviewQueue";

export const metadata = { title: "중복 DB 판정 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (n: Date) => `${n.getMonth() + 1}/${n.getDate()} ${pad(n.getHours())}:${pad(n.getMinutes())}`;
function pad(n: number) { return n < 10 ? "0" + n : String(n); }
function maskPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length !== 11) return p;
  return `${d.slice(0, 3)}-${d[3]}***-${d.slice(7)}`;
}

export default async function DuplicatesPage() {
  // Pull all leads with possible duplicate status
  const possibles = await prisma.lead.findMany({
    where: { duplicateStatus: "possible" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { partner: { select: { partnerName: true } } },
  });

  // For each possible, find the suspected match (same logic as captureLead's 2/3순위)
  const cards: Array<{
    lead: {
      id: string;
      customerName: string;
      phoneMasked: string;
      productInterest: string;
      region: string | null;
      partnerName: string | null;
      createdAtLabel: string;
      status: string;
    };
    matches: Array<{
      id: string;
      customerName: string;
      phoneMasked: string;
      productInterest: string;
      region: string | null;
      partnerName: string | null;
      createdAtLabel: string;
      status: string;
      reason: string;
    }>;
  }> = [];

  for (const lead of possibles) {
    const last4 = lead.phoneRaw.slice(-4);
    const regionFirstWord = (lead.region ?? "").trim().split(/\s+/)[0] ?? "";

    const matches = await prisma.lead.findMany({
      where: {
        id: { not: lead.id },
        OR: [
          { AND: [{ customerName: lead.customerName }, { phoneRaw: { endsWith: last4 } }] },
          ...(regionFirstWord
            ? [{ AND: [{ phoneRaw: { endsWith: last4 } }, { region: { startsWith: regionFirstWord } }] }]
            : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { partner: { select: { partnerName: true } } },
    });

    cards.push({
      lead: {
        id: lead.id,
        customerName: lead.customerName,
        phoneMasked: maskPhone(lead.phoneRaw),
        productInterest: lead.productInterest,
        region: lead.region,
        partnerName: lead.partner?.partnerName ?? null,
        createdAtLabel: fmt(lead.createdAt),
        status: lead.status,
      },
      matches: matches.map(m => {
        // Determine which rule matched
        const sameName = m.customerName === lead.customerName;
        const sameLast4 = m.phoneRaw.endsWith(last4);
        const sameRegion = regionFirstWord && (m.region ?? "").startsWith(regionFirstWord);
        let reason = "기타";
        if (sameName && sameLast4) reason = "이름 + 휴대폰 뒤4자리 일치";
        else if (sameLast4 && sameRegion) reason = "휴대폰 뒤4자리 + 지역 일치";
        return {
          id: m.id,
          customerName: m.customerName,
          phoneMasked: maskPhone(m.phoneRaw),
          productInterest: m.productInterest,
          region: m.region,
          partnerName: m.partner?.partnerName ?? null,
          createdAtLabel: fmt(m.createdAt),
          status: m.status,
          reason,
        };
      }),
    });
  }

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">중복 DB 판정</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        2~3순위 중복 후보 ({cards.length}건) · 본사가 직접 검토하여 처리합니다 (룰북 9.1 + A5)
      </p>

      <DuplicateReviewQueue cards={cards} />

      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        ⓘ 1순위(휴대폰 완전 일치)는 자동으로 confirmed 처리되어 본 큐에 들어오지 않습니다.<br />
        본 화면의 후보는 2순위(이름 + 뒤4자리) 또는 3순위(뒤4자리 + 지역 일치)에 해당합니다.
      </div>
    </>
  );
}
