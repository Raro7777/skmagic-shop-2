import Link from "next/link";
import { notFound } from "next/navigation";
import ConsultForm from "@/components/consumer/ConsultForm";
import UtmTracker from "@/components/consumer/UtmTracker";
import ProductGallery from "@/components/consumer/ProductGallery";
import ProductThumb from "@/components/consumer/ProductThumb";
import PriceConfigurator from "@/components/consumer/PriceConfigurator";
import ProductContentImages from "@/components/consumer/ProductContentImages";
import { getPartnerProductDetail, type ConsumerProduct } from "@/lib/partnerSite";
import { prisma } from "@/lib/prisma";

// 영업자 컨텍스트(?s=)의 partnerCommission · 렌탈지원금 계산이 즉시 반영되도록 강제 동적.
export const dynamic = "force-dynamic";
export const revalidate = 0;
import { SK_MAGIC_LOGO } from "@/lib/constants/assets";
import { HQ_HOTLINE } from "@/lib/constants/hq";
import { rawAnchorHtml } from "@/lib/naverConvButton";
import KakaoFab from "@/components/consumer/KakaoFab";

const fmt = (n: number) => n.toLocaleString("ko-KR");

const CATEGORY_LABEL: Record<string, string> = {
  water:    "정수기",
  bidet:    "비데",
  air:      "공기청정기",
  mattress: "매트리스",
  massage:  "안마의자",
};

