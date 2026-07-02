/**
 * 7월 xlsx 의 A.전사할인가 vs DB 의 Product.rentalPrice (홈페이지 크롤 값) 대조.
 * Product.rentalPrice 는 이전 skmagic 크롤로 반영된 홈페이지 기준가 (60개월 방문형).
 * 검증 목적: 7월 xlsx 수치가 홈페이지 반영과 일치하는지 스팟체크.
 */
import { config } from "dotenv"; config({ path: ".env.local" });
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const PATH = "/Users/woozoo/.cokacdir/workspace/obnqnoho/SK매직_인증점_2026년_7월_제품_수수료표_0630_수정v12_1.xlsx";
const wb = XLSX.readFile(PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

type Row = {
  productCode: string;
  obligation: number;      // 의무기간(월)
  managementCycle: string; // 관리주기
  basePrice: number;       // 기준가
  operatingPrice: number;  // 운영가/기본할인가
  julyPromoPrice: number;  // ★7월 판촉가★ = A.전사할인가
  rivalPrice: number;      // B.타사보상가
};

const jul: Row[] = [];
for (let i = 12; i < rows.length; i++) {
  const r = rows[i] as unknown[];
  const code = String(r[2] ?? "").trim();
  if (!/^WPU[A-Z]{3}\d/.test(code)) continue;
  jul.push({
    productCode: code,
    obligation: Number(r[4]) || 0,
    managementCycle: String(r[6] ?? "").trim(),
    basePrice: Number(r[7]) || 0,
    operatingPrice: Number(r[8]) || 0,
    julyPromoPrice: Number(r[9]) || 0,
    rivalPrice: Number(r[10]) || 0,
  });
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const dbProds = await prisma.product.findMany({
    select: { productCode: true, name: true, rentalPrice: true, promoRentalPrice: true, baseRentalPrice: true, cardDiscountPrice: true, status: true },
  });
  const dbMap = new Map(dbProds.map(p => [p.productCode, p]));

  const codes = [...new Set(jul.map(r => r.productCode))];

  console.log(`\n=== 7월 xlsx 총 ${codes.length}개 productCode ===`);
  const missing: string[] = [];
  for (const code of codes) {
    if (!dbMap.has(code)) missing.push(code);
  }
  console.log(`  DB 미등록 ${missing.length}종:`);
  for (const c of missing) console.log(`    ${c}`);

  console.log(`\n=== 대표 상품 spot-check (7월 판촉가 60개월 방문형 vs DB rentalPrice) ===`);
  const targets = [
    "WPUJAC115DNW", // 초소형 플러스 (7월 -1000원 인하 예상)
    "WPUIAC414SPB", // 원코크 얼음물
    "WPUIAC506SNS", // MEGA ICE
    "WPUIAC606SNW", // MEGA ICE mini
    "WPUIAC425SNS", // 원코크 플러스 얼음물
    "WPUJAC104SWH", // 초소형 (PSG 위글 포함)
    "WPUJAC125SNW", // 초소형 라이트
    "WPUMAC306SWH", // 투워터
    "WPUPBC204SWH", // 뉴미니
    "WPUGBC102SCE", // 에코미니
  ];
  const header = "  code                   | 의무 | 관리      | 기준가 | 운영가 | ★7월판촉가 | 타사보상  | DB.rentalPrice | DB.promo | DB.base | DB.card";
  console.log(header);
  console.log("  " + "-".repeat(header.length - 2));
  for (const t of targets) {
    // 60개월 방문형 4개월 우선
    const rec = jul.find(r => r.productCode === t && r.obligation === 60 && r.managementCycle === "4개월");
    const dbP = dbMap.get(t);
    if (!rec) {
      console.log(`  ${t.padEnd(22)}  | 60월 4개월 없음`);
      continue;
    }
    console.log(
      `  ${t.padEnd(22)}| ${String(rec.obligation).padStart(2)}월 | ${rec.managementCycle.padEnd(9)} | ${String(rec.basePrice).padStart(6)} | ${String(rec.operatingPrice).padStart(6)} | ${String(rec.julyPromoPrice).padStart(9)} | ${String(rec.rivalPrice).padStart(8)} | ` +
      `${dbP ? String(dbP.rentalPrice).padStart(14) : "N/A".padStart(14)} | ${dbP?.promoRentalPrice ?? "-"}     | ${dbP?.baseRentalPrice ?? "-"}   | ${dbP?.cardDiscountPrice ?? "-"}`
    );
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
