/**
 * HqPolicy 다중행 스키마용 헬퍼.
 *
 *   - pickRepresentativeHqPolicy: 기존 코드의 product.hqPolicy 단일 참조를 대체.
 *     product.managementType + contractPeriod 와 매칭되는 옵션을 우선 반환,
 *     없으면 첫 옵션 fallback.
 *   - findHqPolicy: 특정 (mode, contractPeriod) 의 정확한 정책 lookup (정산 등에서 사용).
 */
import type { HqPolicy } from "@prisma/client";

type ProductLike = {
  managementType: string;
  contractPeriod: number;
  hqPolicies: HqPolicy[];
};

/** managementType 텍스트("자가관리" | "방문관리 4개월" | "방문관리_4") → priceMatrix mode("자가관리"|"방문형"|"셀프형") */
export function managementTypeToMode(mt: string): "방문형" | "셀프형" | "자가관리" {
  if (!mt) return "방문형";
  if (mt.includes("자가") || mt.includes("셀프")) return "셀프형";
  if (mt.includes("방문")) return "방문형";
  return "방문형";
}

/**
 * 상품의 "대표" HqPolicy 를 고름.
 *  1) managementType 매핑된 mode + product.contractPeriod 정확 일치 옵션
 *  2) 동일 mode + 60개월 (관행적 기본)
 *  3) 동일 mode + 가장 짧은 contractPeriod
 *  4) 첫 옵션
 */
export function pickRepresentativeHqPolicy<P extends ProductLike>(p: P): HqPolicy | null {
  const policies = p.hqPolicies ?? [];
  if (policies.length === 0) return null;

  const targetMode = managementTypeToMode(p.managementType);
  const exact = policies.find(h => h.mode === targetMode && h.contractPeriod === p.contractPeriod);
  if (exact) return exact;

  const sameMode60 = policies.find(h => h.mode === targetMode && h.contractPeriod === 60);
  if (sameMode60) return sameMode60;

  const sameMode = policies
    .filter(h => h.mode === targetMode)
    .sort((a, b) => a.contractPeriod - b.contractPeriod)[0];
  if (sameMode) return sameMode;

  return policies[0];
}

/** 특정 (mode, contractPeriod) 옵션 정확 매치 lookup. 정산 생성 시 사용. */
export function findHqPolicyForOption<P extends { hqPolicies: HqPolicy[] }>(
  p: P,
  mode: string,
  contractPeriod: number,
): HqPolicy | null {
  return p.hqPolicies.find(h => h.mode === mode && h.contractPeriod === contractPeriod) ?? null;
}

/**
 * 상품의 가장 낮은 수수료 옵션을 반환.
 * PartnerPolicy 한도 검증에 사용 — 협력점이 모든 옵션에 동일 금액을 빼므로
 * 어느 옵션도 ⅔ 초과 안 되게 하려면 최소 수수료 기준으로 보수적으로 검증.
 */
export function pickMinCommissionHqPolicy<P extends { hqPolicies: HqPolicy[] }>(p: P): HqPolicy | null {
  if (p.hqPolicies.length === 0) return null;
  return p.hqPolicies.reduce((min, cur) => {
    const minTotal = min.baseCommission + min.monthIncentive;
    const curTotal = cur.baseCommission + cur.monthIncentive;
    return curTotal < minTotal ? cur : min;
  });
}
