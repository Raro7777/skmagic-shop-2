/**
 * HqPolicy.baseCommission · monthIncentive 의 VAT (10%) 제외 보정.
 *
 * 정책서 (xlsx) 수수료 합계 col 은 VAT 포함값. 협력점 송금 / 캐시백 산출은 VAT 제외 값으로
 * 이루어져야 정확하므로 일괄 ÷ 1.1 + 반올림.
 *
 *   661,200원 (VAT 포함) → 601,091원 (VAT 제외, 공급가액)
 *
 * --apply 없으면 dry-run.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const APPLY = process.argv.includes("--apply");
const VAT_RATE = 1.1;
const exclVat = (n: number): number => Math.round(n / VAT_RATE);

const fmt = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("ko-KR");

const SAMPLE_TARGETS = ["WPUMAC306SWH", "WPUIAC425SNS", "WPUIAC425SNW", "WPUJAC125SVB"];

async function main() {
  console.log(`▶ ${APPLY ? "APPLY" : "DRY-RUN"} : HqPolicy 의 baseCommission/monthIncentive 에서 VAT 10% 제외`);
  console.log();

  const policies = await prisma.hqPolicy.findMany({
    include: { product: { select: { productCode: true, name: true } } },
  });

  let touched = 0;
  let total = 0;
  for (const p of policies) {
    total++;
    const newBase = exclVat(p.baseCommission);
    const newIncentive = exclVat(p.monthIncentive ?? 0);
    if (newBase === p.baseCommission && newIncentive === (p.monthIncentive ?? 0)) continue;
    touched++;

    if (SAMPLE_TARGETS.includes(p.product.productCode) && (p.mode === "방문형" || p.mode === "셀프형")) {
      console.log(
        `  ${p.product.productCode.padEnd(14)} ${(p.mode ?? "—").padEnd(6)} ${String(p.contractPeriod).padStart(3)}m : ` +
        `${fmt(p.baseCommission).padStart(9)} → ${fmt(newBase).padStart(9)}  (incentive ${fmt(p.monthIncentive ?? 0)} → ${fmt(newIncentive)})`,
      );
    }

    if (APPLY) {
      await prisma.hqPolicy.update({
        where: { id: p.id },
        data: { baseCommission: newBase, monthIncentive: newIncentive },
      });
    }
  }
  console.log(`\n  ${APPLY ? "✓ 적용 완료" : "DRY-RUN"} : ${touched} / ${total} 정책 행 갱신${APPLY ? "됨" : " 예상"}\n`);

  if (!APPLY) {
    console.log("  💡 --apply 플래그로 실제 갱신");
    return;
  }

  // 갱신 후 4종 모델 캐시백 산출 검증
  console.log("══ 갱신 후 4종 모델 메인 카드 캐시백 검증 (rentalSupportAmount=200,000) ══");
  for (const code of SAMPLE_TARGETS) {
    const product = await prisma.product.findUnique({
      where: { productCode: code },
      select: {
        productCode: true,
        hqPolicies: { where: { mode: "방문형", contractPeriod: 60 }, select: { baseCommission: true, monthIncentive: true } },
      },
    });
    const hq = product?.hqPolicies[0];
    if (!hq) continue;
    const baseTotal = (hq.baseCommission ?? 0) + (hq.monthIncentive ?? 0);
    const cashback = Math.floor(Math.max(0, baseTotal - 200000) / 10000) * 10000;
    console.log(`  ${code} 방문 60m : baseTotal=${fmt(baseTotal)} − 200,000 → 캐시백 ${fmt(cashback)} (${(cashback / 10000)}만원)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
