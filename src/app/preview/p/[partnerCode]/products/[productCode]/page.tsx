import Link from "next/link";
import { notFound } from "next/navigation";
import PartnerShellPC from "@/components/preview/PartnerShellPC";
import PriceConfiguratorPC from "@/components/preview/PriceConfiguratorPC";
import ConsultForm from "@/components/consumer/ConsultForm";
import { getPartnerProductDetail, getPartnerSite, type ProductContentImage } from "@/lib/partnerSite";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ partnerCode: string; productCode: string }> }) {
  const { partnerCode, productCode } = await params;
  const detail = await getPartnerProductDetail(partnerCode, productCode);
  if (!detail) return { title: "Not Found" };
  return { title: `${detail.name} · ${detail.partner.partnerName} (PREVIEW PC)` };
}

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default async function ProductDetailPCPreview({ params }: { params: Promise<{ partnerCode: string; productCode: string }> }) {
  const { partnerCode, productCode } = await params;
  const [detail, site] = await Promise.all([
    getPartnerProductDetail(partnerCode, productCode),
    getPartnerSite(partnerCode),
  ]);
  if (!detail || !site) notFound();

  const gallery: string[] = detail.imageUrls.length > 0 ? detail.imageUrls : (detail.imageUrl ? [detail.imageUrl] : []);

  return (
    <PartnerShellPC partner={detail.partner} categories={site.categories} partnerCode={partnerCode}>
      {/* Breadcrumb */}
      <nav className="border-b border-rk-line bg-white">
        <div className="max-w-[1280px] mx-auto px-6 py-2.5 text-[11px] text-rk-muted">
          <Link href={`/preview/p/${partnerCode}`} className="text-rk-muted no-underline hover:text-rk-orange">홈</Link>
          <span className="mx-1.5">›</span>
          <Link href={`/preview/p/${partnerCode}/products?category=${detail.category}`} className="text-rk-muted no-underline hover:text-rk-orange">
            {site.categories.find(c => c.slug === detail.category)?.label ?? detail.category}
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-rk-ink font-medium">{detail.name}</span>
        </div>
      </nav>

      {/* 2-col main */}
      <section className="bg-white">
        <div className="max-w-[1280px] mx-auto px-6 py-8 grid grid-cols-[1.4fr_1fr] gap-10">
          {/* LEFT — 갤러리 */}
          <ProductGalleryPC images={gallery} alt={detail.name} />

          {/* RIGHT — sticky 가격 패널 (운영방식·약정기간·타사보상·시뮬 박스 동적) */}
          <PriceConfiguratorPC
            productCode={detail.productCode}
            productName={detail.name}
            defaultRental={detail.rentalPrice}
            defaultCard={detail.cardDiscountPrice}
            defaultContract={detail.contractPeriod}
            defaultManagement={detail.managementType}
            priceMatrix={detail.priceMatrix}
            giftLabel={detail.giftLabel}
            giftAmount={detail.giftAmount}
            hotline={detail.partner.hotlineNumber}
            kakaoChannelUrl={detail.partner.kakaoChannelUrl}
          />
        </div>
      </section>

      {/* 본문 마케팅 이미지 — 풀 폭 가운데 정렬, max 880px */}
      {detail.contentImages.length > 0 && (
        <section className="bg-rk-soft-2 border-t border-rk-line">
          <div className="max-w-[1280px] mx-auto px-6 py-10">
            <div className="flex items-baseline mb-4">
              <h2 className="text-[20px] font-bold tracking-[-.02em] text-rk-ink">📋 상품 상세</h2>
              <small className="ml-2 text-[11px] text-rk-muted">{detail.contentImages.length}장 · 본사 인증 자료</small>
            </div>
            <div className="max-w-[880px] mx-auto bg-white border border-rk-line rounded-lg overflow-hidden">
              {detail.contentImages.map((img: ProductContentImage, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.alt ?? `상품 상세 ${i + 1}`}
                  loading="lazy"
                  className="w-full h-auto block"
                  width={img.width ?? undefined}
                  height={img.height ?? undefined}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 핵심 셀링포인트 + 스펙 — 2열 */}
      <section className="bg-white border-t border-rk-line">
        <div className="max-w-[1280px] mx-auto px-6 py-10 grid grid-cols-2 gap-10">
          {/* 핵심 셀링포인트 */}
          <div>
            <h2 className="text-[18px] font-bold tracking-[-.02em] text-rk-ink mb-3">⭐ 핵심 셀링포인트</h2>
            {detail.keyFeatures.length > 0 ? (
              <ul className="m-0 p-0 list-none flex flex-col gap-2">
                {detail.keyFeatures.map((f, i) => (
                  <li key={i} className="flex gap-2 items-start text-[13px] text-rk-text leading-[1.6] bg-rk-soft-2 px-3 py-2 rounded">
                    <span className="text-rk-orange shrink-0 font-bold mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-[12px] text-rk-muted">셀링포인트 등록 예정</div>
            )}
            {detail.description && (
              <div className="mt-5">
                <h3 className="text-[14px] font-semibold text-rk-ink mb-2">상품 소개</h3>
                <div className="text-[12.5px] text-rk-text leading-[1.75]">
                  {detail.description.split(/\n\n+/).filter(Boolean).map((para, i) => (
                    <p key={i} className="m-0 mb-2 last:mb-0 whitespace-pre-line">{para}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 스펙 표 */}
          <div>
            <h2 className="text-[18px] font-bold tracking-[-.02em] text-rk-ink mb-3">📋 사양 정보</h2>
            <dl className="bg-rk-soft-2 rounded-lg p-4 grid grid-cols-[100px_1fr] gap-y-1.5 text-[12.5px]">
              <dt className="text-rk-muted">모델명</dt><dd className="text-rk-ink font-mono">{detail.modelName}</dd>
              <dt className="text-rk-muted">카테고리</dt><dd className="text-rk-ink">{site.categories.find(c => c.slug === detail.category)?.label ?? detail.category}</dd>
              <dt className="text-rk-muted">관리방식</dt><dd className="text-rk-ink">{detail.managementType}</dd>
              <dt className="text-rk-muted">의무기간</dt><dd className="text-rk-ink">{detail.contractPeriod}개월</dd>
              <dt className="text-rk-muted">보증기간</dt><dd className="text-rk-ink">{detail.warrantyMonths}개월</dd>
              {Object.entries(detail.specs).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-rk-muted">{k}</dt>
                  <dd className="text-rk-ink">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* 관련 상품 */}
      {detail.related.length > 0 && (
        <section className="bg-rk-soft-2 border-t border-rk-line">
          <div className="max-w-[1280px] mx-auto px-6 py-10">
            <h2 className="text-[18px] font-bold tracking-[-.02em] text-rk-ink mb-4">함께 보면 좋은 상품</h2>
            <div className="grid grid-cols-4 gap-4">
              {detail.related.slice(0, 4).map(p => (
                <Link key={p.productCode} href={`/preview/p/${partnerCode}/products/${p.productCode}`}
                  className="block bg-white border border-rk-line rounded-lg p-4 hover:border-rk-orange transition-colors no-underline">
                  {p.imageUrl && (
                    <div className="aspect-[4/3] bg-rk-soft-2 rounded mb-2 overflow-hidden grid place-items-center">
                      <img src={p.imageUrl} alt={p.name} loading="lazy" className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                  <b className="block text-[12px] text-rk-ink line-clamp-2">{p.name}</b>
                  <small className="block text-[10px] text-rk-faint font-mono">{p.modelName}</small>
                  <b className="block text-[14px] text-rk-ink rk-num mt-1">₩{fmt(p.cardDiscountPrice ?? p.rentalPrice)}/월</b>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 인라인 상담 폼 */}
      <section id="consult-form" className="bg-white border-t border-rk-line">
        <div className="max-w-[1280px] mx-auto px-6 py-10 grid grid-cols-[1.2fr_1fr] gap-10">
          <div>
            <h2 className="text-[24px] font-bold tracking-[-.02em] text-rk-ink mb-3">📞 상담 신청</h2>
            <p className="text-[13px] text-rk-text leading-[1.7] mb-3">
              이름과 전화번호만 남겨도 본사 인증 상담사가 30분 안에 연락드립니다. 가격·옵션·설치 일정 모두 안내.
            </p>
            <ul className="text-[12px] text-rk-muted leading-[1.85] list-disc pl-5">
              <li>SK매직 본사 정책 그대로 적용 — 전국 동일가</li>
              <li>{detail.partner.partnerName} 단독 사은품{detail.giftLabel ? ` (${detail.giftLabel})` : ""}</li>
              <li>전국 무료 설치 + 가입 후 7일 청약 철회 가능</li>
              <li>가입 정보는 본사 운영 콘솔로 즉시 전달</li>
            </ul>
          </div>
          <div className="bg-rk-soft-2 rounded-lg p-4">
            <ConsultForm
              partnerCode={partnerCode}
              partnerName={detail.partner.partnerName}
              defaultProductCode={detail.productCode}
              defaultProductLabel={detail.name}
            />
          </div>
        </div>
      </section>

    </PartnerShellPC>
  );
}

function ProductGalleryPC({ images, alt }: { images: string[]; alt: string }) {
  if (images.length === 0) {
    return (
      <div className="aspect-[4/3] bg-rk-soft-2 rounded-lg border border-rk-line grid place-items-center text-[40px] text-rk-faint">
        📦
      </div>
    );
  }
  // SSR 단계라 갤러리 상호작용은 첫 이미지만 큰 뷰어로. 추후 클라이언트 컴포넌트로 active 전환 추가 가능.
  return (
    <div>
      <div className="aspect-[4/3] bg-rk-soft-2 rounded-lg border border-rk-line overflow-hidden grid place-items-center mb-2">
        <img src={images[0]} alt={alt} className="max-w-full max-h-full object-contain" />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-6 gap-2">
          {images.slice(0, 12).map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noreferrer" className="aspect-square bg-rk-soft-2 rounded border border-rk-line-2 overflow-hidden grid place-items-center hover:border-rk-orange">
              <img src={src} alt="" loading="lazy" className="max-w-full max-h-full object-contain" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
