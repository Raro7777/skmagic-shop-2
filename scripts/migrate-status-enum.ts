/**
 * Lead.status 4-state → 14-state 일괄 변환
 *
 *   new   → consult_wish
 *   going → consult_active
 *   warn  → consult_closed (보수적 종료; 필요 시 운영팀이 재오픈)
 *   done  → settle_done (Settlement 존재) / install_done (없음)
 *
 * LeadStatusLog 의 previousStatus / newStatus 도 동일 매핑.
 *
 * 이미 신규 enum 값인 row 는 건너뜀 (idempotent).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/leadStatus";

const LEGACY_TO_NEW: Record<string, LeadStatus | "__done__"> = {
  new: "consult_wish",
  going: "consult_active",
  warn: "consult_closed",
  done: "__done__", // settlement 존재 여부로 분기
};

function isLegacy(status: string): status is keyof typeof LEGACY_TO_NEW {
  return status in LEGACY_TO_NEW;
}
function isNewEnum(status: string): boolean {
  return (LEAD_STATUSES as readonly string[]).includes(status);
}

async function main() {
  console.log("📦 Lead.status 마이그레이션 시작");
  const leads = await prisma.lead.findMany({
    select: { id: true, status: true, settlement: { select: { id: true, status: true } } },
  });
  console.log(`   총 ${leads.length}건 검사`);

  const stats: Record<string, number> = { new: 0, going: 0, warn: 0, doneToSettle: 0, doneToInstall: 0, skipped: 0, unknown: 0 };

  for (const l of leads) {
    if (isNewEnum(l.status)) { stats.skipped++; continue; }
    if (!isLegacy(l.status)) { stats.unknown++; console.log(`   ⚠ 알 수 없는 상태: ${l.id} status=${l.status}`); continue; }

    let to: LeadStatus;
    if (l.status === "done") {
      // Settlement 가 있고 cancelled 가 아니면 settle_done, 아니면 install_done
      const hasActiveSettlement = !!l.settlement && l.settlement.status !== "cancelled";
      to = hasActiveSettlement ? "settle_done" : "install_done";
      if (hasActiveSettlement) stats.doneToSettle++;
      else stats.doneToInstall++;
    } else {
      const mapped = LEGACY_TO_NEW[l.status];
      if (mapped === "__done__") continue;
      to = mapped;
      stats[l.status]++;
    }

    await prisma.lead.update({
      where: { id: l.id },
      data: { status: to },
    });
  }

  console.log(`✓ Lead.status 변환 완료`);
  console.log(`   new → consult_wish:    ${stats.new}건`);
  console.log(`   going → consult_active: ${stats.going}건`);
  console.log(`   warn → consult_closed: ${stats.warn}건`);
  console.log(`   done → settle_done:    ${stats.doneToSettle}건`);
  console.log(`   done → install_done:   ${stats.doneToInstall}건`);
  console.log(`   skipped (이미 신규 enum): ${stats.skipped}건`);
  if (stats.unknown > 0) console.log(`   ⚠ unknown: ${stats.unknown}건`);

  // ─────────────────────────────────────────────────────────
  // LeadStatusLog 도 같은 매핑 적용 (done 은 settle_done 으로 일괄 — done 이력은 정산 발생을 의미)
  // ─────────────────────────────────────────────────────────
  console.log("\n📜 LeadStatusLog 매핑");
  const logMapping: Record<string, LeadStatus> = {
    new: "consult_wish",
    going: "consult_active",
    warn: "consult_closed",
    done: "settle_done",
  };
  let logStats = 0;
  for (const [legacy, neu] of Object.entries(logMapping)) {
    const r1 = await prisma.leadStatusLog.updateMany({ where: { previousStatus: legacy }, data: { previousStatus: neu } });
    const r2 = await prisma.leadStatusLog.updateMany({ where: { newStatus: legacy }, data: { newStatus: neu } });
    logStats += r1.count + r2.count;
    console.log(`   ${legacy} → ${neu}: prev ${r1.count}건 / new ${r2.count}건`);
  }
  console.log(`✓ LeadStatusLog 합계 ${logStats}건 갱신`);

  // 검증
  console.log("\n🔍 사후 검증");
  const distribution = await prisma.lead.groupBy({ by: ["status"], _count: { _all: true } });
  for (const d of distribution.sort((a, b) => b._count._all - a._count._all)) {
    const known = isNewEnum(d.status) ? "✓" : "⚠ legacy";
    console.log(`   ${known} ${d.status.padEnd(20)} ${d._count._all}건`);
  }
}

main()
  .catch(e => { console.error("✗ 예외", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
