/**
 * 모든 active Seller에 대해 role="seller" User 1:1 생성 + Seller.userId 연결.
 * email = `<sellerCode>@<partnerCode>.seller` (시연용 형식, 충돌 방지)
 * password = "demo1234"
 * 멱등성: 이미 userId 있으면 skip.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const sellers = await prisma.seller.findMany({
    where: { status: "active" },
    include: { partner: { select: { partnerName: true } } },
  });
  const passwordHash = await bcrypt.hash("demo1234", 10);

  let created = 0, skipped = 0;
  console.log(`📋 영업자 ${sellers.length}명 처리\n`);

  for (const s of sellers) {
    if (s.userId) {
      skipped++;
      continue;
    }
    const email = `${s.sellerCode}@${s.partnerId}.seller`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, name: s.name, role: "seller", partnerId: s.partnerId, status: "active" },
      create: {
        email,
        passwordHash,
        name: s.name,
        role: "seller",
        partnerId: s.partnerId,
        status: "active",
      },
    });
    await prisma.seller.update({
      where: { id: s.id },
      data: { userId: user.id },
    });
    console.log(`  ✓ ${s.name.padEnd(15)} (${s.partner.partnerName.padEnd(20)})  email=${email}`);
    created++;
  }

  console.log(`\n✅ User 생성 ${created}명 / 스킵 ${skipped}명 (이미 연결됨)`);

  // 발급된 영업자 로그인 정보 출력
  console.log(`\n🔐 영업자 로그인 (모두 password: demo1234)`);
  const linked = await prisma.seller.findMany({
    where: { userId: { not: null } },
    include: {
      partner: { select: { partnerName: true } },
      user: { select: { email: true } },
    },
    orderBy: [{ partnerId: "asc" }, { sellerCode: "asc" }],
  });
  for (const s of linked) {
    console.log(`  ${s.partner.partnerName.padEnd(22)} ${s.name.padEnd(15)} → ${s.user?.email}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
