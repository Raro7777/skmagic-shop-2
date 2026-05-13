import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL!;
const email = process.env.HQ_INITIAL_EMAIL;
const password = process.env.HQ_INITIAL_PASSWORD;
if (!email || !password) throw new Error("HQ_INITIAL_EMAIL / HQ_INITIAL_PASSWORD 환경변수 없음");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const hashed = await bcrypt.hash(password!, 12);

  // 이메일 기준 upsert — 이미 존재하면 비번만 갱신
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash: hashed, role: "hq", partnerId: null },
    });
    console.log(`✓ 기존 본사 계정 (${email}) 업데이트됨 (비번 갱신, role=hq)`);
  } else {
    await prisma.user.create({
      data: {
        email: email!,
        name: "본사 슈퍼관리자",
        passwordHash: hashed,
        role: "hq",
        partnerId: null,
      },
    });
    console.log(`✓ 본사 계정 (${email}) 신규 생성됨 · role=hq`);
  }

  // 기존 hq@rentking.kr 계정 확인 (자동 삭제 안 함, 사용자 결정 대기)
  const oldHq = await prisma.user.findUnique({ where: { email: "hq@rentking.kr" } });
  if (oldHq) {
    console.log(`ℹ︎ 기존 본사 테스트 계정 [hq@rentking.kr] 도 존재함 — 별도로 삭제·이전 결정 필요`);
  }
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
