import { FEATURES, requiredTierLabel, TIER_LABEL, TIER_PILL, type FeatureKey, type Tier } from "@/lib/tier";

export default function LockedFeature({
  feature,
  currentTier,
}: {
  feature: FeatureKey;
  currentTier: string;
}) {
  const f = FEATURES[feature];
  const need = requiredTierLabel(feature);
  return (
    <div className="bg-white border border-rk-line rounded-lg p-6 text-center">
      <div className="text-[28px] mb-2">🔒</div>
      <h3 className="text-[14px] font-semibold text-rk-ink m-0 mb-1">{f.label}</h3>
      <p className="text-[14px] text-rk-muted m-0 mb-3 leading-[1.5]">{f.description}</p>
      <div className="inline-flex items-center gap-2 bg-rk-soft-2 border border-rk-line-2 rounded-full px-3 py-1 text-[13px]">
        <span className="text-rk-muted">현재 패키지</span>
        <span className={"px-1.5 py-px rounded font-medium " + TIER_PILL[(currentTier as Tier)]}>
          {TIER_LABEL[(currentTier as Tier)] ?? currentTier}
        </span>
        <span className="text-rk-muted">→</span>
        <span className="text-rk-orange-deep font-medium">{need} 이상 필요</span>
      </div>
      <div className="mt-3 text-[13px] text-rk-info">
        분양 패키지 업그레이드는 본사 영업팀(<a href="tel:1668-0521" className="underline">1668-0521</a>)에 문의해주세요.
      </div>
    </div>
  );
}
