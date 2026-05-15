import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { getPartnerProductDetail } from "@/lib/partnerSite";

async function main() {
  const partner = process.argv[2] ?? "partner-7714c0";
  const code = process.argv[3] ?? "WPUJAC115SNW";
  const d = await getPartnerProductDetail(partner, code);
  if (!d) { console.log("not found"); process.exit(1); }
  console.log(`${d.productCode} / ${d.name}`);
  console.log(`  baseRentalPrice : ${d.baseRentalPrice}`);
  console.log(`  rentalPrice     : ${d.rentalPrice} (effective)`);
  console.log(`  cardDiscountPrice: ${d.cardDiscountPrice}`);
  console.log(`  promoApplied    : ${d.promoApplied}`);
  console.log(`\n  priceMatrix sample (first 4):`);
  for (const opt of d.priceMatrix.slice(0, 4)) {
    console.log(`    ${opt.mode ?? "—"} ${opt.contractPeriod}m: rental=${opt.rentalPrice} card=${opt.cardDiscountPrice} ${(opt as any).basePrice != null ? `base=${(opt as any).basePrice}` : ""} ${(opt as any).promoPrice != null ? `promo=${(opt as any).promoPrice}` : ""}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
