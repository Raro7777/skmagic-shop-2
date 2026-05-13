/**
 * 상품 카드 썸네일.
 * - product.imageUrl 있으면 <img>로 표시
 * - 없으면 카테고리 그라디언트 fallback
 * - 좌상단 배지(사은품/MD추천 등)는 children으로 받음
 */
type Props = {
  imageUrl: string | null;
  alt: string;
  fallbackBg: string;
  children?: React.ReactNode;  // 배지 슬롯
  className?: string;
};

export default function ProductThumb({ imageUrl, alt, fallbackBg, children, className }: Props) {
  return (
    <div
      className={"aspect-square rounded-lg relative overflow-hidden bg-rk-soft-2 " + (className ?? "")}
      style={imageUrl ? undefined : { backgroundImage: fallbackBg }}
    >
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {children && <div className="absolute top-1.5 left-1.5 flex flex-col gap-0.5 items-start z-10">{children}</div>}
    </div>
  );
}
