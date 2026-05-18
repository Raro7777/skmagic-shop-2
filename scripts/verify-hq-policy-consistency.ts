/**
 * priceMatrix vs HqPolicy 일관성 검증 — 모든 (productCode, mode, contractPeriod) 조합에서
 * HqPolicy.baseCommission == priceMatrix.baseCommission ÷ 1.1 (반올림) 이어야 함.
 *
 * 단순 read-only — 인플레이스 변경 없음.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { VAT_RATE } from "@/lib/constants/pricing";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const fmt = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("ko-KR");
const VAT = VAT_RATE;

type MatrixOpt = {
  mode: string | null;
  contractPeriod: number;
  baseCommission: number | null;
};

function managementTypeToMode(mt: string): "방문형" | "셀프형" {
  if (mt.includes("자가") || mt.includes("셀프")) return "셀프형";
  return "방문형";
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true, productCode: true, managementType: true, priceMatrix: true,
      hqPolicies: { select: { mode: true, contractPeriod: true, baseCommission: true } },
    },
  });

  let totalChecks = 0;
  let matches = 0;
  let mismatches = 0;
  const mismatchSamples: string[] = [];

  for (const p of products) {
    const matrix = (p.priceMatrix as unknown as MatrixOpt[] | null) ?? [];
    for (const m of matrix) {
      if (m.baseCommission == null) continue;
      const expectedMode = m.mode ?? managementTypeToMode(p.managementType);
      const hq = p.hqPolicies.find(h => h.mode === expectedMode && h.contractPeriod === m.contractPeriod);
      if (!hq) {
        mismatches++;
        if (mismatchSamples.length < 30) {
          mismatchSamples.push(`  ${p.productCode.padEnd(14)} ${expectedMode.padEnd(4)} ${String(m.contractPeriod).padStart(2)}m : HqPolicy 행 누락`);
        }
        continue;
      }
      const expected = Math.round(m.baseCommission / VAT);
      totalChecks++;
      if (hq.baseCommission === expected) {
        matches++;
      } else {
        mismatches++;
        if (mismatchSamples.length < 30) {
          mismatchSamples.push(
            `  ${p.productCode.padEnd(14)} ${expectedMode.padEnd(4)} ${String(m.contractPeriod).padStart(2)}m : HqPolicy=${fmt(hq.baseCommission)} / 예상=${fmt(expected)}  (xlsx=${fmt(m.baseCommission)})`,
          );
        }
      }
    }
  }

  console.log(`▶ priceMatrix vs HqPolicy 일관성 검증`);
  console.log(`  검사 대상 옵션 : ${totalChecks}`);
  console.log(`  ✓ 일치          : ${matches}`);
  console.log(`  ❌ 불일치        : ${mismatches}`);
  if (mismatchSamples.length > 0) {
    console.log(`\n  불일치 샘플:`);
    for (const s of mismatchSamples) console.log(s);
  } else {
    console.log(`\n  🎉 100% 일관성 확보됨.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
