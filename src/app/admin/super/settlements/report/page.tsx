import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PrintButton from "@/components/super/PrintButton";

export const metadata = { title: "월별 정산서 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtDate = (d: Date | null) => d?.toISOString().slice(0, 10) ?? "—";

const STATUS_LABEL: Record<string, string> = {
  pending: "검증 대기",
  confirmed: "검증 완료",
  paid: "송금 완료",
  cancelled: "취소",
  disputed: "이의 신청",
};
const STATUS_PILL: Record<string, string> = {
  pending: "bg-rk-tint-blue text-rk-info",
  confirmed: "bg-rk-tint-green text-rk-success",
  paid: "bg-rk-tint-green text-rk-success",
  cancelled: "bg-rk-soft text-rk-muted",
  disputed: "bg-rk-tint-orange text-rk-orange-deep",
};

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; partner?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month ?? new Date().toISOString().slice(0, 7);
  const partnerFilter = sp.partner;

  // 협력점 목록 + 해당 월 settlement
  const [settlements, partners] = await Promise.all([
    prisma.settlement.findMany({
      where: { periodMonth: month, ...(partnerFilter && { partnerId: partnerFilter }) },
      orderBy: [{ partnerId: "asc" }, { createdAt: "asc" }],
      include: {
        partner: { select: { partnerName: true, businessNumber: true, ownerName: true, hotlineNumber: true, address: true } },
        lead: { select: { customerName: true, phoneRaw: true, createdAt: true, productInterest: true, selectedMode: true, selectedContractPeriod: true } },
      },
    }),
    prisma.partner.findMany({
      where: { status: { in: ["active", "closed"] } },
      orderBy: { partnerName: "asc" },
      select: { partnerCode: true, partnerName: true },
    }),
  ]);

  // 협력점별 그룹화
  type PartnerGroup = {
    partnerId: string;
    partnerName: string;
    businessNumber: string | null;
    ownerName: string | null;
    hotlineNumber: string;
    address: string | null;
    items: typeof settlements;
    totals: { count: number; commission: number; gift: number; install: number; net: number };
    byStatus: Record<string, number>;
  };
  const groups = new Map<string, PartnerGroup>();
  for (const s of settlements) {
    if (!s.partnerId) continue;
    let g = groups.get(s.partnerId);
    if (!g) {
      g = {
        partnerId: s.partnerId,
        partnerName: s.partner?.partnerName ?? s.partnerId,
        businessNumber: s.partner?.businessNumber ?? null,
        ownerName: s.partner?.ownerName ?? null,
        hotlineNumber: s.partner?.hotlineNumber ?? "",
        address: s.partner?.address ?? null,
        items: [],
        totals: { count: 0, commission: 0, gift: 0, install: 0, net: 0 },
        byStatus: {},
      };
      groups.set(s.partnerId, g);
    }
    g.items.push(s);
    if (s.status !== "cancelled") {
      g.totals.count++;
      g.totals.commission += s.baseCommission;
      g.totals.gift += s.giftReturned;
      g.totals.install += s.installReturned;
      g.totals.net += s.netPayout;
    }
    g.byStatus[s.status] = (g.byStatus[s.status] ?? 0) + 1;
  }

  const grandTotal = [...groups.values()].reduce((s, g) => s + g.totals.net, 0);
  const grandCount = [...groups.values()].reduce((s, g) => s + g.totals.count, 0);

  // 월 네비게이션
  const [yr, mo] = month.split("-").map(Number);
  const prev = new Date(yr, mo - 2);
  const next = new Date(yr, mo);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;

  return (
    <>
      {/* Toolbar (인쇄 시 숨김) */}
      <div className="flex items-center gap-2 mb-3 flex-wrap print:hidden">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">월별 정산서</h1>
        <span className="text-[14px] text-rk-muted">{month}</span>
        <div className="flex gap-1 ml-2">
          <Link href={`/admin/super/settlements/report?month=${prevMonth}`} className="bg-white border border-rk-line text-rk-text px-2 py-1 rounded text-[13px] no-underline">← {prevMonth}</Link>
          <Link href={`/admin/super/settlements/report?month=${nextMonth}`} className="bg-white border border-rk-line text-rk-text px-2 py-1 rounded text-[13px] no-underline">{nextMonth} →</Link>
        </div>
        <form className="flex gap-1 items-center">
          <input type="hidden" name="month" value={month} />
          <select name="partner" defaultValue={partnerFilter ?? ""} className="border border-rk-line rounded px-2 py-1 text-[13px] bg-white">
            <option value="">전체 협력점</option>
            {partners.map(p => (
              <option key={p.partnerCode} value={p.partnerCode}>{p.partnerName}</option>
            ))}
          </select>
          <button type="submit" className="bg-rk-navy text-white border-0 px-2 py-1 rounded text-[13px] cursor-pointer">필터</button>
        </form>
        <PrintButton />

      </div>

      {/* 정산서 헤더 */}
      <div className="bg-white border border-rk-line rounded-lg p-6 mb-3 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[24px] font-bold tracking-[-.02em] text-rk-ink m-0">정산서</h2>
            <p className="text-rk-muted text-[13px] mt-1 m-0">{month} 정산 기간</p>
          </div>
          <div className="text-right">
            <div className="w-12 h-12 bg-rk-orange text-white rounded grid place-items-center font-bold text-[14px] tracking-[-.04em] ml-auto">RK</div>
            <b className="block text-rk-ink text-[14px] mt-1">렌트왕(주)</b>
            <small className="text-[12px] text-rk-faint block">서울특별시 종로구 청계천로 85</small>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-rk-line-2">
          <SummaryStat label="활성 협력점" value={String(groups.size)} suffix="곳" />
          <SummaryStat label="정산 항목" value={String(grandCount)} suffix="건" />
          <SummaryStat label="순수령 총계" value={`₩${fmt(grandTotal)}`} suffix="" tone="success" />
        </div>
      </div>

      {/* 협력점별 정산 카드 */}
      {[...groups.values()].length === 0 ? (
        <div className="bg-white border border-rk-line rounded-lg p-8 text-center text-[13px] text-rk-muted">
          {month} 기간 정산 데이터가 없습니다.
        </div>
      ) : (
        [...groups.values()].map(g => (
          <section key={g.partnerId} className="bg-white border border-rk-line rounded-lg p-5 mb-3 print:break-before-page">
            <header className="flex items-baseline justify-between flex-wrap gap-2 mb-3 border-b border-rk-line-2 pb-3">
              <div>
                <h3 className="text-[16px] font-bold text-rk-ink m-0">{g.partnerName}</h3>
                <small className="text-[13px] text-rk-muted">
                  대표 {g.ownerName ?? "—"}
                  {g.businessNumber && ` · 사업자 ${g.businessNumber}`}
                  {g.hotlineNumber && ` · ${g.hotlineNumber}`}
                </small>
                {g.address && <small className="block text-[12px] text-rk-faint">{g.address}</small>}
              </div>
              <div className="text-right">
                <div className="flex gap-1.5 justify-end">
                  {Object.entries(g.byStatus).map(([k, v]) => (
                    <span key={k} className={"text-[12px] px-1.5 py-px rounded font-medium " + STATUS_PILL[k]}>
                      {STATUS_LABEL[k] ?? k} {v}
                    </span>
                  ))}
                </div>
              </div>
            </header>

            <table className="w-full text-[14px]">
              <thead className="bg-rk-soft-2 text-rk-muted">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium text-[13px]">정산일</th>
                  <th className="text-left px-2 py-1.5 font-medium text-[13px]">고객</th>
                  <th className="text-left px-2 py-1.5 font-medium text-[13px]">상품 · 옵션</th>
                  <th className="text-right px-2 py-1.5 font-medium text-[13px]">본사 수수료</th>
                  <th className="text-right px-2 py-1.5 font-medium text-[13px]">사은품 환원</th>
                  <th className="text-right px-2 py-1.5 font-medium text-[13px]">설치비 환원</th>
                  <th className="text-right px-2 py-1.5 font-medium text-[13px]">순수령</th>
                  <th className="text-left px-2 py-1.5 font-medium text-[13px]">상태</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map(s => (
                  <tr key={s.id} className={"border-t border-rk-line-2 " + (s.status === "cancelled" ? "opacity-50 line-through" : "")}>
                    <td className="px-2 py-1.5 rk-num">{fmtDate(s.createdAt)}</td>
                    <td className="px-2 py-1.5">
                      <b className="text-rk-ink">{s.lead?.customerName ?? "—"}</b>
                      <small className="block text-rk-faint text-[12px] font-mono">{maskPhone(s.lead?.phoneRaw ?? "")}</small>
                    </td>
                    <td className="px-2 py-1.5">
                      <b className="text-rk-ink text-[13px]">{s.productName}</b>
                      <div className="flex gap-1 mt-0.5">
                        {s.lead?.selectedMode && <span className="text-[9px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">{s.lead.selectedMode}</span>}
                        {s.lead?.selectedContractPeriod && <span className="text-[9px] px-1 py-px rounded bg-rk-soft text-rk-muted">{s.lead.selectedContractPeriod}개월</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right rk-num">{fmt(s.baseCommission)}</td>
                    <td className="px-2 py-1.5 text-right rk-num text-rk-orange-deep">{s.giftReturned > 0 ? `−${fmt(s.giftReturned)}` : "—"}</td>
                    <td className="px-2 py-1.5 text-right rk-num text-rk-orange-deep">{s.installReturned > 0 ? `−${fmt(s.installReturned)}` : "—"}</td>
                    <td className="px-2 py-1.5 text-right rk-num font-semibold text-rk-success">{fmt(s.netPayout)}</td>
                    <td className="px-2 py-1.5">
                      <span className={"text-[12px] px-1.5 py-px rounded font-medium " + STATUS_PILL[s.status]}>{STATUS_LABEL[s.status] ?? s.status}</span>
                      {s.paidAt && <small className="block text-[9px] text-rk-faint mt-0.5">{fmtDate(s.paidAt)}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-rk-line bg-rk-soft-2 font-semibold">
                  <td colSpan={3} className="px-2 py-2 text-right text-rk-ink">합계 ({g.totals.count}건)</td>
                  <td className="px-2 py-2 text-right rk-num text-rk-ink">{fmt(g.totals.commission)}</td>
                  <td className="px-2 py-2 text-right rk-num text-rk-orange-deep">{g.totals.gift > 0 ? `−${fmt(g.totals.gift)}` : "—"}</td>
                  <td className="px-2 py-2 text-right rk-num text-rk-orange-deep">{g.totals.install > 0 ? `−${fmt(g.totals.install)}` : "—"}</td>
                  <td className="px-2 py-2 text-right rk-num text-rk-success text-[14px]">₩{fmt(g.totals.net)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>

            <div className="mt-3 text-[12px] text-rk-faint leading-[1.5]">
              ※ 상기 정산 내역은 룰북 20.7에 따라 본사 수수료(기본 + 월 인센티브)에서 협력점 환원(사은품·설치비)을 차감한 순수령액입니다.
              송금일은 본사 검증 완료 후 영업일 기준 5일 이내입니다.
            </div>
          </section>
        ))
      )}

      {/* Grand total footer */}
      {groups.size > 0 && (
        <div className="bg-rk-navy text-white rounded-lg p-5 print:break-before-page">
          <div className="flex items-baseline justify-between flex-wrap">
            <div>
              <h3 className="text-[15px] font-semibold m-0">{month} 전체 합계</h3>
              <small className="opacity-80 text-[13px]">{groups.size}개 협력점 · {grandCount}건 정산</small>
            </div>
            <b className="text-[24px] font-bold tracking-[-.02em] rk-num text-[#FFB374]">₩{fmt(grandTotal)}</b>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body { background: white !important; }
          aside { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
        }
      `}</style>
    </>
  );
}

function SummaryStat({ label, value, suffix, tone }: { label: string; value: string; suffix: string; tone?: "success" }) {
  return (
    <div>
      <small className="text-[12px] uppercase tracking-[.04em] text-rk-muted font-medium block">{label}</small>
      <div className="flex items-baseline gap-1 mt-0.5">
        <b className={"text-[20px] font-bold tracking-[-.02em] rk-num " + (tone === "success" ? "text-rk-success" : "text-rk-ink")}>{value}</b>
        {suffix && <small className="text-[13px] text-rk-muted">{suffix}</small>}
      </div>
    </div>
  );
}

function maskPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.length !== 11) return p;
  return `${d.slice(0, 3)}-${d[3]}***-${d.slice(7)}`;
}
