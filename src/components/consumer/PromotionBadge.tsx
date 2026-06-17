/**
 * 협력점이 PartnerProductPromotion 으로 등록한 활성 뱃지.
 * 모든 컨슈머 상품 카드에서 동일 패턴/디자인으로 사용.
 *
 *   - 비어 있으면 (null/undefined/"") → 아무것도 안 그림 (조건 호출 불필요)
 *   - 디자인: #FF7300 배경 / 흰 텍스트 / bold / 모바일 가독성 우선
 */
export default function PromotionBadge({
  text,
  className,
}: {
  text: string | null | undefined;
  /** 카드 레이아웃 위치 조정용 — mt-1 등의 wrapper margin */
  className?: string;
}) {
  if (!text) return null;
  return (
    <div className={className ?? "mt-1"}>
      <span
        className="inline-block px-2 py-0.5 rounded-md font-extrabold text-[12px] leading-[1.4] text-white whitespace-nowrap shadow-sm tracking-[-.01em]"
        style={{ backgroundColor: "#FF7300" }}
      >
        {text}
      </span>
    </div>
  );
}
