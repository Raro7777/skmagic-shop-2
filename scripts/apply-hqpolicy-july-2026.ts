/**
 * SK매직 26년 7월 정책 → HqPolicy 테이블 업데이트.
 *
 * 컨슈머 페이지에 노출되는 렌탈지원금 계산은 HqPolicy.baseCommission 을 사용.
 * apply-policy-july-2026.ts 는 priceMatrix 만 업데이트하고 HqPolicy 는 안 만짐 →
 * 이 스크립트로 HqPolicy 도 7월 값으로 동기화.
 *
 * 저장 값:
 *   baseCommission = xlsx c17 "수수료 합계 ①+②+④" (기본+핵심+주력 인센티브 총액)
 *   monthIncentive = 0
 *   visitInterval  = xlsx c6 "관리 주기"
 *   mode           = xlsx c3 에서 파싱 (* 방문형 * / * 셀프형 *)
 *   contractPeriod = xlsx c4 "의무기간"
 *
 * upsert 로 처리 — 기존 5월 HqPolicy 있으면 update, 없으면 create.
 * 신규 상품 (WPUJAC115DNW/DNS + 뉴슬림플러스 5종) 도 자동 생성.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const XLSX_PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

type XlsxOpt = {
  productCode: string;
  mode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  visitInterval: string;
  baseCommission: number; // c17 수수료 합계
  julyPromoCommission: number; // c11 기본 수수료 (참고용)
};

function parseColorMode(cm: string): "방문형" | "셀프형" | null {
  if (cm.includes("방문형")) return "방문형";
  if (cm.includes("셀프형")) return "셀프형";
  return null;
}

function loadOptions(): XlsxOpt[] {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const out: XlsxOpt[] = [];
  let currentMode: "방문형" | "셀프형" | null = null;
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const code = String(r[2] ?? "").trim();
    const cm = String(r[3] ?? "").trim();
    if (cm) {
      const m = parseColorMode(cm);
      if (m) currentMode = m;
    }
    if (!/^WPU[A-Z]{3}\d/.test(code)) continue;
    const cp = Number(r[4]) || 0;
    if (!cp) continue;
    const commissionSum = Number(r[17]) || 0;
    const baseCommonly = Number(r[11]) || 0;
    // 실제 협력점 수수료 = 수수료 합계. 0 이면 fallback 으로 기본 수수료.
    const baseCommission = commissionSum > 0 ? commissionSum : baseCommonly;
    out.push({
      productCode: code,
      mode: currentMode,
      contractPeriod: cp,
      visitInterval: String(r[6] ?? "").trim(),
      baseCommission,
      julyPromoCommission: baseCommonly,
    });
  }
  return out;
}

async function main() {
  console.log("→ xlsx 옵션 로드…");
  const options = loadOptions();
  console.log(`  총 ${options.length}개 옵션`);

  // 상품 매핑
  const products = await prisma.product.findMany({ select: { id: true, productCode: true } });
  const codeToId = new Map(products.map(p => [p.productCode, p.id]));

  const codes = [...new Set(options.map(o => o.productCode))];
  console.log(`  productCode ${codes.length}종`);
  const missing = codes.filter(c => !codeToId.has(c));
  if (missing.length > 0) console.log(`  ⚠️ DB 미등록 ${missing.length}종: ${missing.join(", ")}`);

  // 옵션별 upsert (mode+contractPeriod 유일)
  console.log("\n→ HqPolicy upsert…");
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const o of options) {
    const productId = codeToId.get(o.productCode);
    if (!productId) { skipped++; continue; }
    if (!o.mode) { skipped++; continue; }
    if (o.baseCommission <= 0) { skipped++; continue; }
    const existing = await prisma.hqPolicy.findUnique({
      where: {
        productId_mode_contractPeriod: {
          productId,
          mode: o.mode,
          contractPeriod: o.contractPeriod,
        },
      },
    });
    if (existing) {
      await prisma.hqPolicy.update({
        where: { id: existing.id },
        data: {
          baseCommission: o.baseCommission,
          monthIncentive: 0,
          visitInterval: o.visitInterval || null,
        },
      });
      updated++;
    } else {
      await prisma.hqPolicy.create({
        data: {
          productId,
          mode: o.mode,
          contractPeriod: o.contractPeriod,
          visitInterval: o.visitInterval || null,
          baseCommission: o.baseCommission,
          monthIncentive: 0,
        },
      });
      created++;
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`  created ${created}건 / updated ${updated}건 / skipped ${skipped}건`);

  // 검증 스팟체크
  console.log(`\n=== 스팟체크 (7월 갱신 후 HqPolicy) ===`);
  const check = ["WPUIAC506SNS", "WPUJAC115DNW", "WPUTDC104RNW", "WPUMAC306SWH", "WPUIAC425SNW"];
  for (const c of check) {
    const pid = codeToId.get(c);
    if (!pid) { console.log(`  ${c} 미등록`); continue; }
    const p = await prisma.hqPolicy.findMany({
      where: { productId: pid },
      orderBy: [{ contractPeriod: "asc" }, { mode: "asc" }],
      select: { mode: true, contractPeriod: true, baseCommission: true, monthIncentive: true },
    });
    console.log(`\n  [${c}]  policies=${p.length}`);
    for (const h of p) console.log(`    ${h.mode.padEnd(4)} ${String(h.contractPeriod).padStart(2)}월  baseComm=${h.baseCommission}  incentive=${h.monthIncentive}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
