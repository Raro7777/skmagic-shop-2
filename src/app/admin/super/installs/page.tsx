import { prisma } from "@/lib/prisma";
import InstallCompleteList from "@/components/super/InstallCompleteList";

export const metadata = { title: "설치 완료 처리 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default async function InstallsPage() {
  const leads = await prisma.lead.findMany({
    where: { status: "install_pending" },
    orderBy: { createdAt: "asc" },
    include: {
      partner: { select: { partnerName: true, region: true } },
    },
  });

  // 정산 미리 계산 (HqPolicy + PartnerPolicy → netPayout 예상값)
  const productCodes = [...new Set(leads.map(l => l.productCode).filter((x): x is string => !!x))];
  const products = await prisma.product.findMany({
    where: { productCode: { in: productCodes } },
    select: { id: true, productCode: true, name: true, hqPolicy: { select: { baseCommission: true, monthIncentive: true } } },
  });
  const productMap = new Map(products.map(p => [p.productCode, p]));
  const partnerProductIds = leads
    .filter(l => l.partnerId && l.productCode)
    .map(l => ({ partnerId: l.partnerId!, productId: productMap.get(l.productCode!)?.id }))
    .filter((x): x is { partnerId: string; productId: string } => !!x.productId);
  const partnerPolicies = partnerProductIds.length > 0
    ? await prisma.partnerPolicy.findMany({
        where: { OR: partnerProductIds.map(x => ({ partnerId: x.partnerId, productId: x.productId })) },
        select: { partnerId: true, productId: true, giftAmount: true, installAmount: true },
      })
    : [];
  const partnerPolicyMap = new Map(partnerPolicies.map(p => [`${p.partnerId}|${p.productId}`, p]));

  const rows = leads.map(l => {
    const product = l.productCode ? productMap.get(l.productCode) : null;
    const base = (product?.hqPolicy?.baseCommission ?? 0) + (product?.hqPolicy?.monthIncentive ?? 0);
    const pp = l.partnerId && product ? partnerPolicyMap.get(`${l.partnerId}|${product.id}`) : null;
    const gift = pp?.giftAmount ?? 0;
    const install = pp?.installAmount ?? 0;
    const net = base - gift - install;
    const ageMs = Date.now() - l.createdAt.getTime();
    const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    return {
      id: l.id,
      createdAt: l.createdAt.toISOString().slice(0, 16).replace("T", " "),
      ageDays,
      customerName: l.customerName,
      phone: l.phoneRaw,
      partnerName: l.partner?.partnerName ?? (l.ownerType === "hq_pool" ? "본사 풀(미배정)" : "—"),
      partnerRegion: l.partner?.region ?? null,
      productName: product?.name ?? l.productInterest,
      productCode: l.productCode ?? null,
      selectedMode: l.selectedMode,
      selectedContractPeriod: l.selectedContractPeriod,
      expectedBase: base,
      expectedGift: gift,
      expectedInstall: install,
      expectedNet: net,
      hasPolicy: base > 0,
      hasPartner: !!l.partnerId,
    };
  });

  const totalExpected = rows.filter(r => r.hasPartner).reduce((s, r) => s + r.expectedNet, 0);
  const overdue = rows.filter(r => r.ageDays >= 7).length;

  return (
    <>
      <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">📦 설치 완료 처리</h1>
        <span className="ml-auto text-[13px] text-rk-muted">
          본사 전담 · done 처리 시 정산 자동 생성
        </span>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        설치대기 lead <b className="text-rk-ink">{rows.length}건</b>
        {overdue > 0 && <> · 7일 초과 <b className="text-rk-sale">{overdue}건</b></>}
        {totalExpected > 0 && <> · 예상 송금 합계 <b className="text-rk-ink rk-num">₩{fmt(totalExpected)}</b></>}
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-rk-line rounded-lg p-8 text-center text-[14px] text-rk-muted">
          현재 설치대기 상태 lead가 없습니다. 인증완료된 lead가 자동으로 설치대기로 들어옵니다.
        </div>
      ) : (
        <InstallCompleteList rows={rows} />
      )}

      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px]">
        ⓘ &quot;설치 완료&quot; 클릭 → lead.status = done · Settlement 자동 생성 (HqPolicy + PartnerPolicy 기준). 되돌리려면 협력점 콘솔에서 going으로 변경 시 정산이 cancelled 됩니다.
      </div>
    </>
  );
}
