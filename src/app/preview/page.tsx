import Link from "next/link";
import { getLandingStats } from "@/lib/landingStats";
import LiveCounter from "@/components/landing/LiveCounter";
import KoreaMap from "@/components/landing/KoreaMap";
import LiveFeed from "@/components/landing/LiveFeed";
import ROICalculator from "@/components/landing/ROICalculator";
import ApplyInline from "@/components/landing/ApplyInline";

export const metadata = { title: "협력점 분양 — 렌트왕 (Preview)" };
export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtCompact = (n: number) => {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + "억";
  if (n >= 10_000_000)  return (n / 10_000_000).toFixed(1) + "천만";
  if (n >= 1_000_000)   return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000)      return (n / 10_000).toFixed(0) + "만";
  return n.toString();
};

export default async function PreviewLanding() {
  const s = await getLandingStats();

  // 상위 협력점 한 곳 — 히어로 케이스스터디 후킹용
  const topPoint = [...s.points].sort((a, b) => b.settledThisMonth - a.settledThisMonth)[0];
  const topName = topPoint?.partnerName ?? "강남센터 SK매직";

  return (
    <div className="bg-rk-soft-2 min-h-screen">
      {/* Top bar */}
      <header className="bg-white border-b border-rk-line sticky top-0 z-30">
        <div className="max-w-[1240px] mx-auto px-6 py-2.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div className="w-7 h-7 bg-rk-orange text-white rounded grid place-items-center font-bold text-[12px]">RK</div>
            <span className="font-bold text-rk-ink text-[14px]">렌트왕</span>
            <span className="text-[10px] text-rk-muted ml-1">PREVIEW</span>
          </Link>
          <nav className="flex items-center gap-4 text-[12px]">
            <a href="#live"   className="text-rk-muted no-underline hover:text-rk-ink">실시간 운영</a>
            <a href="#roi"    className="text-rk-muted no-underline hover:text-rk-ink">ROI 계산기</a>
            <a href="#demo"   className="text-rk-muted no-underline hover:text-rk-ink">데모 콘솔</a>
            <a href="#apply"  className="bg-rk-orange hover:bg-rk-orange-deep text-white px-3.5 py-1.5 rounded-full text-[11px] font-medium no-underline">분양 신청</a>
            <Link href="/login" className="text-rk-muted no-underline hover:text-rk-ink">로그인</Link>
          </nav>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="bg-rk-navy text-white">
        <div className="max-w-[1240px] mx-auto px-6 py-14">
          <div className="grid grid-cols-[1.4fr_1fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full text-[10px] font-medium mb-3">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rk-success animate-pulse" />
                SK매직 인증점 분양 운영 중
              </div>
              <h1 className="text-[40px] font-bold tracking-[-.025em] leading-[1.15] mb-3">
                월 1억 매출, 직원 1명.<br />
                <span className="text-[#FF8A4C]">{topName}</span>의 비결.
              </h1>
              <p className="text-[14px] text-white/70 leading-[1.6] max-w-[540px] mb-5">
                본사가 상품·정책·인증을 잡고, 협력점이 자기 도메인으로 운영. 영업·홍보·운영이 한 콘솔에서 끝납니다.
                초기비용 없이 분양료만으로 SK매직 인증 매장을 시작하세요.
              </p>
              <div className="flex gap-2 flex-wrap">
                <a href="#apply" className="bg-rk-orange hover:bg-rk-orange-deep text-white px-5 py-2.5 rounded-md text-[13px] font-semibold no-underline">
                  분양 신청 보내기 →
                </a>
                <a href="#live" className="bg-white/10 hover:bg-white/15 text-white px-5 py-2.5 rounded-md text-[13px] font-medium no-underline border border-white/15">
                  운영 현황 먼저 보기
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <HeroCounter label="운영 협력점" value={s.partnerCount} suffix="곳" tone="orange" />
              <HeroCounter label="누적 거래액" value={s.cumulativeGmv} prefix="₩" tone="success" compact />
              <HeroCounter label="이번 달 신규 lead" value={s.totalLeads30d} suffix="건" tone="navy" />
              <HeroCounter label="전환율" value={s.conversionRate} suffix="%" decimals={1} tone="info" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── LIVE CONTROL TOWER ─── */}
      <section id="live" className="max-w-[1240px] mx-auto px-6 py-12">
        <div className="flex items-baseline mb-4 gap-3 flex-wrap">
          <h2 className="text-[24px] font-bold tracking-[-.02em] text-rk-ink">📡 라이브 운영 컨트롤타워</h2>
          <small className="text-[12px] text-rk-muted">이 시간 지금, 전국 협력점에서 무엇이 일어나는지 그대로 보여줍니다.</small>
        </div>
        <div className="grid grid-cols-[1.3fr_1fr] gap-4">
          <KoreaMap points={s.points} />
          <LiveFeed initial={s.feed} />
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <KpiBox label="등록 상품" value={s.totalProducts} suffix="종" hint="SK매직 5월 정책 반영" />
          <KpiBox label="최저 월렌탈" value={s.minRental} prefix="₩" suffix="원~" hint="비데 BIDS17D 기준" />
          <KpiBox label="평균 수수료/건" value={s.avgCommission} prefix="₩" suffix="원" hint="정수기 HqPolicy 평균" />
          <KpiBox label="이번 달 GMV" value={s.monthlyGmv} prefix="₩" suffix="" compact hint="협력점 송금 합계" />
        </div>
      </section>

      {/* ─── ROI ─── */}
      <section id="roi" className="bg-white border-y border-rk-line">
        <div className="max-w-[1240px] mx-auto px-6 py-12">
          <div className="flex items-baseline mb-4 gap-3 flex-wrap">
            <h2 className="text-[24px] font-bold tracking-[-.02em] text-rk-ink">💡 내가 분양받으면?</h2>
            <small className="text-[12px] text-rk-muted">슬라이더로 직접 시뮬레이션. 실제 본사 수수료 정책 기반.</small>
          </div>
          <ROICalculator avgCommission={s.avgCommission} />
        </div>
      </section>

      {/* ─── COMPARE ─── */}
      <section className="max-w-[1240px] mx-auto px-6 py-12">
        <h2 className="text-[24px] font-bold tracking-[-.02em] text-rk-ink mb-4">⚖️ 직접 창업 vs 우리 분양</h2>
        <CompareTable />
      </section>

      {/* ─── SCENARIO DEMO ─── */}
      <section id="demo" className="bg-rk-ink text-white">
        <div className="max-w-[1240px] mx-auto px-6 py-12">
          <div className="flex items-baseline mb-5 gap-3 flex-wrap">
            <h2 className="text-[24px] font-bold tracking-[-.02em]">🖱 직접 만져보세요</h2>
            <small className="text-[12px] text-white/55">실제 콘솔이 그대로 떠 있습니다. 분양 받기 전 운영을 미리 체험.</small>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Scenario
              role="시나리오 1"
              title="내가 협력점 점주라면?"
              desc="자기 도메인의 매장 사이트, 주문 파이프라인, 영업자 관리, 정산까지 한 콘솔에서."
              href="/admin/franchise"
              cta="협력점 콘솔 진입 →"
              hint="로그인: gangnam@rentking.kr / demo1234"
            />
            <Scenario
              role="시나리오 2"
              title="본사 운영자라면?"
              desc="전국 협력점 KPI · 인증/설치/정산/환수 큐 · 정책 일괄 적용 · 협력점 가입 승인."
              href="/admin/super"
              cta="본사 콘솔 진입 →"
              hint="로그인: hq@rentking.kr / demo1234"
              accent
            />
            <Scenario
              role="시나리오 3"
              title="고객이 가입한다면?"
              desc="협력점 매장 사이트에서 상품 선택 → 옵션(약정/모드/타사보상) → 상담 신청 1탭."
              href={topPoint ? `/p/${topPoint.partnerCode}` : "/p/gangnam-skmagic"}
              cta="매장 사이트 보기 →"
              hint={`예: ${topName}`}
            />
          </div>
        </div>
      </section>

      {/* ─── APPLY ─── */}
      <section id="apply" className="max-w-[1240px] mx-auto px-6 py-12">
        <div className="grid grid-cols-[1fr_1fr] gap-6 items-start">
          <div>
            <h2 className="text-[28px] font-bold tracking-[-.02em] text-rk-ink mb-3">
              지금 신청하면 <span className="text-rk-orange">초기 비용 ₩0</span>
            </h2>
            <p className="text-[13px] text-rk-muted leading-[1.65] mb-3">
              본사 검토 후 1~2 영업일 내 연락드립니다. 승인 즉시 매장 사이트(`/p/내점`)와 운영 콘솔 로그인 정보가 발송됩니다.
            </p>
            <ul className="text-[12px] text-rk-text leading-[1.85] list-disc pl-5">
              <li>본사 정책 자동 동기화 (월 단위 SK매직 시트 일괄 반영)</li>
              <li>독립 도메인 운영 (`/p/내점` + 자기 영업자 링크)</li>
              <li>14단계 lifecycle 자동 추적 (상담 → 인증 → 설치 → 정산 → 환수)</li>
              <li>본사 송금 5/15일 자동 계산 · 환수까지 한 콘솔</li>
            </ul>
            <div className="mt-4 bg-rk-tint-blue text-rk-info px-3.5 py-2.5 rounded text-[11px] flex gap-1.5 items-center">
              <span>📞</span>
              <span>상담 전화: <b>1600-2434</b> · 평일 9-18시</span>
            </div>
          </div>
          <ApplyInline />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-rk-line">
        <div className="max-w-[1240px] mx-auto px-6 py-6 text-[11px] text-rk-faint flex items-center justify-between flex-wrap gap-2">
          <span>© 렌트왕 · SK매직 인증점 분양 운영 플랫폼</span>
          <span>이 페이지는 <b>/preview</b> — 기존 메인은 <Link href="/" className="text-rk-info no-underline">/</Link></span>
        </div>
      </footer>
    </div>
  );
}

