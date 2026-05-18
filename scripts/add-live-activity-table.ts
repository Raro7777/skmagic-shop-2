/**
 * Migration — LiveActivity 테이블 신규 추가.
 * 본사 admin 이 등록한 데모 활동을 모든 협력점 사이트 hero 위에 자동 롤링 표시.
 *
 *   id          cuid
 *   customerName 마스킹된 이름 (예: "김**")
 *   productName  상품명 (예: "정수기")
 *   region       지역 (예: "강남구")
 *   status       접수완료 | 상담대기 | 설치완료
 *   minutesAgo   N 분 전 (표시용)
 *   priority     큰 값 우선 노출
 *   status_active boolean — admin 이 끄면 노출 안 함
 *   createdAt    auto
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  console.log("▶ CREATE TABLE LiveActivity");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LiveActivity" (
      "id" TEXT PRIMARY KEY,
      "customerName" TEXT NOT NULL,
      "productName" TEXT NOT NULL,
      "region" TEXT,
      "status" TEXT NOT NULL DEFAULT '접수완료',
      "minutesAgo" INTEGER NOT NULL DEFAULT 5,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "LiveActivity_isActive_priority_idx" ON "LiveActivity" ("isActive", "priority" DESC)`);
  console.log("✓ 테이블 생성 완료\n");

  // 초기 데모 데이터 시드
  const existing = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) as count FROM "LiveActivity"`);
  if (Number(existing[0].count) === 0) {
    console.log("▶ 초기 데모 데이터 시드");
    const seedRows = [
      { customerName: "김**", productName: "투워터 정수기", region: "강남구", status: "접수완료", minutesAgo: 2, priority: 100 },
      { customerName: "이**", productName: "원코크 얼음물 정수기", region: "서초구", status: "상담대기", minutesAgo: 5, priority: 95 },
      { customerName: "박**", productName: "올클린 공기청정기 (20평형)", region: "송파구", status: "접수완료", minutesAgo: 8, priority: 90 },
      { customerName: "최**", productName: "초소형 직수 정수기", region: "마포구", status: "설치완료", minutesAgo: 12, priority: 85 },
      { customerName: "정**", productName: "올클린 비데 (전기형)", region: "용산구", status: "접수완료", minutesAgo: 18, priority: 80 },
      { customerName: "강**", productName: "투워터 정수기", region: "성동구", status: "상담대기", minutesAgo: 25, priority: 75 },
      { customerName: "조**", productName: "원코크 플러스 얼음물 정수기", region: "광진구", status: "설치완료", minutesAgo: 32, priority: 70 },
      { customerName: "윤**", productName: "초소형 라이트 직수 정수기", region: "노원구", status: "접수완료", minutesAgo: 45, priority: 65 },
    ];
    for (const row of seedRows) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "LiveActivity" ("id", "customerName", "productName", "region", "status", "minutesAgo", "priority", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, true, NOW(), NOW())`,
        row.customerName, row.productName, row.region, row.status, row.minutesAgo, row.priority,
      );
    }
    console.log(`  ✓ ${seedRows.length}건 시드 완료`);
  } else {
    console.log(`  - 기존 데이터 ${existing[0].count}건 — 시드 건너뜀`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
