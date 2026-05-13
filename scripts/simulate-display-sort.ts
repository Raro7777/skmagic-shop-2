/**
 * 사은품 변경 시 카테고리 진열 순서가 바뀌는지 시뮬레이션 (DB 변경 없음).
 *   - 22평 디아트 공기청정기에 사은품 ₩100,000 임시 부여
 *   - 16평 디아트 공기청정기에 사은품 ₩50,000 임시 부여
 *   - 정렬 결과 확인
 *   - 곧바로 원복
 */
import { prisma } from "../src/lib/prisma";
import { listPartnerProducts } from "../src/lib/partnerSite";

async function main() {
  const partnerCode = "partner-7714c0";
  const targets = [
    { productCode: "ACL22C1ASKOB", gift: 100000, label: "텀블러+공기측정기" },
    { productCode: "ACL16C1ASKOB", gift: 50000, label: "공기측정기" },
  ];

  // backup
  const backups: Array<{ productId: string; existed: boolean; giftAmount: number; giftLabel: string | null }> = [];
  for (const t of targets) {
    const product = await prisma.product.findUnique({ where: { productCode: t.productCode }, select: { id: true } });
    if (!product) continue;
    const existing = await prisma.partnerPolicy.findUnique({
      where: { partnerId_productId: { partnerId: partnerCode, productId: product.id } },
    });
    backups.push({
      productId: product.id,
      existed: !!existing,
      giftAmount: existing?.giftAmount ?? 0,
      giftLabel: existing?.giftLabel ?? null,
    });
    await prisma.partnerPolicy.upsert({
      where: { partnerId_productId: { partnerId: partnerCode, productId: product.id } },
      update: { giftAmount: t.gift, giftLabel: t.label },
      create: { partnerId: partnerCode, productId: product.id, giftAmount: t.gift, giftLabel: t.label },
    });
  }

  console.log("─── 사은품 임시 부여 후 air 카테고리 정렬 ───");
  const air = await listPartnerProducts(partnerCode, { category: "air" });
  air.slice(0, 6).forEach((p, i) =>
    console.log(`  ${i + 1}. ${p.name}  사은품 ₩${p.giftAmount.toLocaleString("ko-KR")}${p.giftLabel ? ` (${p.giftLabel})` : ""}`)
  );

  console.log("\n─── 원복 ───");
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const b = backups[i];
    if (!b) continue;
    if (b.existed) {
      await prisma.partnerPolicy.update({
        where: { partnerId_productId: { partnerId: partnerCode, productId: b.productId } },
        data: { giftAmount: b.giftAmount, giftLabel: b.giftLabel },
      });
      console.log(`  ${t.productCode}: 원래 ${b.giftAmount} / ${b.giftLabel} 로 복구`);
    } else {
      await prisma.partnerPolicy.delete({
        where: { partnerId_productId: { partnerId: partnerCode, productId: b.productId } },
      });
      console.log(`  ${t.productCode}: 임시 row 삭제`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
