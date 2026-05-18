/**
 * 후기 createdAt 을 3~30일 이내로 재분포.
 *
 * approved + published 후기만 대상. 자연스러운 시간차를 위해:
 *   - 첫 3건(가장 최근): 0~3일 (오늘/어제/그제 분포)
 *   - 다음 5건: 3~10일
 *   - 나머지: 10~30일
 *
 * 정렬 안정성을 위해 같은 createdAt 충돌 피하도록 ms 단위 jitter 부여.
 *
 * --apply 없으면 dry-run.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const APPLY = process.argv.includes("--apply");

const DAY_MS = 24 * 60 * 60 * 1000;

function randomMsAgo(minDays: number, maxDays: number): number {
  const span = (maxDays - minDays) * DAY_MS;
  return Math.floor(minDays * DAY_MS + Math.random() * span);
}

async function main() {
  console.log(`▶ ${APPLY ? "APPLY" : "DRY-RUN"} : 후기 createdAt 3~30일 이내 재분포\n`);

  const reviews = await prisma.review.findMany({
    where: { status: "published", approvalStatus: "approved" },
    orderBy: { createdAt: "asc" },
    select: { id: true, customerName: true, productId: true, createdAt: true, approvedAt: true },
  });
  console.log(`📦 대상 후기 ${reviews.length}건\n`);

  // 무작위 순서로 섞은 후 인덱스 기준 버킷 분배
  const shuffled = [...reviews].sort(() => Math.random() - 0.5);

  const now = Date.now();
  const updates: Array<{ id: string; oldAt: Date; newAt: Date; bucket: string }> = [];

  // 모두 3~30일 범위 내 무작위. 총 개수가 ≥ 4 일 경우 가장 최근 한 건은 3~7일 (메인 노출에 신선도)
  shuffled.forEach((r, i) => {
    let msAgo: number;
    let bucket: string;
    if (i === 0 && shuffled.length >= 1) {
      msAgo = randomMsAgo(3, 7);
      bucket = "3~7d";
    } else if (i <= 2) {
      msAgo = randomMsAgo(7, 14);
      bucket = "7~14d";
    } else {
      msAgo = randomMsAgo(14, 30);
      bucket = "14~30d";
    }
    const newAt = new Date(now - msAgo);
    updates.push({ id: r.id, oldAt: r.createdAt, newAt, bucket });
  });

  // 새 날짜 기준 정렬 (최신순) 후 출력
  const sortedForPrint = [...updates].sort((a, b) => b.newAt.getTime() - a.newAt.getTime());
  for (const u of sortedForPrint.slice(0, 20)) {
    const days = ((now - u.newAt.getTime()) / DAY_MS).toFixed(1);
    console.log(`  ${u.id.slice(-6)}  ${u.oldAt.toISOString().slice(0, 10)} → ${u.newAt.toISOString().slice(0, 16).replace("T", " ")}  (${days}일 전, ${u.bucket})`);
  }
  if (sortedForPrint.length > 20) console.log(`  ... +${sortedForPrint.length - 20}건 추가`);

  if (APPLY) {
    for (const u of updates) {
      await prisma.review.update({
        where: { id: u.id },
        data: { createdAt: u.newAt, approvedAt: u.newAt },
      });
    }
    console.log(`\n✓ ${updates.length}건 갱신 완료.`);
  } else {
    console.log(`\n💡 --apply 플래그로 실제 갱신.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
