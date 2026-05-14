"use client";

/**
 * 정산 마진 흐름 시각화 — 본사수수료에서 협력점 실수령까지 단계별 표기.
 *
 *   본사수수료
 *     ↓ −본사마진
 *   영업점수수료 ★ (정책 표기 + 환수 기준)
 *     ↓ −사은품 −설치 −렌탈지원
 *   영업점 풀
 *     ↓ (영업자 있을 때만) − 영업자수수료
 *   협력점 실수령
 */

export type MarginFlowData = {
  baseCommission: number;
  hqMargin: number;
  partnerCommission: number;
  giftReturned: number;
  giftLabel?: string | null;
  installReturned: number;
  rentalSupportReturned: number;
  sellerMargin: number;
  sellerPayout: number;
  netPayout: number;
  refundStatus?: string | null;
  refundAmount?: number | null;
};

const fmt = (n: number) => "₩" + n.toLocaleString("ko-KR");
const fmtSigned = (n: number) => (n >= 0 ? "+" : "") + fmt(n);

export default function MarginFlowDiagram({
  data, compact = false, audience = "hq",
}: {
  data: MarginFlowData;
  compact?: boolean;
  /** "hq" — 본사 콘솔 (본사수수료·본사마진 단계 표시) / "partner" — 협력점 콘솔 (영업점수수료부터 시작) */
  audience?: "hq" | "partner";
}) {
  const hasSeller = data.sellerPayout > 0 || data.sellerMargin > 0;
  const poolBeforeSeller = data.partnerCommission - data.giftReturned - data.installReturned - data.rentalSupportReturned;
  const showHqStages = audience === "hq";

  return (
    <div className={"flex flex-col gap-1 " + (compact ? "text-[12px]" : "text-[13px]")}>
      {/* 1. 본사수수료 — 협력점 모드에선 숨김 */}
      {showHqStages && (
        <>
          <Stage tone="navy" label="본사수수료" amount={data.baseCommission} note="본사가 SK매직에서 받은 수수료" />
          <Arrow>
            <Deduction label="본사마진" amount={data.hqMargin} note="본사가 떼는 몫 (티어/옵션별)" />
          </Arrow>
        </>
      )}

      {/* 2. 영업점수수료 ★ (협력점 모드에서는 시작점) */}
      <Stage
        tone="orange"
        label="영업점수수료"
        amount={data.partnerCommission}
        badge={showHqStages ? "★ 정책 표기 + 환수 기준" : "★ 시작 금액"}
        note={showHqStages ? "협력점에 내려보내는 금액" : ""}
      />

      <Arrow>
        {data.giftReturned > 0 && (
          <Deduction
            label={"사은품" + (data.giftLabel ? ` · ${data.giftLabel}` : "")}
            amount={data.giftReturned}
          />
        )}
        {data.installReturned > 0 && (
          <Deduction label="설치비 환원" amount={data.installReturned} />
        )}
        {data.rentalSupportReturned > 0 && (
          <Deduction label="렌탈지원 (개통 캐시백)" amount={data.rentalSupportReturned} />
        )}
        {data.giftReturned + data.installReturned + data.rentalSupportReturned === 0 && (
          <div className="text-rk-muted text-[12px] py-0.5">환원 없음</div>
        )}
      </Arrow>

      {/* 3. 영업점 풀 (영업자 있을 때만 시각화) */}
      {hasSeller ? (
        <>
          <Stage
            tone="info"
            label="영업점이 가져가는 풀"
            amount={poolBeforeSeller}
            note="영업점수수료 − 환원"
          />
          <div className="grid grid-cols-2 gap-2 mt-1 ml-3">
            <SubStage label="영업점마진 (협력점)" amount={data.sellerMargin} tone="success" />
            <SubStage label="영업자수수료 (영업자)" amount={data.sellerPayout} tone="orange" />
          </div>
          <Arrow centered>
            <span className="text-[11px] text-rk-muted">위 분배 후 협력점이 자기 몫 차지</span>
          </Arrow>
        </>
      ) : (
        <div className="text-[11px] text-rk-muted text-center py-0.5">↓ 영업자 없음 — 영업점 풀 전체가 협력점 실수령</div>
      )}

      {/* 4. 협력점 실수령 */}
      <Stage
        tone={data.netPayout < 0 ? "alert" : "success"}
        label="협력점 실수령 (netPayout)"
        amount={data.netPayout}
        note={data.netPayout < 0 ? "⚠ 영업자수수료 + 환원이 영업점수수료 초과" : ""}
        big
      />

      {/* 환수 표기 */}
      {data.refundStatus && (
        <div className="mt-2 border-t border-rk-line-2 pt-2">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="px-1.5 py-0.5 rounded font-medium bg-rk-tint-orange text-rk-orange-deep">🔄 환수 {refundStatusLabel(data.refundStatus)}</span>
            {data.refundAmount != null && data.refundAmount > 0 && (
              <span className="text-rk-orange-deep rk-num">{fmt(data.refundAmount)}</span>
            )}
            <small className="text-rk-muted">환수 한도 = 영업점수수료 {fmt(data.partnerCommission)} (계약: 본사 ↔ 협력점)</small>
          </div>
        </div>
      )}
    </div>
  );
}

