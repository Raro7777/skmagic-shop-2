import { prisma } from "./prisma";
import type { LeadStatus } from "./leadStatus";

const DAY = 24 * 60 * 60 * 1000;

// 분석상 "전환 완료" = 설치 완료 이후 단계
const DONE_PHASE_SET = new Set<string>(["install_done", "settle_pending", "settle_done"]);
// 분석상 "보류/이상" = 영업점 회신 대기 단계
const WARN_PHASE_SET = new Set<string>(["verify_failed", "verify_revise", "revise_resubmit"]);
const isDonePhase = (s: string) => DONE_PHASE_SET.has(s);
const isWarnPhase = (s: string) => WARN_PHASE_SET.has(s);

export type ChannelStat = {
  channel: string;          // "consumer_partner" / "consumer_seller" / "api_partner:demo-mall" / "phone" / ...
  label: string;            // 사람용 라벨
  leads: number;
  done: number;             // status=done
  warn: number;
  conversionRate: number;   // done / leads * 100 (소수 1자리)
  netPayout: number;        // 정산 합계
};

export type PartnerStat = {
  partnerCode: string;
  partnerName: string;
  tier: string;
  status: string;
  leads30d: number;
  done30d: number;
  conversionRate: number;
  netPayout: number;
  avgResponseMinutes: number | null;  // new → going 평균 응답 시간
  activeSellers: number;
};

export type OptionDistribution = {
  byMode: Array<{ key: string; count: number }>;          // 방문형/셀프형/미선택
  byContractPeriod: Array<{ key: string; count: number }>; // 36/48/60/72/84/미선택
  rivalCompensationCount: number;
  rivalCompensationRate: number;                           // 전체 lead 중 %
};

export type DailyTrend = {
  date: string;             // YYYY-MM-DD
  leads: number;
  done: number;
};

export type RefundStats = {
  active: number;          // 진행 중 (refund_pending + refund_progress)
  activeAmount: number;
  done: number;            // refund_done (windowDays 내)
  doneAmount: number;
  refundRate: number;      // (활성+완료된 환수 건) / 송금 완료 정산 건 × 100
};

export type HqAnalytics = {
  windowDays: number;
  totals: {
    leads: number;
    done: number;
    conversionRate: number;
    netPayout: number;
    apiChannels: number;
    activePartners: number;
  };
  byChannel: ChannelStat[];
  byPartner: PartnerStat[];
  options: OptionDistribution;
  daily: DailyTrend[];
  refund: RefundStats;
};

const CHANNEL_LABEL: Record<string, string> = {
  consumer_form: "공식 사이트 폼",
  consumer_seller: "영업자 링크",
  consumer_partner: "협력점 사이트",
  kakao: "카카오톡 상담",
  phone: "전화 상담",
  api_partner: "외부 API 채널",
};

