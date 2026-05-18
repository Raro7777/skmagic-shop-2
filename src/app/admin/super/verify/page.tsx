import { prisma } from "@/lib/prisma";
import VerifyQueueList from "@/components/super/VerifyQueueList";

export const metadata = { title: "인증 처리 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  // 인증대기 + 회신 후 재제출(verify_pending) 큐
  const pending = await prisma.lead.findMany({
    where: { status: "verify_pending" },
    orderBy: { updatedAt: "asc" },
    include: {
      partner: { select: { partnerName: true, region: true } },
    },
  });

  // 회신 작성된(revise_resubmit) 리스트 — 다음 재제출 대기
  const responded = await prisma.lead.findMany({
    where: { status: "revise_resubmit" },
    orderBy: { updatedAt: "desc" },
    include: {
      partner: { select: { partnerName: true } },
    },
    take: 10,
  });

  // 회송 후 응답 안 온 (verify_failed / verify_revise) 카운트
  const overdueResponse = await prisma.lead.count({
    where: { status: { in: ["verify_failed", "verify_revise"] } },
  });

  // 협력점이 회신/재제출 시 남긴 메모 — 가장 최근 revise_resubmit/apply_submitted 로의 status log 에서 추출
  const allLeadIds = [...pending.map(p => p.id), ...responded.map(r => r.id)];
  const replyLogs = allLeadIds.length > 0 ? await prisma.leadStatusLog.findMany({
    where: {
      leadId: { in: allLeadIds },
      newStatus: { in: ["revise_resubmit", "apply_submitted"] },
      memo: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { leadId: true, memo: true, newStatus: true, createdAt: true },
  }) : [];
  const partnerReplyByLead = new Map<string, string>();
  for (const log of replyLogs) {
    if (!partnerReplyByLead.has(log.leadId) && log.memo) {
      partnerReplyByLead.set(log.leadId, log.memo);
    }
  }

  const rows = pending.map(l => {
    const ageMs = Date.now() - l.updatedAt.getTime();
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000));
    return {
      id: l.id,
      receivedAt: l.createdAt.toISOString().slice(0, 16).replace("T", " "),
      lastUpdateLabel: ageHours < 1 ? "방금" : ageHours < 24 ? `${ageHours}시간 전` : `${Math.floor(ageHours / 24)}일 전`,
      isOverdue: ageHours >= 6, // 6시간 이상 인증대기면 표시
      customerName: l.customerName,
      phone: l.phoneRaw,
      partnerName: l.partner?.partnerName ?? (l.ownerType === "hq_pool" ? "본사 풀(미배정)" : "—"),
      partnerRegion: l.partner?.region ?? null,
      productInterest: l.productInterest,
      productCode: l.productCode,
      selectedMode: l.selectedMode,
      selectedContractPeriod: l.selectedContractPeriod,
      verifyAttempts: l.verifyAttempts,
      lastReason: l.verifyLastReason,
      partnerReply: partnerReplyByLead.get(l.id) ?? null,
    };
  });

  return (
    <>
      <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">🔍 인증 처리</h1>
        <span className="ml-auto text-[13px] text-rk-muted">
          본사 전담 · 인증완료 시 자동으로 설치대기로 이동
        </span>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        인증대기 <b className="text-rk-ink">{rows.length}건</b>
        {overdueResponse > 0 && <> · 회신 미수신 <b className="text-rk-sale">{overdueResponse}건</b></>}
        {responded.length > 0 && <> · 회신 완료(재인증 대기) <b className="text-rk-info">{responded.length}건</b></>}
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-rk-line rounded-lg p-8 text-center text-[14px] text-rk-muted">
          현재 인증대기 lead가 없습니다. 협력점에서 신청 완료된 lead가 자동으로 여기에 들어옵니다.
        </div>
      ) : (
        <VerifyQueueList rows={rows} />
      )}

      {responded.length > 0 && (
        <section className="bg-white border border-rk-line rounded-lg p-4 mt-3">
          <h3 className="text-[14px] font-semibold mb-2">📥 회신 받은 항목 (재인증 대기)</h3>
          <p className="text-[13px] text-rk-muted mb-2">
            영업점이 회신을 작성했지만 아직 재제출이 안 된 상태. 협력점 콘솔에서 재제출 처리하면 인증대기로 다시 들어옵니다.
          </p>
          <ul className="text-[14px] flex flex-col gap-2">
            {responded.map(l => {
              const reply = partnerReplyByLead.get(l.id);
              return (
                <li key={l.id} className="border-b border-rk-line-2 pb-2 last:border-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <b className="text-rk-ink">{l.customerName}</b>
                    <span className="text-rk-muted">· {l.partner?.partnerName ?? "—"} · {l.productInterest}</span>
                    <span className="text-rk-faint text-[12px] ml-auto">{l.updatedAt.toISOString().slice(0, 10)}</span>
                  </div>
                  {l.verifyLastReason && (
                    <div className="mt-1 text-[12px] bg-rk-tint-orange text-rk-orange-deep px-2 py-1 rounded">
                      🚩 본사 회송 사유: {l.verifyLastReason}
                    </div>
                  )}
                  {reply ? (
                    <div className="mt-1 text-[12px] bg-rk-tint-blue text-rk-info px-2 py-1 rounded whitespace-pre-wrap">
                      💬 협력점 회신: {reply}
                    </div>
                  ) : (
                    <div className="mt-1 text-[12px] text-rk-faint">협력점 회신 메모 없음 (신청서 수정만)</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px]">
        ⓘ 인증완료 → 자동으로 설치대기로 이동 / 인증실패·수정요청 → 사유 입력 시 협력점에 회송됨.
      </div>
    </>
  );
}
