import type { MemoSnapshot } from "@/lib/franchiseDashboard";

const STATE_BG: Record<string, string> = {
  default: "bg-rk-soft-2",
  done:    "bg-rk-soft-2 opacity-70",
  warn:    "bg-rk-tint-red",
};

export default function MemoTimeline({ data }: { data: MemoSnapshot }) {
  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">📞 최근 7일 처리 이력</h3>
        <div className="ml-auto text-[13px] text-rk-muted">최신 {data.items.length}건</div>
      </div>

      {data.items.length === 0 ? (
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-4 text-center text-[14px] text-rk-muted">
          최근 7일간 상태 변경 이력이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {data.items.map(m => (
            <div
              key={m.id}
              className={"grid grid-cols-[80px_1fr_auto] gap-2.5 p-2.5 rounded text-[14px] items-center " + STATE_BG[m.state]}
            >
              <div className={"font-mono font-medium text-[13px] " + (m.state === "warn" ? "text-rk-sale" : "text-rk-muted")}>
                {m.timeLabel}
              </div>
              <div>
                <b className={m.state === "warn" ? "text-rk-sale" : "text-rk-ink"}>{m.title}</b>
                <small className="block text-rk-muted mt-0.5">{m.detail}</small>
              </div>
              <span className="text-[13px] text-rk-success">{m.state === "done" ? "✓" : m.state === "warn" ? "⚠" : "→"}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-3 py-2.5 bg-rk-tint-blue rounded text-[13px] text-rk-info mt-2">
        💡 <b>내일 처리 항목</b> · {data.tomorrowSummary}
      </div>
    </div>
  );
}
