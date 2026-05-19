/**
 * Partner 들의 푸터 노출 필드 (partnerName, ownerName, hotlineNumber, address,
 * businessNumber, commerceNumber) 상태를 일괄 조회. 어느 partner 가 본사명/디폴트
 * 값으로 잘못 표시되는지 한눈에 본다.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const partners = await prisma.partner.findMany({
    orderBy: { createdAt: "asc" },
    include: { approvals: { where: { kind: "partner_signup" } } },
  });

  console.log(`총 ${partners.length}개 partner\n`);
  console.log("partnerCode      | status | 상호                | 대표         | 고객센터        | 사업자 | 통판 | 주소 | approval");
  console.log("-".repeat(140));
  for (const p of partners) {
    const isDefaultHotline = p.hotlineNumber === "1600-2434";
    const hotlineFlag = isDefaultHotline ? "⚠본사" : "✓";
    const apprCount = p.approvals.length;
    console.log(
      `${p.partnerCode.padEnd(16)} | ${p.status.padEnd(6)} | ${p.partnerName.padEnd(20)} | ${(p.ownerName ?? "—").padEnd(12)} | ${p.hotlineNumber.padEnd(13)} ${hotlineFlag} | ${p.businessNumber ? "✓" : "—"}    | ${p.commerceNumber ? "✓" : "—"}   | ${p.address ? "✓" : "—"}  | ${apprCount}건`,
    );
  }

  console.log("\n=== 의심 케이스 분류 ===");
  const blacklist = ["우성종합통신", "㈜우성종합통신", "(주)우성종합통신", "주식회사 우성종합통신", "주식회사우성종합통신"];
  const hqLike = partners.filter(p => blacklist.includes(p.partnerName));
  if (hqLike.length > 0) {
    console.log(`\n• partnerName 이 본사명: ${hqLike.length}건`);
    for (const p of hqLike) {
      console.log(`    ${p.partnerCode} (${p.partnerName}) — approval ${p.approvals.length}건`);
    }
  } else {
    console.log("• partnerName 이 본사명인 partner 없음");
  }

  const noHotline = partners.filter(p => p.hotlineNumber === "1600-2434");
  console.log(`\n• hotlineNumber 가 schema default (본사 1600-2434) 인 partner: ${noHotline.length}건`);
  for (const p of noHotline) {
    console.log(`    ${p.partnerCode} (${p.partnerName})`);
  }

  const noBiz = partners.filter(p => !p.businessNumber);
  console.log(`\n• 사업자번호 미입력: ${noBiz.length}건`);
  for (const p of noBiz) {
    console.log(`    ${p.partnerCode} (${p.partnerName})`);
  }

  const noCommerce = partners.filter(p => !p.commerceNumber);
  console.log(`\n• 통신판매번호 미입력: ${noCommerce.length}건`);
  for (const p of noCommerce) {
    console.log(`    ${p.partnerCode} (${p.partnerName})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
