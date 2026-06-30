import { config } from "dotenv"; config({ path: ".env.local" });

async function main() {
  const { getPartnerSite, listPartnerProducts } = await import("../../src/lib/partnerSite");
  console.log("→ getPartnerSite('partner-7714c0')");
  try {
    const data = await getPartnerSite("partner-7714c0");
    console.log("  OK, picks:", data?.picks.length, "ranking keys:", data ? Object.keys(data.rankingsByCategory).length : 0);
  } catch (e) {
    console.error("  FAIL:", e);
  }
  console.log("\n→ listPartnerProducts('partner-7714c0', { category: 'water' })");
  try {
    const products = await listPartnerProducts("partner-7714c0", { category: "water" });
    console.log("  OK, count:", products.length);
  } catch (e) {
    console.error("  FAIL:", e);
  }
}
main();
