import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { getPartnerSite } from "@/lib/partnerSite";

async function main() {
  const arg = process.argv[2] ?? "partner-7714c0";
  const data = await getPartnerSite(arg);
  if (!data) {
    console.log(`partner not found: ${arg}`);
    process.exit(1);
  }
  console.log(`partner: ${data.partner.partnerCode} / ${data.partner.partnerName}`);
  console.log(`\n[ranking 정수기 top 8]`);
  const waterRank = data.rankingsByCategory.water ?? [];
  for (const p of waterRank.slice(0, 8)) {
    console.log(
      `  ${p.productCode} | ${p.modelName} | rental=${p.rentalPrice} card=${p.cardDiscountPrice} ` +
      `minRival=${p.minRivalPrice} halfMonths=${p.rivalHalfMonths} halfPrice=${p.rivalHalfPrice}`,
    );
  }
  console.log(`\n[picks]`);
  for (const p of data.picks) {
    console.log(
      `  ${p.productCode} | ${p.modelName} | rental=${p.rentalPrice} card=${p.cardDiscountPrice} ` +
      `minRival=${p.minRivalPrice} halfMonths=${p.rivalHalfMonths} halfPrice=${p.rivalHalfPrice}`,
    );
  }
}

main().catch(e => { console.error(e); process.exit(1); });