const PRODUCT_BG: Record<string, string> = {
  water:    "linear-gradient(160deg,#D8E2F0,#A4B4D0)",
  bidet:    "linear-gradient(160deg,#F0E5DA,#D6BFA8)",
  air:      "linear-gradient(160deg,#E5EAEF,#B8C2CD)",
  mattress: "linear-gradient(160deg,#DEE5F0,#A8B5CC)",
  massage:  "linear-gradient(160deg,#F0E8E0,#D0BFAE)",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerCode: string; productCode: string }>;
}) {
  const { partnerCode, productCode } = await params;
  const detail = await getPartnerProductDetail(partnerCode, productCode);
  if (!detail) return { title: "Not Found" };
  return {
    title: `${detail.name} (${detail.modelName}) · ${detail.partner.partnerName}`,
    description: detail.giftLabel
      ? `월 ${fmt(detail.rentalPrice)}원 · ${detail.partner.partnerName} 단독 사은품 ${detail.giftLabel}`
      : `월 ${fmt(detail.rentalPrice)}원 · ${detail.managementType}`,
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerCode: string; productCode: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { partnerCode, productCode } = await params;
  const { s: sellerCode } = await searchParams;
  // 영업자 컨텍스트면 sellerCode 전달 — partnerCommission 에서 sellerMargin 추가 차감되어
  // PriceConfigurator 의 maxRentalSupport 가 영업자 cap 으로 정확히 계산됨.
  const detail = await getPartnerProductDetail(partnerCode, productCode, sellerCode ? { sellerCode } : undefined);
  if (!detail) notFound();

  // Resolve seller (if any) for the form
  const seller = sellerCode
    ? await prisma.seller.findUnique({
        where: { partnerId_sellerCode: { partnerId: partnerCode, sellerCode } },
      })
    : null;
  const sellerInfo = seller && seller.status === "active"
    ? {
        sellerCode: seller.sellerCode,
        name: seller.name,
        phone: seller.phone,
      }
    : null;
  // 전화는 영업자 본인 번호 우선, 카톡은 항상 점 대표 채널
  const effectivePhone = sellerInfo?.phone?.trim() || detail.partner.hotlineNumber;

  const { partner } = detail;
  const categoryLabel = CATEGORY_LABEL[detail.category] ?? detail.category;
  const productBg = PRODUCT_BG[detail.category] ?? PRODUCT_BG.water;

  return (
    <div className="bg-rk-soft-2 min-h-screen flex justify-center items-start gap-6 max-md:p-0 md:py-8">
      <UtmTracker />
      {/* Left dev sidebar */}
      <aside className="hidden w-[220px] sticky top-8 text-[14px] text-rk-muted leading-[1.65]">
        <h6 className="text-[13px] text-rk-faint tracking-[.12em] uppercase mb-2">분양 사이트</h6>
        <b className="text-rk-ink block">{partner.partnerName}</b>
        <small className="block text-rk-muted">{partner.brandLabel}</small>

        <h6 className="text-[13px] text-rk-faint tracking-[.12em] uppercase mt-4 mb-2">이동</h6>
        <Link href={`/p/${partner.partnerCode}`} className="block py-1.5 border-b border-rk-line-2 text-rk-info no-underline text-[14px]">← {partner.partnerName} 홈</Link>
        <Link href="/" className="block py-1.5 border-b border-rk-line-2 text-rk-info no-underline text-[14px]">허브로</Link>

        <div className="bg-white border border-rk-line p-2.5 rounded-lg mt-3 text-[13px]">
          <b className="text-rk-ink">상품 상세</b><br />
          가격은 <b>전국 동일</b>이지만 <b className="text-rk-orange-deep">사은품/할인 혜택</b>은 협력점마다 다릅니다.
          이 페이지의 사은품은 {partner.partnerName} 전용입니다.
        </div>
      </aside>

      {/* Device frame */}
      <div className="w-full md:w-[390px] bg-white md:rounded-[32px] md:shadow-[0_8px_24px_rgba(20,25,40,.08)] overflow-hidden md:border-8 md:border-[#1A1D24]">
        <div className="hidden md:flex bg-white h-9 items-center justify-between px-[22px] text-[14px] font-semibold">
          <span className="rk-num">9:41</span>
          <span>● ●</span>
        </div>

        {/* Compact header — back + brand + cart */}
        <header className="bg-white border-b border-rk-line">
          <div className="flex items-center px-3 py-3 gap-2">
            <Link href={`/p/${partner.partnerCode}`} className="text-[20px] text-rk-ink no-underline">←</Link>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <img src={SK_MAGIC_LOGO} alt="SK magic" className="h-[32px] w-auto shrink-0" />

              <div className="min-w-0">
                {/* CONSUMER_BRAND_NAME 정책상 partnerName 과 brandLabel 이 동일 값이라 2줄 중복.
                    1줄로 통합 — partnerName 하나만 노출. */}
                <div className="font-bold text-[14px] text-rk-ink leading-tight truncate">{partner.partnerName}</div>
              </div>
            </div>
            <div className="flex gap-3 text-base text-rk-ink shrink-0">
              <Link href={`/p/${partner.partnerCode}/search`} className="text-rk-ink no-underline cursor-pointer">🔍</Link>
              <span className="cursor-pointer">🛒</span>
            </div>
          </div>
        </header>

        {/* Breadcrumb */}
        <nav className="px-4 py-2 text-[13px] text-rk-muted bg-white border-b border-rk-line-2 flex gap-1.5 items-center">
          <Link href={`/p/${partner.partnerCode}`} className="text-rk-muted no-underline">홈</Link>
          <span>›</span>
          <span>{categoryLabel}</span>
          <span>›</span>
          <b className="text-rk-ink truncate">{detail.modelName}</b>
        </nav>

        {/* Image gallery (multi-image with thumbs, fallback to gradient).
            중복 이미지 URL 제거 — 본사 카탈로그 데이터에서 imageUrls[0] 과 imageUrl 이
            같은 경우가 있어 썸네일에 동일 이미지 2번 노출되던 문제. */}
        <ProductGallery
          images={Array.from(new Set((detail.imageUrls ?? []).filter(Boolean)))}
          fallbackBg={productBg}
          fallbackBadges={
            <>
              {/* 큰 배지 — 본사 카탈로그 스타일. 반값 정책 있는 모델 + 관리방식 강조 */}
              {detail.rivalHalfMonths > 0 && (
                <span className="w-14 h-14 grid place-items-center rounded-lg bg-rk-sale text-white text-[13px] font-extrabold leading-[1.1] text-center px-1 shadow-md">
                  {detail.rivalHalfMonths}개월<br />반값
                </span>
              )}
              <span className="w-14 h-14 grid place-items-center rounded-lg bg-rk-navy text-white text-[13px] font-semibold leading-[1.1] text-center px-1 shadow-md">
                {detail.managementType.includes("자가") || detail.managementType.includes("셀프") ? (
                  <>셀프<br />관리</>
                ) : (
                  <>방문<br />관리</>
                )}
              </span>
              {/* 보조 작은 칩 — 사은품/설치비/MD추천 */}
              <div className="flex flex-col gap-1 mt-1">
                {detail.isFeatured && <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-info text-white font-semibold">MD추천</span>}
                {detail.giftLabel && <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-orange text-white font-semibold">사은품</span>}
                {detail.installFreed && <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-success text-white font-semibold">설치비 면제</span>}
              </div>
            </>
          }
        />

        {/* Title */}
        <section className="bg-white px-4 pt-4 pb-3 border-b border-rk-line">
          <div className="text-[13px] text-rk-muted mb-1">SK매직</div>
          <h1 className="text-[18px] font-bold leading-[1.35] text-rk-ink m-0 tracking-[-.02em]">{detail.name}</h1>
          <div className="text-[13px] text-rk-faint font-mono mt-1">모델 {detail.modelName} · 의무 {detail.contractPeriod}개월 · {detail.managementType}</div>
        </section>

        {/* Price block — 운영방식·약정기간·타사보상·색상·렌탈지원금 동적 */}
        <PriceConfigurator
          productCode={detail.productCode}
          defaultRental={detail.rentalPrice}
          defaultCard={detail.cardDiscountPrice}
          defaultContract={detail.contractPeriod}
          defaultManagement={detail.managementType}
          priceMatrix={detail.priceMatrix}
          rivalCompensation={detail.rivalCompensation}
          colorOptions={(detail.specs?.["색상"] ?? "").split(",").map(s => s.trim()).filter(Boolean)}
          partnerRentalSupportAmount={detail.partnerRentalSupportAmount}
          partnerRentalSupportEnabled={detail.partnerRentalSupportEnabled}
          partnerGiftAmount={detail.giftAmount}
          partnerInstallAmount={detail.partnerInstallAmount}
        />

        {/* 타사보상 흐름 안내 — 3단계 시각화 (사용자 보고: 타사보상 설명 부족) */}
        <section className="bg-rk-tint-orange border-y border-[#F4DCC9] px-4 py-3.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[18px]">🔄</span>
            <b className="text-[14px] text-rk-orange-deep">타사보상 신청 절차 (3단계로 끝)</b>
          </div>
          <ol className="m-0 pl-0 list-none flex gap-2 text-[12px]">
            <li className="flex-1 bg-white rounded-md p-2 border border-[#F4DCC9]">
              <div className="font-bold text-rk-orange-deep mb-0.5">① 타사 사용 인증</div>
              <div className="text-rk-text leading-[1.45]">현재 사용 중인 타사 정수기·공기청정기·비데 사진 또는 약정서 1장</div>
            </li>
            <li className="flex-1 bg-white rounded-md p-2 border border-[#F4DCC9]">
              <div className="font-bold text-rk-orange-deep mb-0.5">② 설치 진행</div>
              <div className="text-rk-text leading-[1.45]">기존 제품 철거 + 신규 SK매직 설치 (1회 방문 처리)</div>
            </li>
            <li className="flex-1 bg-white rounded-md p-2 border border-[#F4DCC9]">
              <div className="font-bold text-rk-orange-deep mb-0.5">③ 혜택 즉시 지급</div>
              <div className="text-rk-text leading-[1.45]">반값할인 월 요금 + 가입 혜택 자동 적용</div>
            </li>
          </ol>
          <small className="text-[11px] text-rk-orange-deep block mt-2 opacity-90">
            ⓘ 위 &apos;타사보상 적용&apos; 토글을 켜면 적용된 월 요금이 즉시 반영됩니다.
          </small>
        </section>

        {/* 월 렌탈가 하단 — 상담신청 버튼 (항목 7) */}
        <section className="bg-white px-4 py-3 border-b-8 border-rk-soft">
          <ConsultForm
            partnerCode={partner.partnerCode}
            partnerName={partner.partnerName}
            sellerCode={sellerInfo?.sellerCode}
            sellerName={sellerInfo?.name}
            defaultProductCode={detail.productCode}
            defaultProductLabel={detail.name}
            buttonLabel="✍ 상담 신청하기"
            buttonClassName="block w-full text-center py-3 rounded-md bg-rk-orange hover:bg-rk-orange-deep text-white font-bold text-[15px] border-0 cursor-pointer transition-colors"
          />
        </section>

        {/* Differentiation banner — partner-specific */}
        {(detail.giftAmount > 0 && detail.giftLabel) && (
          <section className="bg-rk-tint-orange border-y border-[#F4DCC9] px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-rk-orange text-white text-[12px] font-semibold px-1.5 py-0.5 rounded">단독 혜택</span>
              <small className="text-[13px] text-rk-orange-deep font-medium">{partner.partnerName} 한정</small>
            </div>
            <div className="text-[14px] text-rk-orange-deep font-semibold">
              🎁 사은품 <b>{detail.giftLabel}</b> 증정
            </div>
            <small className="block text-[12px] text-rk-muted mt-0.5">
              가입 후 5/19까지 발송 · 가구당 1개 한정
            </small>
          </section>
        )}

        {/* 본문 마케팅 이미지 — SK매직 상세 페이지 캡쳐 (Blob 영구 저장) */}
        <ProductContentImages images={detail.contentImages} />

        {/* Description — long-form copy */}
        {detail.description && (
          <section className="bg-white px-4 py-4 border-b-8 border-rk-soft">
            <h3 className="text-[14px] font-semibold mb-2.5 text-rk-ink">상품 소개</h3>
            <div className="text-[14px] text-rk-text leading-[1.75]">
              {detail.description.split(/\n\n+/).filter(Boolean).map((para, i) => (
                <p key={i} className="m-0 mb-2.5 last:mb-0 whitespace-pre-line">{para}</p>
              ))}
            </div>
          </section>
        )}

        {/* Key features (selling points) */}
        {detail.keyFeatures.length > 0 && (
          <section className="bg-white px-4 py-4 border-b-8 border-rk-soft">
            <h3 className="text-[14px] font-semibold mb-2.5 text-rk-ink">핵심 셀링포인트</h3>
            <ul className="grid grid-cols-1 gap-1.5 m-0 p-0 list-none">
              {detail.keyFeatures.map((f, i) => (
                <li key={i} className="flex gap-2 items-start text-[14px] text-rk-text leading-[1.55]">
                  <span className="text-rk-orange shrink-0 font-bold">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 본문 중간 상담 유도 CTA — 사용자 보고: 상담 유도 영역 강화 */}
        <section className="bg-rk-tint-blue border-y border-[#D8E4F4] px-4 py-4 text-center">
          <b className="text-[15px] text-rk-info block mb-1">🚀 지금 상담 신청 시 30분내 답변</b>
          <div className="text-[12px] text-rk-muted mb-2.5">설치 일정 · 카드할인 · 사은품 혜택 즉시 확인</div>
          <ConsultForm
            partnerCode={partner.partnerCode}
            partnerName={partner.partnerName}
            sellerCode={sellerInfo?.sellerCode}
            sellerName={sellerInfo?.name}
            defaultProductCode={detail.productCode}
            defaultProductLabel={detail.name}
            buttonLabel="✍ 상담 신청하기 →"
            buttonClassName="inline-block bg-rk-orange hover:bg-rk-orange-deep text-white py-2.5 px-6 rounded-md font-bold text-[14px] border-0 cursor-pointer shadow-sm"
          />
        </section>

        {/* Spec table — combine DB specs with platform-level metadata */}
        <section className="bg-white px-4 py-4 border-b-8 border-rk-soft">
          <h3 className="text-[14px] font-semibold mb-2.5 text-rk-ink">사양 정보</h3>
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[14px]">
            {Object.entries(detail.specs).map(([k, v]) => (
              <SpecRow key={k} label={k} value={String(v)} />
            ))}
            {/* Platform-level fields appended at the bottom */}
            <div className="col-span-2 border-t border-rk-line-2 mt-1 pt-1.5" />
            <SpecRow label="모델번호"      value={detail.modelName} mono />
            <SpecRow label="카테고리"      value={categoryLabel} />
            <SpecRow label="의무사용기간"  value={`${detail.contractPeriod}개월 (${(detail.contractPeriod / 12).toFixed(1).replace(/\.0$/, "")}년)`} />
            <SpecRow label="관리방식"      value={detail.managementType} />
            <SpecRow label="무상 보증"     value={`${detail.warrantyMonths}개월`} />
            <SpecRow label="설치비"        value={detail.installFreed ? "협력점 부담 (무료)" : "30,000원 별도"} />
            <SpecRow label="중도해지 위약금" value="잔여기간 렌탈료의 35%" />
            <SpecRow label="A/S"           value="제조사 SK매직㈜ 직영" />
          </dl>
        </section>

        {/* Bundled benefits (auto-generated from policy + management type) */}
        <section className="bg-white px-4 py-4 border-b-8 border-rk-soft">
          <h3 className="text-[14px] font-semibold mb-2 text-rk-ink">포함 혜택</h3>
          <ul className="text-[14px] leading-[1.7] m-0 pl-5 list-disc text-rk-text">
            <li>전국 무료 설치 (방문일 협의)</li>
            <li>{detail.managementType.includes("자가") ? "필터 자가교체 안내 키트" : "정기 방문관리 (점검·필터교체 포함)"}</li>
            <li>제조사 보증 {detail.warrantyMonths}개월</li>
            {detail.giftLabel && (
              <li className="text-rk-orange-deep font-medium">
                {partner.partnerName} 단독 사은품 — {detail.giftLabel}
              </li>
            )}
            {detail.installFreed && (
              <li className="text-rk-success font-medium">설치비 면제 (협력점 부담)</li>
            )}
          </ul>
        </section>

        {/* FAQ */}
        <section className="bg-white px-4 py-3 border-b-8 border-rk-soft">
          <h3 className="text-[14px] font-semibold mb-2 text-rk-ink">자주 묻는 질문</h3>
          <div className="flex flex-col gap-2.5">
            <FaqItem
              q="의무사용기간은 어떻게 되나요?"
              a={`${detail.contractPeriod}개월(${detail.contractPeriod / 12}년)입니다. 이 기간 내 중도해지 시 잔여기간 렌탈료의 35% 위약금이 발생합니다.`}
            />
            <FaqItem
              q="이사 시 이전설치 가능한가요?"
              a="가능합니다. 고객센터로 연락 주시면 일정 협의 후 SK매직 본사에서 이전설치를 진행합니다 (자가관리는 무료, 방문관리는 일부 비용 발생)."
            />
            <FaqItem
              q="환불은 가능한가요?"
              a="설치 전 14일 이내라면 100% 환불 가능합니다. 설치 후에는 위약금이 적용됩니다."
            />
            <FaqItem
              q="제휴카드 할인은 어떻게 받나요?"
              a="신청 시 제휴 카드를 신규 발급하시면 매월 자동 차감됩니다. 카드 발급은 무료, 연회비는 카드사에 따라 다릅니다."
            />
          </div>
        </section>

        {/* Reviews — DB-back */}
        <section className="bg-white px-4 py-3 border-b-8 border-rk-soft">
          <div className="flex items-baseline mb-2">
            <h3 className="text-[14px] font-semibold text-rk-ink">가입 후기</h3>
            <Link href={`/p/${partner.partnerCode}/reviews?code=${detail.productCode}`} className="ml-auto text-[13px] text-rk-info no-underline">전체 보기 →</Link>
          </div>
          {detail.reviews.count > 0 ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-rk-warn text-[14px]">{"★".repeat(Math.round(detail.reviews.avgRating))}{"☆".repeat(5 - Math.round(detail.reviews.avgRating))}</div>
                <b className="text-[13px] text-rk-ink rk-num">{detail.reviews.avgRating.toFixed(1)}</b>
                <span className="text-[13px] text-rk-muted">후기 {detail.reviews.count}건</span>
                {detail.reviews.verifiedCount > 0 && (
                  <span className="text-[12px] px-1.5 py-px rounded bg-rk-tint-green text-rk-success font-medium">✓ 가입 인증 {detail.reviews.verifiedCount}건</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {detail.reviews.top.map(r => (
                  <article key={r.id} className="bg-rk-soft-2 rounded-md p-3 text-[14px] leading-[1.5] flex gap-2.5">
                    {r.installPhotoUrl && (
                      <img src={r.installPhotoUrl} alt="" className="w-[80px] h-[80px] object-cover rounded shrink-0 border border-rk-line" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
                        <span className="text-rk-warn text-[14px]">{"★".repeat(r.rating)}</span>
                        <b className="text-rk-ink">{r.customerName}</b>
                        {r.region && <span className="text-[12px] text-rk-muted">· {r.region}</span>}
                        {r.isVerified && <span className="text-[9px] px-1 py-px rounded bg-rk-tint-green text-rk-success font-medium">가입 인증</span>}
                        {r.selectedMode && <span className="text-[9px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">{r.selectedMode}</span>}
                        {r.selectedContractPeriod && <span className="text-[9px] px-1 py-px rounded bg-rk-soft text-rk-muted">{r.selectedContractPeriod}개월</span>}
                        <small className="ml-auto text-rk-faint">{r.daysAgo === 0 ? "오늘" : `${r.daysAgo}일 전`}</small>
                      </div>
                      {r.title && <div className="font-medium text-rk-ink mb-0.5">&quot;{r.title}&quot;</div>}
                      <p className="text-rk-text m-0">{r.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-rk-soft-2 rounded-md p-4 text-center text-[14px] text-rk-muted">
              아직 등록된 후기가 없습니다. 가입 후 첫 후기를 남겨보세요!
            </div>
          )}
        </section>

        {/* Related */}
        {detail.related.length > 0 && (
          <section className="bg-white px-4 py-3 border-b-8 border-rk-soft">
            <h3 className="text-[14px] font-semibold mb-2 text-rk-ink">같은 카테고리 상품</h3>
            <div className="grid grid-cols-2 gap-3">
              {detail.related.map(r => (
                <RelatedCard key={r.productCode} partnerCode={partner.partnerCode} product={r} />
              ))}
            </div>
          </section>
        )}

        {/* Inline CTA section */}
        <section className="bg-white px-4 py-5">
          <h3 className="text-[14px] font-semibold mb-1 text-rk-ink">지금 바로 상담 신청</h3>
          <p className="text-[13px] text-rk-muted m-0 mb-3">접수 후 30분 이내 카톡 또는 전화로 연락드립니다.</p>
          <ConsultForm
            partnerCode={partner.partnerCode}
            partnerName={partner.partnerName}
            sellerCode={sellerInfo?.sellerCode}
            sellerName={sellerInfo?.name}
            defaultProductCode={detail.productCode}
            defaultProductLabel={detail.name}
            buttonLabel="✍ 이 상품 상담 신청"
            buttonClassName="w-full bg-rk-orange hover:bg-rk-orange-deep text-white py-3 rounded-lg font-semibold text-[13px] flex gap-1.5 items-center justify-center cursor-pointer border-0 transition-colors"
          />
        </section>

        {/* Footer */}
        <footer className="bg-rk-soft px-3.5 py-4 text-[13px] text-rk-muted leading-[1.7]">
          {partner.brandGuardVideoUrl && (
            <div className="mb-3">
              <video src={partner.brandGuardVideoUrl} autoPlay loop muted playsInline aria-label="SK매직 정품 인증 BRAND GUARD" className="w-full max-w-[360px] mx-auto block rounded-md" />
            </div>
          )}
          <div className="flex gap-2.5 flex-wrap mb-2.5 text-[13px]">
            <Link href="/legal/terms" className="text-rk-ink font-semibold no-underline cursor-pointer">이용약관</Link>
            <Link href="/legal/privacy" className="text-rk-ink font-semibold no-underline cursor-pointer">개인정보처리방침</Link>
            <Link href={`/p/${partner.partnerCode}/help`} className="text-rk-text no-underline cursor-pointer">고객센터</Link>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 m-0">
            <dt className="text-rk-faint m-0">상호</dt><dd className="m-0">{partner.companyName}</dd>
            {partner.hotlineNumber && partner.hotlineNumber !== HQ_HOTLINE && (
              <><dt className="text-rk-faint m-0">고객센터</dt><dd className="m-0 rk-num">{partner.hotlineNumber}</dd></>
            )}
            {partner.businessNumber && <><dt className="text-rk-faint m-0">사업자</dt><dd className="m-0 rk-num">{partner.businessNumber}</dd></>}
          </dl>
        </footer>

        <KakaoFab kakaoChannelUrl={partner.kakaoChannelUrl} partnerName={partner.partnerName} />
        {/* Sticky bottom CTA — 네이버 진단 도구용 onmousedown 정적 속성 (raw HTML) */}
        <div className="sticky bottom-0 px-3.5 py-2.5 bg-white border-t border-rk-line flex gap-2 items-center z-10">
          <span
            dangerouslySetInnerHTML={{
              __html: rawAnchorHtml({
                href: `tel:${effectivePhone.replace(/\D/g, "")}`,
                conv: "custom001",
                className: "bg-rk-soft hover:bg-rk-line text-rk-ink px-3 py-3 rounded-lg font-semibold text-[14px] no-underline cursor-pointer flex items-center justify-center",
                title: `전화 ${effectivePhone}`,
                innerHtml: "📞",
              }),
            }}
          />
          {partner.kakaoChannelUrl ? (
            <span
              dangerouslySetInnerHTML={{
                __html: rawAnchorHtml({
                  href: partner.kakaoChannelUrl,
                  conv: "custom002",
                  target: "_blank",
                  rel: "noreferrer",
                  className: "bg-[#FEE500] hover:bg-[#F4DC00] text-[#1A1D24] px-3 py-3 rounded-lg font-semibold text-[14px] no-underline cursor-pointer flex items-center justify-center",
                  title: `${partner.partnerName} 카톡채널`,
                  innerHtml: "💬",
                }),
              }}
            />
          ) : (
            <span
              dangerouslySetInnerHTML={{
                __html: rawAnchorHtml({
                  href: `tel:${effectivePhone.replace(/\D/g, "")}`,
                  conv: "custom001",
                  className: "bg-[#FEE500] hover:bg-[#F4DC00] text-[#1A1D24] px-3 py-3 rounded-lg font-semibold text-[14px] no-underline cursor-pointer flex items-center justify-center",
                  title: "카톡 채널 미설정 — 전화로 연결",
                  innerHtml: "💬",
                }),
              }}
            />
          )}
          <ConsultForm
            partnerCode={partner.partnerCode}
            partnerName={partner.partnerName}
            sellerCode={sellerInfo?.sellerCode}
            sellerName={sellerInfo?.name}
            defaultProductCode={detail.productCode}
            defaultProductLabel={detail.name}
            buttonLabel="✍ 상담 신청하기"
            buttonClassName="flex-1 bg-rk-orange hover:bg-rk-orange-deep text-white py-3 rounded-lg font-semibold text-[13px] cursor-pointer border-0 transition-colors"
          />
        </div>
      </div>

      {/* Right side — partner-specific upsell */}
      <aside className="hidden w-[220px] sticky top-8 text-[14px] text-rk-muted leading-[1.65]">
        <h6 className="text-[13px] text-rk-faint tracking-[.12em] uppercase mb-2">이 협력점의 차별화</h6>
        {detail.giftAmount > 0 && detail.giftLabel ? (
          <div className="bg-rk-tint-orange border border-[#F4DCC9] rounded-md p-2.5">
            <b className="text-rk-orange-deep block">🎁 {detail.giftLabel}</b>
            <small className="text-rk-orange-deep">대당 -₩{fmt(detail.giftAmount)} 환원 (본사 수수료 차감)</small>
          </div>
        ) : (
          <div className="bg-rk-soft-2 rounded-md p-2.5 text-rk-muted">
            이 상품은 사은품 정책 미설정. 다른 모델 또는 다른 협력점에서 사은품을 받을 수 있습니다.
          </div>
        )}

        <h6 className="text-[13px] text-rk-faint tracking-[.12em] uppercase mt-4 mb-2">관련 상품</h6>
        {detail.related.slice(0, 3).map(r => (
          <Link
            key={r.productCode}
            href={`/p/${partner.partnerCode}/products/${r.productCode}`}
            className="block py-1.5 border-b border-rk-line-2 text-rk-info no-underline text-[14px]"
          >
            {r.modelName} →
          </Link>
        ))}
      </aside>
    </div>
  );
}

/* ============ Sub-components ============ */
function SpecRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-rk-muted m-0">{label}</dt>
      <dd className={"text-rk-ink m-0 " + (mono ? "font-mono" : "")}>{value}</dd>
    </>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-rk-soft-2 rounded-md p-3 border border-rk-line-2">
      <summary className="cursor-pointer list-none flex items-center justify-between text-[14px] font-medium text-rk-ink">
        <span>Q. {q}</span>
        <span className="text-rk-muted text-[13px] group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <p className="text-[13px] text-rk-text leading-[1.6] mt-2 m-0 pl-3 border-l-2 border-rk-line">{a}</p>
    </details>
  );
}

function RelatedCard({ partnerCode, product }: { partnerCode: string; product: ConsumerProduct }) {
  const bg = PRODUCT_BG[product.category] ?? PRODUCT_BG.water;
  return (
    <Link
      href={`/p/${partnerCode}/products/${product.productCode}`}
      className="no-underline text-inherit cursor-pointer"
    >
      <ProductThumb imageUrl={product.imageUrl} alt={product.name} fallbackBg={bg}>
        {product.giftLabel && (
          <span className="text-[9px] px-1 py-px rounded text-white font-semibold bg-rk-orange">사은품</span>
        )}
      </ProductThumb>
      <h4 className="text-[14px] font-medium text-rk-ink leading-[1.4] m-0 mt-2">{product.name}</h4>
      <div className="text-[12px] text-rk-faint font-mono mt-0.5">{product.modelName}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <small className="text-[12px] text-rk-muted">월</small>
        <b className="text-[14px] font-bold tracking-[-.02em] text-rk-ink rk-num">{fmt(product.rentalPrice)}원~</b>
      </div>
      {product.giftLabel && (
        <div className="text-[12px] text-rk-orange-deep font-medium mt-0.5">🎁 {product.giftLabel}</div>
      )}
    </Link>
  );
}
