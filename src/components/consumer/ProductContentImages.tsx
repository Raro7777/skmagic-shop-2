import type { ProductContentImage } from "@/lib/partnerSite";

/**
 * 상품 상세 페이지 본문 마케팅 이미지 (Vercel Blob 영구 저장).
 * 이미지 0장이면 섹션 자체 미노출.
 */
export default function ProductContentImages({ images }: { images: ProductContentImage[] }) {
  if (!images || images.length === 0) return null;
  return (
    <section className="bg-white px-4 py-5 border-b-8 border-rk-soft">
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className="text-[14px] font-bold text-rk-ink tracking-[-.02em]">📋 상품 상세</h3>
        <small className="text-[12px] text-rk-muted">{images.length}장</small>
      </div>
      <div className="flex flex-col gap-2">
        {images.map((img, i) => (
          <img
            key={i}
            src={img.url}
            alt={img.alt ?? `상품 상세 ${i + 1}`}
            loading="lazy"
            className="w-full h-auto block rounded"
            width={img.width ?? undefined}
            height={img.height ?? undefined}
          />
        ))}
      </div>
    </section>
  );
}
