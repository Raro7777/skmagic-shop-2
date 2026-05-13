import Link from "next/link";
import { notFound } from "next/navigation";
import PartnerHeader from "@/components/consumer/PartnerHeader";
import PartnerFooter from "@/components/consumer/PartnerFooter";
import PartnerCta from "@/components/consumer/PartnerCta";
import { getPartnerHeader, listPartnerProducts } from "@/lib/partnerSite";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerCode: string }>;
}) {
  const { partnerCode } = await params;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) return { title: "Not Found" };
  return { title: `이벤트 / 사은품 · ${partner.partnerName}` };
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{ partnerCode: string }>;
}) {
  const { partnerCode } = await params;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) notFound();

  const products = await listPartnerProducts(partnerCode);
  const giftEvents = products.filter(p => p.giftAmount > 0);
  const installEvents = products.filter(p => p.installFreed);

  return (
    <div className="bg-rk-soft-2 min-h-screen flex justify-center items-start gap-6 max-md:p-0 md:py-8">
      <div className="w-full md:w-[390px] bg-white md:rounded-[32px] md:shadow-[0_8px_24px_rgba(20,25,40,.08)] overflow-hidden md:border-8 md:border-[#1A1D24]">
        <div className="hidden md:flex bg-white h-9 items-center justify-between px-[22px] text-[14px] font-semibold">
          <span className="rk-num">9:41</span>
          <span>● ●</span>
        </div>

        <PartnerHeader partner={partner} showFullNav />

        {/* Hero */}
        <section className="bg-rk-tint-orange px-4 py-5 border-b border-[#F4DCC9]">
          <span className="inline-flex items-center text-[12px] px-2 py-0.5 rounded bg-rk-orange text-white font-semibold mb-2">EVENT</span>
          <h1 className="text-[20px] font-bold text-rk-orange-deep tracking-[-.02em] m-0">
            {partner.partnerName} 단독 이벤트
          </h1>
          <p className="text-[14px] text-rk-orange-deep mt-1.5 m-0">
            가입 시 즉시 받는 사은품 · 5월 한정 혜택
          </p>
          <div className="flex items-center gap-2 mt-3 text-[13px]">
            <b className="text-rk-orange-deep rk-num">{giftEvents.length}</b>
            <span className="text-rk-orange-deep">개 사은품 운영 중</span>
            {installEvents.length > 0 && (
              <>
                <span className="text-rk-orange-deep">·</span>
                <b className="text-rk-orange-deep rk-num">{installEvents.length}</b>
                <span className="text-rk-orange-deep">개 설치비 면제</span>
              </>
            )}
          </div>
        </section>

        {/* HQ-driven event */}
        <section className="bg-white px-4 py-4 border-b-8 border-rk-soft">
          <h3 className="text-[14px] font-semibold text-rk-ink mb-2">📢 본사 일괄 이벤트</h3>
          <div className="bg-rk-tint-blue rounded-md p-3 border border-[#D8E4F4]">
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-info text-white font-medium">5/12 ~ 5/19</span>
              <span className="text-[12px] text-rk-info">전 협력점 공통</span>
            </div>
            <h4 className="text-[14px] font-semibold text-rk-info m-0 mb-1">어버이날 효도 패키지</h4>
            <p className="text-[14px] text-rk-text leading-[1.5] m-0">
              본사 일괄 가격 잠금 — 정수기·안마의자 묶음 가입 시 추가 사은품 증정.
              기간 중 협력점 사은품 환원 일시 잠금.
            </p>
          </div>
        </section>

        {/* Partner gifts */}
        {giftEvents.length > 0 && (
          <section className="bg-white px-4 py-4 border-b-8 border-rk-soft">
            <h3 className="text-[14px] font-semibold text-rk-ink mb-2">🎁 {partner.partnerName} 단독 사은품</h3>
            <div className="flex flex-col gap-2.5">
              {giftEvents.map(p => (
                <Link
                  key={p.productCode}
                  href={`/p/${partner.partnerCode}/products/${p.productCode}`}
                  className="block bg-white border border-rk-line rounded-md p-3 no-underline text-inherit hover:border-rk-orange transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-md bg-gradient-to-br from-[#FCEFE5] to-[#F4DCC9] grid place-items-center text-[24px]">
                      🎁
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-rk-orange-deep font-mono">{p.modelName}</div>
                      <h4 className="text-[13px] font-medium text-rk-ink m-0 mt-0.5">{p.name}</h4>
                      <div className="text-[14px] text-rk-orange-deep font-medium mt-1">
                        🎁 {p.giftLabel}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] text-rk-muted">월</div>
                      <b className="text-[14px] text-rk-ink tracking-[-.02em] rk-num">{fmt(p.rentalPrice)}원</b>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Partner-specific custom event */}
        <section className="bg-white px-4 py-4 border-b-8 border-rk-soft">
          <h3 className="text-[14px] font-semibold text-rk-ink mb-2">🎯 {partner.partnerName} 자체 이벤트</h3>
          <div className="bg-rk-tint-green rounded-md p-3 border border-[#C8E5D6]">
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-success text-white font-medium">상시</span>
              <span className="text-[12px] text-rk-success">{partner.partnerName} 한정</span>
            </div>
            <h4 className="text-[14px] font-semibold text-rk-success m-0 mb-1">친구 초대 시 5,000원 적립</h4>
            <p className="text-[14px] text-rk-text leading-[1.5] m-0">
              지인에게 추천 후 신규 가입이 완료되면 가입 첫 달 렌탈료에서 5,000원 즉시 차감됩니다.
            </p>
          </div>
        </section>

        {/* No-event placeholder */}
        {giftEvents.length === 0 && installEvents.length === 0 && (
          <section className="bg-white px-4 py-8 text-center">
            <div className="text-[14px] text-rk-muted">
              현재 운영 중인 사은품 이벤트가 없습니다.
            </div>
            <Link href={`/p/${partner.partnerCode}/products`} className="text-[14px] text-rk-info underline">
              전체 상품 보기 →
            </Link>
          </section>
        )}

        <PartnerFooter partner={partner} />
        <PartnerCta partner={partner} />
      </div>
    </div>
  );
}
