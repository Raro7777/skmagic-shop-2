import Link from "next/link";
import { detectAnomalies, type AnomalyItem } from "@/lib/anomalyDetect";

export const metadata = { title: "운영 이상감지 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const SEV_PILL: Record<AnomalyItem["severity"], string> = {
  critical: "bg-rk-tint-red text-rk-sale",
  warn:     "bg-rk-tint-orange text-rk-orange-deep",
  info:     "bg-rk-tint-blue text-rk-info",
};
const SEV_LABEL: Record<AnomalyItem["severity"], string> = {
  critical: "긴급",
  warn:     "주의",
  info:     "안내",
};

export default async function AnomaliesPage() {
  const report = await detectAnomalies({});

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">운영 이상감지</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        실시간 자동 탐지 · 미응답 lead·보류·중복 판정·한도 초과·매출 정체 등 ({report.items.length}건)
      </p>

      {report.items.length === 0 ? (
        <div className="bg-white border border-rk-line rounded-lg p-8 text-center">
          <div className="text-[32px] mb-2">✓</div>
          <p className="text-[13px] text-rk-text m-0">현재 감지된 이상 없음</p>
          <small className="text-[13px] text-rk-muted block mt-1">
            모든 협력점이 정상 운영 중입니다.
          </small>
        </div>
      ) : (
        <div className="bg-white border border-rk-line rounded-lg p-4">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                {["심각도", "유형", "협력점", "내용", "경과", ""].map(h => (
                  <th key={h} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[13px] uppercase tracking-[.04em] border-b border-rk-line">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.items.map((a, i) => (
                <tr key={i} className="hover:bg-rk-soft-2">
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <span className={"text-[12px] px-1.5 py-px rounded font-medium " + SEV_PILL[a.severity]}>
                      {SEV_LABEL[a.severity]}
                    </span>
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 text-rk-text">{a.kindLabel}</td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <b className="text-rk-ink">{a.partnerName ?? "—"}</b>
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 text-rk-text">{a.description}</td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-rk-muted text-[13px]">
                    {a.ageMinutes > 0 ? formatAge(a.ageMinutes) : "—"}
                  </td>
                  <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                    <Link href={a.cta.href} className="text-[13px] text-rk-info no-underline whitespace-nowrap">
                      {a.cta.label} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
        {Object.entries(report.countsByKind).map(([kind, count]) => (
          <div key={kind} className="bg-white border border-rk-line rounded-md p-2.5 text-[13px]">
            <div className="text-rk-muted text-[12px]">{LABEL_OF[kind] ?? kind}</div>
            <div className="text-rk-ink font-bold text-[16px] rk-num mt-0.5">{count}건</div>
          </div>
        ))}
      </div>

      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        ⓘ 자동 감지 룰: 4시간 이상 미처리 신규 lead · 보류 상태 lead · 2/3순위 중복 후보 · 사은품 환원 한도 80%↑ · 14일간 lead 없는 협력점.
        페이지 새로고침할 때마다 다시 계산됩니다.
      </div>
    </>
  );
}

const LABEL_OF: Record<string, string> = {
  unresponsive_lead:  "📞 미응답",
  warn_lead:          "⚠ 보류",
  duplicate_pending:  "🔁 중복 판정",
  policy_overspend:   "💰 한도",
  stale_partner:      "📊 정체",
};

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  return `${Math.floor(hours / 24)}일`;
}