function refundStatusLabel(s: string): string {
  switch (s) {
    case "refund_pending": return "예정";
    case "refund_progress": return "진행";
    case "refund_done": return "완료";
    default: return s;
  }
}

function Stage({ tone, label, amount, badge, note, big }: {
  tone: "navy" | "orange" | "info" | "success" | "alert";
  label: string;
  amount: number;
  badge?: string;
  note?: string;
  big?: boolean;
}) {
  const TONE: Record<string, string> = {
    navy:    "bg-rk-soft border-rk-line text-rk-ink",
    orange:  "bg-rk-tint-orange border-rk-orange/40 text-rk-orange-deep",
    info:    "bg-rk-tint-blue border-[#D8E4F4] text-rk-info",
    success: "bg-rk-tint-green border-rk-success/40 text-rk-success",
    alert:   "bg-rk-tint-red border-rk-sale/40 text-rk-sale",
  };
  return (
    <div className={"border rounded-md px-3 py-2 flex items-center gap-3 flex-wrap " + TONE[tone]}>
      <div className="min-w-[120px]">
        <div className="text-[12px] opacity-75 leading-tight">{label}</div>
        {badge && <div className="text-[10px] opacity-90 mt-0.5">{badge}</div>}
      </div>
      <b className={"rk-num font-bold " + (big ? "text-[18px]" : "text-[15px]")}>{fmtSigned(amount)}</b>
      {note && <span className="text-[11px] opacity-70 ml-auto">{note}</span>}
    </div>
  );
}

function SubStage({ tone, label, amount }: { tone: "success" | "orange"; label: string; amount: number }) {
  const TONE: Record<string, string> = {
    success: "bg-rk-tint-green border-rk-success/40 text-rk-success",
    orange:  "bg-rk-tint-orange border-rk-orange/40 text-rk-orange-deep",
  };
  return (
    <div className={"border rounded px-2.5 py-1.5 " + TONE[tone]}>
      <div className="text-[11px] opacity-80 leading-tight">{label}</div>
      <b className="rk-num text-[14px] mt-0.5 block">{fmt(amount)}</b>
    </div>
  );
}

function Arrow({ children, centered }: { children?: React.ReactNode; centered?: boolean }) {
  return (
    <div className="flex">
      <div className="ml-3 border-l-2 border-dashed border-rk-line-2 pl-3 py-1 flex flex-col gap-0.5 flex-1">
        {centered ? (
          <div className="text-center">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Deduction({ label, amount, note }: { label: string; amount: number; note?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px]">
      <span className="text-rk-muted">−</span>
      <span className="text-rk-text">{label}</span>
      <b className="rk-num text-rk-orange-deep">{fmt(amount)}</b>
      {note && <small className="text-rk-faint">· {note}</small>}
    </div>
  );
}