export async function getHqAnalytics(windowDays = 30): Promise<HqAnalytics> {
  const since = new Date(Date.now() - windowDays * DAY);

  // 1) leads 전체 (윈도우 내)
  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      status: true,
      source: true,
      externalChannel: true,
      partnerId: true,
      selectedMode: true,
      selectedContractPeriod: true,
      rivalCompensationRequested: true,
      createdAt: true,
      statusLogs: {
        select: { previousStatus: true, newStatus: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // 2) Settlement (lead.partnerId 기준 합계)
  const settlements = await prisma.settlement.findMany({
    where: { createdAt: { gte: since } },
    select: { partnerId: true, netPayout: true, lead: { select: { source: true, externalChannel: true } } },
  });

  // 3) Partner 목록
  const partners = await prisma.partner.findMany({
    where: { status: { not: "" } },
    select: {
      partnerCode: true,
      partnerName: true,
      tier: true,
      status: true,
      _count: { select: { sellers: true } },
    },
  });
  const activePartners = partners.filter(p => p.status === "active").length;

  // ============ totals ============
  const totalLeads = leads.length;
  const totalDone = leads.filter(l => isDonePhase(l.status)).length;
  const totalNet = settlements.reduce((s, x) => s + x.netPayout, 0);
  const apiChannelsCount = await prisma.apiPartner.count({ where: { status: "active" } });

  // ============ byChannel ============
  const channelMap = new Map<string, { leads: number; done: number; warn: number; netPayout: number }>();
  for (const l of leads) {
    const ch = l.source === "api_partner" && l.externalChannel
      ? `api_partner:${l.externalChannel}`
      : l.source;
    const cur = channelMap.get(ch) ?? { leads: 0, done: 0, warn: 0, netPayout: 0 };
    cur.leads++;
    if (isDonePhase(l.status)) cur.done++;
    if (isWarnPhase(l.status)) cur.warn++;
    channelMap.set(ch, cur);
  }
  for (const s of settlements) {
    const ch = s.lead?.source === "api_partner" && s.lead?.externalChannel
      ? `api_partner:${s.lead.externalChannel}`
      : (s.lead?.source ?? "unknown");
    const cur = channelMap.get(ch);
    if (cur) cur.netPayout += s.netPayout;
  }
  const byChannel: ChannelStat[] = [...channelMap.entries()]
    .map(([channel, v]) => ({
      channel,
      label: channel.startsWith("api_partner:")
        ? `🔌 ${channel.slice("api_partner:".length)}`
        : CHANNEL_LABEL[channel] ?? channel,
      leads: v.leads,
      done: v.done,
      warn: v.warn,
      conversionRate: v.leads > 0 ? Math.round((v.done / v.leads) * 1000) / 10 : 0,
      netPayout: v.netPayout,
    }))
    .sort((a, b) => b.leads - a.leads);

  // ============ byPartner ============
  const partnerStatMap = new Map<string, { leads: number; done: number; respMs: number[] }>();
  for (const l of leads) {
    if (!l.partnerId) continue;
    const cur = partnerStatMap.get(l.partnerId) ?? { leads: 0, done: 0, respMs: [] };
    cur.leads++;
    if (isDonePhase(l.status)) cur.done++;
    // consult_wish → consult_active (또는 그 이후) 첫 응답 시간
    const goingLog = l.statusLogs.find(s => s.previousStatus === "consult_wish" && s.newStatus !== "consult_wish");
    if (goingLog) {
      cur.respMs.push(goingLog.createdAt.getTime() - l.createdAt.getTime());
    }
    partnerStatMap.set(l.partnerId, cur);
  }
  const partnerNetMap = new Map<string, number>();
  for (const s of settlements) {
    if (!s.partnerId) continue;
    partnerNetMap.set(s.partnerId, (partnerNetMap.get(s.partnerId) ?? 0) + s.netPayout);
  }
  const byPartner: PartnerStat[] = partners
    .filter(p => p.status === "active")
    .map(p => {
      const stat = partnerStatMap.get(p.partnerCode) ?? { leads: 0, done: 0, respMs: [] };
      const avg = stat.respMs.length > 0
        ? Math.round((stat.respMs.reduce((s, n) => s + n, 0) / stat.respMs.length) / 60_000)
        : null;
      return {
        partnerCode: p.partnerCode,
        partnerName: p.partnerName,
        tier: p.tier ?? "basic",
        status: p.status,
        leads30d: stat.leads,
        done30d: stat.done,
        conversionRate: stat.leads > 0 ? Math.round((stat.done / stat.leads) * 1000) / 10 : 0,
        netPayout: partnerNetMap.get(p.partnerCode) ?? 0,
        avgResponseMinutes: avg,
        activeSellers: p._count.sellers,
      };
    })
    .sort((a, b) => b.leads30d - a.leads30d);

  // ============ options ============
  const modeMap = new Map<string, number>();
  const periodMap = new Map<string, number>();
  let rivalCount = 0;
  for (const l of leads) {
    const m = l.selectedMode ?? "미선택";
    modeMap.set(m, (modeMap.get(m) ?? 0) + 1);
    const p = l.selectedContractPeriod != null ? String(l.selectedContractPeriod) : "미선택";
    periodMap.set(p, (periodMap.get(p) ?? 0) + 1);
    if (l.rivalCompensationRequested) rivalCount++;
  }

  const options: OptionDistribution = {
    byMode: [...modeMap.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    byContractPeriod: [...periodMap.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => {
      // 숫자 키 정렬 + "미선택"은 마지막
      const ka = a.key === "미선택" ? 999 : Number(a.key);
      const kb = b.key === "미선택" ? 999 : Number(b.key);
      return ka - kb;
    }),
    rivalCompensationCount: rivalCount,
    rivalCompensationRate: totalLeads > 0 ? Math.round((rivalCount / totalLeads) * 1000) / 10 : 0,
  };

  // ============ daily trend ============
  const dailyMap = new Map<string, { leads: number; done: number }>();
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { leads: 0, done: 0 });
  }
  for (const l of leads) {
    const key = l.createdAt.toISOString().slice(0, 10);
    const cur = dailyMap.get(key);
    if (cur) {
      cur.leads++;
      if (isDonePhase(l.status)) cur.done++;
    }
  }
  const daily: DailyTrend[] = [...dailyMap.entries()].map(([date, v]) => ({ date, leads: v.leads, done: v.done }));

  // ============ refund stats ============
  const [refundActive, refundDone, paidCount] = await Promise.all([
    prisma.settlement.findMany({
      where: { refundStatus: { in: ["refund_pending", "refund_progress"] } },
      select: { refundAmount: true },
    }),
    prisma.settlement.findMany({
      where: { refundStatus: "refund_done", refundCompletedAt: { gte: since } },
      select: { refundAmount: true },
    }),
    prisma.settlement.count({ where: { status: "paid" } }),
  ]);
  const totalRefundCount = refundActive.length + refundDone.length;
  const refund: RefundStats = {
    active: refundActive.length,
    activeAmount: refundActive.reduce((s, x) => s + (x.refundAmount ?? 0), 0),
    done: refundDone.length,
    doneAmount: refundDone.reduce((s, x) => s + (x.refundAmount ?? 0), 0),
    refundRate: paidCount > 0 ? Math.round((totalRefundCount / paidCount) * 1000) / 10 : 0,
  };

  return {
    windowDays,
    totals: {
      leads: totalLeads,
      done: totalDone,
      conversionRate: totalLeads > 0 ? Math.round((totalDone / totalLeads) * 1000) / 10 : 0,
      netPayout: totalNet,
      apiChannels: apiChannelsCount,
      activePartners,
    },
    byChannel,
    byPartner,
    options,
    daily,
    refund,
  };
}
