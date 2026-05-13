import BroadcastsManager from "@/components/super/BroadcastsManager";

export const metadata = { title: "본사 공지 · 슈퍼관리자" };

export default function BroadcastsPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">본사 → 협력점 공지</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        긴급 정책·이벤트·마스터 업데이트 등 — 발송 즉시 모든 활성 협력점 콘솔에 표시
      </p>

      <BroadcastsManager />
    </>
  );
}
