import AuditLogViewer from "@/components/super/AuditLogViewer";

export const metadata = { title: "감사 로그 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default function AuditLogPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">감사 로그</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        로그인 · 비밀번호 변경 · 계정 발급/잠금/상태 변경 등 보안 이벤트 이력
      </p>
      <AuditLogViewer />
      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        ⓘ 모든 로그인 시도(성공·실패·잠금)는 IP·User-Agent와 함께 자동 기록됩니다.
        의심스러운 IP에서 반복 실패가 보이면 해당 계정 잠금 또는 비활성화를 검토하세요.
      </div>
    </>
  );
}
