import Link from "next/link";
import { notFound } from "next/navigation";
import PartnerHeader from "@/components/consumer/PartnerHeader";
import PartnerFooter from "@/components/consumer/PartnerFooter";
import PartnerCta from "@/components/consumer/PartnerCta";
import { getPartnerHeader } from "@/lib/partnerSite";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerCode: string }>;
}) {
  const { partnerCode } = await params;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) return { title: "Not Found" };
  return { title: `가입 후기 · ${partner.partnerName}` };
}

const DAY = 24 * 60 * 60 * 1000;

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerCode: string }>;
  searchParams: Promise<{ code?: string; rating?: string }>;
}) {
  const { partnerCode } = await params;
  const sp = await searchParams;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) notFound();

  // 필터: 특정 productCode 또는 특정 별점
  const productCodeFilter = sp.code?.trim();
  const ratingFilter = sp.rating ? Number(sp.rating) : null;

  let productId: string | undefined = undefined;
  let productName: string | null = null;
  if (productCodeFilter) {
    const p = await prisma.product.findUnique({
      where: { productCode: productCodeFilter },
      select: { id: true, name: true },
    });
    if (p) { productId = p.id; productName = p.name; }
  }

  const where = {
    status: "published",
    ...(productId && { productId }),
    ...(ratingFilter && ratingFilter >= 1 && ratingFilter <= 5 && { rating: ratingFilter }),
  } as const;

  const [reviews, total, avgAgg, verifiedCount, byRating] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" }, // 최신 등록순
      take: 50,
      include: { product: { select: { productCode: true, name: true, modelName: true } } },
    }),
    prisma.review.count({ where: { status: "published" } }),
    prisma.review.aggregate({ where: { status: "published" }, _avg: { rating: true } }),
    prisma.review.count({ where: { status: "published", isVerified: true } }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { status: "published" },
      _count: { _all: true },
    }),
  ]);

  const avgRating = avgAgg._avg.rating != null ? Math.round(avgAgg._avg.rating * 10) / 10 : 0;
  const ratingDist = new Map(byRating.map(r => [r.rating, r._count._all]));

  return (
    <div className="bg-rk-soft-2 min-h-screen flex justify-center items-start gap-6 max-md:p-0 md:py-8">
      <div className="w-full md:w-[390px] bg-white md:rounded-[32px] md:shadow-[0_8px_24px_rgba(20,25,40,.08)] overflow-hidden md:border-8 md:border-[#1A1D24]">
        <div className="hidden md:flex bg-white h-9 items-center justify-between px-[22px] text-[14px] font-semibold">
          <span className="rk-num">9:41</span>
          <span>● ●</span>
        </div>

        <PartnerHeader partner={partner} showFullNav />

        {/* Hero summary */}
        <section className="bg-white px-4 py-5 border-b border-rk-line-2">
          <h1 className="text-[20px] font-bold text-rk-ink tracking-[-.02em] m-0">가입 후기</h1>
          <div className="flex items-center gap-3 mt-2.5">
            <div className="text-rk-warn text-[20px] leading-none">{"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}</div>
            <div>
              <div className="rk-num text-[18px] font-bold text-rk-ink">{avgRating.toFixed(1)}</div>
              <small className="text-[12px] text-rk-muted">평점 / 전체 {total}건</small>
            </div>
            {verifiedCount > 0 && (
              <span className="ml-auto text-[12px] px-1.5 py-px rounded bg-rk-tint-green text-rk-success font-medium">
                ✓ 가입 인증 {verifiedCount}건
              </span>
            )}
          </div>
          <p className="text-[13px] text-rk-muted mt-2 m-0">
            {partner.partnerName} · 실제 가입 고객 후기 최신순
          </p>

          {/* 별점 분포 */}
          <div className="mt-3 flex flex-col gap-1">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = ratingDist.get(rating) ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <Link
                  key={rating}
                  href={ratingFilter === rating ? `/p/${partner.partnerCode}/reviews` : `/p/${partner.partnerCode}/reviews?rating=${rating}`}
                  className="flex items-center gap-2 text-[12px] no-underline cursor-pointer hover:opacity-80"
                >
                  <span className={"rk-num min-w-[16px] " + (ratingFilter === rating ? "text-rk-orange-deep font-bold" : "text-rk-muted")}>{rating}★</span>
                  <div className="flex-1 h-1.5 bg-rk-line-2 rounded-full overflow-hidden">
                    <div className="h-full bg-rk-warn" style={{ width: pct + "%" }} />
                  </div>
                  <span className="text-rk-muted rk-num min-w-[24px] text-right">{count}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 필터 안내 */}
        {(productCodeFilter || ratingFilter) && (
          <div className="bg-rk-tint-blue text-rk-info px-3 py-2 text-[13px] flex items-center gap-2">
            <span>
              필터:&nbsp;
              {productName && <b>{productName}</b>}
              {ratingFilter && <b>{ratingFilter}★</b>}
              <span className="mx-1.5">·</span>
              <b className="text-rk-info">{reviews.length}건</b>
            </span>
            <Link href={`/p/${partner.partnerCode}/reviews`} className="ml-auto text-[12px] underline">필터 해제</Link>
          </div>
        )}

        {/* Reviews */}
        <section className="bg-white px-4 py-3">
          <div className="flex flex-col gap-2">
            {reviews.length === 0 ? (
              <div className="bg-rk-soft-2 rounded-md p-6 text-center text-[14px] text-rk-muted">
                해당 조건의 후기가 없습니다.
              </div>
            ) : reviews.map(r => {
              const daysAgo = Math.max(0, Math.floor((Date.now() - r.createdAt.getTime()) / DAY));
              return (
                <div key={r.id} className="bg-rk-soft-2 border border-rk-line-2 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-rk-warn text-[14px]">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    <span className="text-[12px] text-rk-muted rk-num">{r.rating}.0</span>
                    {r.isVerified && <span className="text-[9px] px-1 py-px rounded bg-rk-tint-green text-rk-success font-medium">가입 인증</span>}
                    <span className="ml-auto text-[12px] text-rk-faint">
                      {daysAgo === 0 ? "오늘" : daysAgo < 30 ? `${daysAgo}일 전` : `${Math.floor(daysAgo / 30)}개월 전`}
                    </span>
                  </div>
                  {r.title && <h5 className="text-[13px] font-semibold text-rk-ink m-0 mb-1">"{r.title}"</h5>}
                  <p className="text-[13px] text-rk-text m-0 leading-[1.6]">{r.body}</p>
                  <div className="text-[13px] text-rk-muted flex gap-1.5 mt-1.5 flex-wrap items-center">
                    <span>{r.customerName}</span>
                    {r.product && (
                      <>
                        <span>·</span>
                        <Link
                          href={`/p/${partner.partnerCode}/products/${r.product.productCode}`}
                          className="text-rk-info no-underline hover:underline"
                        >
                          {r.product.name}
                        </Link>
                      </>
                    )}
                    {r.selectedMode && <span className="text-[9px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">{r.selectedMode}</span>}
                    {r.selectedContractPeriod && <span className="text-[9px] px-1 py-px rounded bg-rk-soft text-rk-muted">{r.selectedContractPeriod}개월</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white px-4 py-4 border-t-8 border-rk-soft text-center">
          <Link
            href={`/p/${partner.partnerCode}/products`}
            className="inline-block text-[13px] text-rk-info underline"
          >
            상품 보러가기 →
          </Link>
        </section>

        <PartnerFooter partner={partner} />
        <PartnerCta partner={partner} />
      </div>
    </div>
  );
}
