/**
 * 새 인스턴스 (skmagic-shop-2) 의 hq 슈퍼관리자 계정 생성.
 *   - email: jhy7076@naver.com
 *   - password: 7777 (사용자 요청 — 짧지만 명시적)
 *   - role: hq
 *   - mustChangePassword: false (첫 로그인 강제 변경 X)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const TARGET_URL = process.env.TARGET_DB_URL!;
if (!TARGET_URL) {
  console.error("TARGET_DB_URL 환경변수 필요");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: TARGET_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "jhy7076@naver.com";
  const plain = "7777";
  const hash = await bcrypt.hash(plain, 12);

  // 중복 체크
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`⚠ 이미 존재: ${existing.email} role=${existing.role}`);
    console.log(`→ 비밀번호만 갱신`);
    const updated = await prisma.user.update({
      where: { email },
      data: {
        passwordHash: hash,
        role: "hq",
        partnerId: null,
        status: "active",
        mustChangePassword: false,
        passwordUpdatedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: { id: true, email: true, role: true, status: true },
    });
    console.log(`✅ 업데이트:`, updated);
    return;
  }

  const u = await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      name: "본사 슈퍼관리자",
      role: "hq",
      partnerId: null,
      status: "active",
      mustChangePassword: false,
      passwordUpdatedAt: new Date(),
    },
    select: { id: true, email: true, role: true, status: true, createdAt: true },
  });
  console.log(`✅ 슈퍼관리자 계정 생성 완료:`);
  console.log(`   email: ${u.email}`);
  console.log(`   role:  ${u.role}`);
  console.log(`   status: ${u.status}`);
  console.log(`   id:    ${u.id}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