function HeroCounter({ label, value, prefix, suffix, decimals, tone, compact }: {
  label: string; value: number; prefix?: string; suffix?: string; decimals?: number;
  tone: "orange" | "success" | "navy" | "info"; compact?: boolean;
}) {
  const TONE: Record<string, string> = {
    orange:  "text-[#FF8A4C]",
    success: "text-[#6FE4A8]",
    navy:    "text-white",
    info:    "text-[#79C0FF]",
  };
  return (
    <div className="bg-white/8 border border-white/12 rounded-lg p-3.5">
      <small className="block text-[10px] uppercase tracking-[.06em] text-white/55">{label}</small>
      <div className={"mt-1 text-[24px] font-bold tracking-[-.02em] rk-num " + TONE[tone]}>
        {compact ? (
          <span>{prefix}{fmtCompact(value)}{suffix}</span>
        ) : (
          <LiveCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
        )}
      </div>
    </div>
  );
}

function KpiBox({ label, value, prefix, suffix, hint, compact }: {
  label: string; value: number; prefix?: string; suffix?: string; hint: string; compact?: boolean;
}) {
  return (
    <div className="bg-white border border-rk-line rounded-lg p-3.5">
      <small className="block text-[10px] uppercase tracking-[.04em] text-rk-muted">{label}</small>
      <b className="block mt-1 text-[20px] tracking-[-.02em] text-rk-ink rk-num">
        {compact ? <>{prefix}{fmtCompact(value)}{suffix}</> : <>{prefix}{fmt(value)}{suffix}</>}
      </b>
      <small className="block text-[10px] text-rk-faint mt-0.5">{hint}</small>
    </div>
  );
}

