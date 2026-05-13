import Link from "next/link";
import type { HeroSlideProduct } from "@/lib/partnerHero";

const fmt = (n: number) => n.toLocaleString("ko-KR");

/**
 * Hero 바로 아래에 들어가는 보조 섹션들 — 단조로움 해소를 위해 정보 밀도 ↑.
 *  1) NewModelsShowcase: 신모델 큰 카드 듀얼
 *  2) RivalCompensationBanner: 풀폭 띠 (타사보상)
 *  3) GiftCampaignStrip: 카운트다운 + 사은품
 */

export function NewModelsShowcase({ slides, partnerCode }: { slides: HeroSlideProduct[]; partnerCode: string }) {
  const news = slides.filter(s => s.badge === "5월 신모델");
  if (news.length === 0) return null;

  return (
    <section className="bg-white border-t border-rk-line">
      <div className="max-w-[1280px] mx-auto px-6 py-10">
        <div className="flex items-baseline mb-5">
          <span className="bg-rk-orange text-white text-[10px] font-semibold px-2 py-0.5 rounded mr-2 tracking-[.04em]">NEW</span>
          <h2 className="text-[22px] font-bold tracking-[-.02em] text-rk-ink">이번 달 신모델 2종</h2>
          <small className="ml-2 text-[12px] text-rk-muted">SK매직 본사 5월 출시</small>
          <Link href={`/preview/p/${partnerCode}/products`} className="ml-auto text-[12px] text-rk-info no-underline hover:underline">
            전체 신모델 보기 →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-5">
          {news.slice(0, 2).map(p => (
            <Link
              key={p.productCode}
              href={`/preview/p/${partnerCode}/products/${p.productCode}`}
              className="group block bg-gradient-to-br from-rk-soft-2 to-white border border-rk-line rounded-xl p-5 hover:border-rk-orange hover:shadow-xl transition-all no-underline grid grid-cols-[1fr_1.2fr] gap-4 items-center"
            >
              {/* 이미지 영역 — heroImage(Blob) 우선 */}
              {(() => {
                const big = p.heroImage ?? p.imageUrl;
                return (
                  <div className="relative">
                    <span className="absolute top-2 left-2 bg-rk-orange text-white text-[10px] font-bold px-2 py-0.5 rounded shadow z-10">NEW</span>
                    {big ? (
                      <div className="aspect-square bg-white rounded-lg overflow-hidden border border-rk-line-2 relative">
                        <img src={big} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-square bg-white rounded-lg grid place-items-center text-[48px] text-rk-faint border border-rk-line-2">📦</div>
                    )}
                  </div>
                );
              })()}
              {/* 정보 */}
              <div>
                <small className="block text-[10px] uppercase tracking-[.08em] text-rk-orange font-semibold mb-1">5월 신출시</small>
                <h3 className="text-[18px] font-bold text-rk-ink leading-[1.3] tracking-[-.02em] m-0 mb-1">{p.name}</h3>
                <small className="block text-[10px] text-rk-faint font-mono mb-2">{p.productCode}</small>

                <div className="border-t border-rk-line-2 pt-2 space-y-1">
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="text-rk-muted">월 렌탈</span>
                    <b className="text-[18px] text-rk-ink rk-num">₩{fmt(p.cardDiscountPrice ?? p.rentalPrice)}</b>
                  </div>
                  {p.rivalCompensationPrice != null && (
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className="text-rk-orange-deep">타사보상</span>
                      <b className="text-[15px] text-rk-orange-deep rk-num">₩{fmt(p.rivalCompensationPrice)}</b>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1 text-[11px] text-rk-info font-medium group-hover:text-rk-orange">
                  상품 자세히 →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RivalCompensationBanner({ slides, partnerCode }: { slides: HeroSlideProduct[]; partnerCode: string }) {
  const rivalCount = slides.filter(s => s.rivalCompensationPrice != null).length;
  const bestRival = slides
    .filter(s => s.rivalCompensationPrice != null)
    .sort((a, b) => (b.rentalPrice - (b.rivalCompensationPrice ?? 0)) - (a.rentalPrice - (a.rivalCompensationPrice ?? 0)))[0];
  if (!bestRival) return null;
  const maxSavings = bestRival.rentalPrice - (bestRival.rivalCompensationPrice ?? 0);

  return (
    <section className="bg-gradient-to-r from-[#2a1b3d] via-[#3d2151] to-[#2a1b3d] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-[#A78BFA] rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-[1280px] mx-auto px-6 py-7 flex items-center gap-5 flex-wrap">
        <div className="text-[44px]">🔄</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[.08em] text-[#C4B5FD] font-semibold mb-1">5월 타사보상 캠페인</div>
          <h3 className="text-[22px] font-bold leading-[1.25] tracking-[-.02em] m-0">
            기존 가전 쓰시던 분, <span className="text-[#C4B5FD]">월 최대 ₩{fmt(maxSavings)} 추가 할인</span>
          </h3>
          <small className="block text-[12px] text-white/70 mt-1">
            타사 정수기·공청·비데 영수증 1장이면 가입 즉시 적용. 카드할인은 별개로 추가. 대상 모델 {fmt(rivalCount)}+종.
          </small>
        </div>
        <Link
          href={`/preview/p/${partnerCode}/products`}
          className="bg-[#A78BFA] hover:bg-[#9170E8] text-[#1f1530] px-5 py-2.5 rounded-md text-[13px] font-bold no-underline transition-colors shadow-lg whitespace-nowrap"
        >
          타사보상 대상 보기 →
        </Link>
      </div>
    </section>
  );
}

export function GiftCampaignStrip({
  slides,
  partnerName,
}: {
  slides: HeroSlideProduct[];
  partnerName: string;
}) {
  const giftSlide = slides.find(s => s.badge === "단독 사은품" && s.giftAmount > 0);
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = Math.max(0, Math.ceil((monthEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  if (!giftSlide) return null;

  return (
    <section className="bg-rk-tint-orange border-y border-rk-orange/30 text-rk-orange-deep">
      <div className="max-w-[1280px] mx-auto px-6 py-5 flex items-center gap-5 flex-wrap">
        <div className="text-[36px]">🎁</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[.06em] font-semibold mb-1">{partnerName} 단독</div>
          <h3 className="text-[17px] font-bold leading-[1.3] m-0 text-rk-ink">
            {giftSlide.giftLabel ?? "사은품"} <span className="text-rk-orange-deep">— ₩{fmt(giftSlide.giftAmount)} 상당 무료</span>
          </h3>
          <small className="block text-[11px] text-rk-orange-deep/80 mt-0.5">
            가입 후 5일 내 발송 · 가구당 1개 한정 · 본사 표준 상품 외 협력점 자체 부담
          </small>
        </div>
        <div className="bg-white rounded-md px-4 py-2 text-center border border-rk-orange/30">
          <small className="block text-[10px] uppercase tracking-[.06em] text-rk-orange-deep font-semibold">이번 달 마감</small>
          <b className="text-[22px] font-bold tracking-[-.02em] text-rk-orange-deep rk-num leading-none">D-{daysLeft}</b>
        </div>
      </div>
    </section>
  );
}
