/**
 * 후기 installPhotoUrl / photos 가 비어 있으면 연결된 Product 이미지로 채움.
 *
 * 협력점이 실제 설치 사진을 아직 업로드 안 했을 때 메인 후기 카드가 텍스트만
 * 보이지 않게 데모용으로 상품 이미지를 fallback 으로 넣는다.
 *
 * --apply 없으면 dry-run.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`▶ ${APPLY ? "APPLY" : "DRY-RUN"} : 후기 이미지 채움 (상품 이미지 fallback)\n`);

  const reviews = await prisma.review.findMany({
    where: { status: "published", approvalStatus: "approved" },
    include: { product: { select: { name: true, imageUrl: true, imageUrls: true } } },
  });
  console.log(`📦 후기 ${reviews.length}건\n`);

  let updated = 0;
  let alreadyHas = 0;
  let noProductImage = 0;

  for (const r of reviews) {
    const hasInstall = !!r.installPhotoUrl;
    const hasPhotos = (r.photos?.length ?? 0) > 0;
    if (hasInstall && hasPhotos) { alreadyHas++; continue; }

    const productImage = r.product?.imageUrls?.[0] ?? r.product?.imageUrl ?? null;
    if (!productImage) { noProductImage++; continue; }

    const newInstall = hasInstall ? r.installPhotoUrl : productImage;
    const newPhotos = hasPhotos ? r.photos : [productImage];

    console.log(
      `  ${r.id.slice(-6)}  ${(r.customerName ?? "").padEnd(8)}  product=${r.product?.name?.slice(0, 18) ?? "—"}` +
      `   install=${hasInstall ? "유지" : "→채움"}  photos=${hasPhotos ? `유지(${r.photos.length})` : "→채움(1장)"}`,
    );

    if (APPLY) {
      await prisma.review.update({
        where: { id: r.id },
        data: { installPhotoUrl: newInstall, photos: newPhotos },
      });
    }
    updated++;
  }

  console.log(`\n══ ${APPLY ? "APPLY" : "DRY-RUN"} ══`);
  console.log(`  채워질 후기 : ${updated}`);
  console.log(`  이미 있음    : ${alreadyHas}`);
  console.log(`  상품 이미지 없음 : ${noProductImage}`);
  if (!APPLY) console.log(`\n  💡 --apply 플래그로 실제 갱신`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