function CompareTable() {
  const rows: Array<[string, { self: string; ours: string; advantage?: "self" | "ours" }]> = [
    ["초기 자본",         { self: "1~5천만원 (계약금·시설·재고)", ours: "분양료 30~200만원/월", advantage: "ours" }],
    ["상품 정책",         { self: "직접 SK매직과 계약·관리",        ours: "본사가 매월 정책 자동 적용",   advantage: "ours" }],
    ["고객 사이트",       { self: "자체 개발/외주 (수백만원~)",   ours: "/p/내점 즉시 발급",            advantage: "ours" }],
    ["주문/정산 관리",    { self: "엑셀/수기",                    ours: "14단계 자동 lifecycle",        advantage: "ours" }],
    ["영업자 관리",       { self: "별도 시스템 필요",              ours: "콘솔 내장 + 링크/수수료 자동", advantage: "ours" }],
    ["마케팅",            { self: "직접 광고 운용",                ours: "본사 광고비 지원 (최대 7천만)", advantage: "ours" }],
    ["리스크",            { self: "재고/계약 직접 책임",           ours: "본사가 본인증·송금 책임",       advantage: "ours" }],
    ["수익 구조",         { self: "전부 본인 (단, 비용도)",        ours: "수수료 - 분양료 = 순익",        advantage: "self" }],
  ];
  return (
    <div className="bg-white border border-rk-line rounded-xl overflow-hidden">
      <table className="w-full text-[12px] border-collapse">
        <thead className="bg-rk-soft-2">
          <tr>
            <th className="text-left px-4 py-3 text-rk-muted font-medium text-[11px] uppercase tracking-[.04em]">구분</th>
            <th className="text-left px-4 py-3 text-rk-muted font-medium text-[11px] uppercase tracking-[.04em]">🏚 직접 창업</th>
            <th className="text-left px-4 py-3 text-rk-orange-deep font-medium text-[11px] uppercase tracking-[.04em]">🏪 렌트왕 분양</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className="border-t border-rk-line-2">
              <td className="px-4 py-2.5 font-medium text-rk-ink">{k}</td>
              <td className={"px-4 py-2.5 " + (v.advantage === "self" ? "text-rk-ink" : "text-rk-muted")}>
                {v.self}
              </td>
              <td className={"px-4 py-2.5 " + (v.advantage === "ours" ? "text-rk-orange-deep font-medium" : "text-rk-ink")}>
                {v.ours}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Scenario({ role, title, desc, href, cta, hint, accent }: {
  role: string; title: string; desc: string; href: string; cta: string; hint: string; accent?: boolean;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      className={
        "block rounded-xl p-5 transition-all no-underline " +
        (accent
          ? "bg-rk-orange text-white hover:brightness-110"
          : "bg-white/8 hover:bg-white/12 text-white border border-white/15")
      }
    >
      <small className="text-[10px] uppercase tracking-[.08em] opacity-65 block">{role}</small>
      <h4 className="text-[18px] font-bold tracking-[-.02em] mt-1 mb-1.5 leading-[1.25]">{title}</h4>
      <p className="text-[12px] opacity-80 leading-[1.55] mb-3">{desc}</p>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[12px] font-medium">{cta}</span>
      </div>
      <small className="block text-[10px] opacity-55 mt-2 font-mono">{hint}</small>
    </Link>
  );
}
