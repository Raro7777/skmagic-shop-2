import { prisma } from "./prisma";

export type AnomalyItem = {
  kind: "unresponsive_lead" | "warn_lead" | "duplicate_pending" | "policy_overspend" | "stale_partner";
  severity: "info" | "warn" | "critical";
  kindLabel: string;
  partnerCode: string | null;
  partnerName: string | null;
  description: string;
  ageMinutes: number;
  cta: { label: string; href: string };
};

export type AnomalyReport = {
  items: AnomalyItem[];
  countsByKind: Record<string, number>;
  scope: "all" | "partner";
};

const HOUR = 60 * 60 * 1000;

export async function detectAnomalies(opts: { partnerId?: string | null } = {}): Promise<AnomalyReport> {
  const partnerScope = opts.partnerId ? { partnerId: opts.partnerId } : {};

  const partners = await prisma.partner.findMany({
    where: { status: "active" },
    select: { partnerCode: true, partnerName: true },
  });
  const partnerMap = new Map(partners.map(p => [p.partnerCode, p.partnerName]));
  const partnerNameOf = (code: string | null) => (code ? partnerMap.get(code) ?? code : null);

  const items: AnomalyItem[] = [];

  // 1. Unresponsive lead — consult_wish 4시간+
  const fourHoursAgo = new Date(Date.now() - 4 * HOUR);
  const unresponsive = await prisma.lead.findMany({
    where: { ...partnerScope, status: "consult_wish", createdAt: { lt: fourHoursAgo } },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  for (const l of unresponsive) {
    const ageMs = Date.now() - l.createdAt.getTime();
    const ageMinutes = Math.floor(ageMs / 60_000);
    const severity: AnomalyItem["severity"] = ageMs > 12 * HOUR ? "critical" : "warn";
    items.push({
      kind: "unresponsive_lead",
      severity,
      kindLabel: "📞 미응답 lead",
      partnerCode: l.partnerId,
      partnerName: partnerNameOf(l.partnerId),
      description: `${l.customerName} 고객 신규 상담 미처리 — ${formatAge(ageMinutes)}`,
      ageMinutes,
      cta: { label: "lead 보기", href: opts.partnerId ? "/admin/franchise/leads" : "/admin/search?q=" + encodeURIComponent(l.customerName) },
    });
  }

  // 2. 회신 필요 (인증실패 / 수정요청 / 회신상태 — 영업점 액션 대기)
  const respondLeads = await prisma.lead.findMany({
    where: { ...partnerScope, status: { in: ["verify_failed", "verify_revise", "revise_resubmit"] } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  for (const l of respondLeads) {
    const ageMs = Date.now() - l.updatedAt.getTime();
    const isFail = l.status === "verify_failed";
    items.push({
      kind: "warn_lead",
      severity: "warn",
      kindLabel: isFail ? "🚨 인증실패 — 회신 필요" : "✏️ 수정요청 — 회신 필요",
      partnerCode: l.partnerId,
      partnerName: partnerNameOf(l.partnerId),
      description: `${l.customerName} · ${l.productInterest}${l.verifyLastReason ? ` — ${l.verifyLastReason}` : ""}`,
      ageMinutes: Math.floor(ageMs / 60_000),
      cta: { label: "회신 작성", href: opts.partnerId ? "/admin/franchise/leads" : "/admin/search?q=" + encodeURIComponent(l.customerName) },
    });
  }

  // 3. Duplicate pending — possible, requires HQ review (HQ scope only)
  if (!opts.partnerId) {
    const possibleCount = await prisma.lead.count({ where: { duplicateStatus: "possible" } });
    if (possibleCount > 0) {
      items.push({
        kind: "duplicate_pending",
        severity: "info",
        kindLabel: "🔁 중복 판정 대기",
        partnerCode: null,
        partnerName: null,
        description: `2/3순위 중복 후보 ${possibleCount}건 — 본사 검토 필요`,
        ageMinutes: 0,
        cta: { label: "판정 큐로", href: "/admin/super/duplicates" },
      });
    }
  }

  // 4. Policy overspend — partner using >80% of refund limit
  const policies = await prisma.partnerPolicy.findMany({
    where: opts.partnerId ? { partnerId: opts.partnerId } : {},
    include: {
      product: { include: { hqPolicy: true } },
      partner: { select: { partnerName: true } },
    },
  });
  for (const p of policies) {
    if (!p.product.hqPolicy) continue;
    const totalCommission = p.product.hqPolicy.baseCommission + p.product.hqPolicy.monthIncentive;
    const limit = Math.floor(totalCommission * p.product.hqPolicy.refundLimitRatio);
    const used = p.giftAmount + p.installAmount;
    if (limit > 0 && used >= limit * 0.8) {
      const overLimit = used > limit;
      items.push({
        kind: "policy_overspend",
        severity: overLimit ? "critical" : "warn",
        kindLabel: overLimit ? "💰 한도 초과" : "💰 한도 임박",
        partnerCode: p.partnerId,
        partnerName: p.partner.partnerName,
        description: overLimit
          ? `${p.product.name}: 환원 ₩${used.toLocaleString()} > 한도 ₩${limit.toLocaleString()} (초과)`
          : `${p.product.name}: 환원 ₩${used.toLocaleString()} / ₩${limit.toLocaleString()} (한도 ${Math.round((used / limit) * 100)}%)`,
        ageMinutes: 0,
        cta: { label: "정책 보기", href: opts.partnerId ? "/admin/franchise/products" : "/admin/super/policies" },
      });
    }
  }

  // 5. Stale partner — no leads in last 14 days (HQ scope)
  if (!opts.partnerId) {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * HOUR);
    for (const partner of partners) {
      const recentLead = await prisma.lead.findFirst({
        where: { partnerId: partner.partnerCode, createdAt: { gte: fourteenDaysAgo } },
        select: { id: true },
      });
      if (!recentLead) {
        items.push({
          kind: "stale_partner",
          severity: "info",
          kindLabel: "📊 lead 정체",
          partnerCode: partner.partnerCode,
          partnerName: partner.partnerName,
          description: `${partner.partnerName}: 14일간 신규 lead 없음 — 영업 점검 필요`,
          ageMinutes: 0,
          cta: { label: "협력점 보기", href: "/admin/super/partners" },
        });
      }
    }
  }

  // Sort: critical → warn → info, then most recent
  const SEV_RANK = { critical: 0, warn: 1, info: 2 };
  items.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.ageMinutes - a.ageMinutes);

  const countsByKind = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.kind] = (acc[i.kind] ?? 0) + 1;
    return acc;
  }, {});

  return {
    items,
    countsByKind,
    scope: opts.partnerId ? "partner" : "all",
  };
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}분 경과`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 경과`;
  return `${Math.floor(hours / 24)}일 경과`;
}
