import Link from "next/link";
import { listActivePartners } from "@/lib/partnerSite";
import { listAllRegionSlugs } from "@/lib/regionSeo";

export default async function HubPage() {
  const [partners, regions] = await Promise.all([
    listActivePartners(),
    listAllRegionSlugs(),
  ]);
  return (
    <div className="bg-rk-soft-2 min-h-screen">
      <div className="max-w-[1100px] mx-auto px-8 py-12 pb-20">
        <header className="flex justify-between items-center mb-10 flex-wrap gap-3">
          <div className="flex items-center gap-2.5 font-bold text-[18px] text-rk-ink">
            <div className="w-[30px] h-[30px] bg-rk-orange text-white rounded grid place-items-center font-bold text-sm">RK</div>
            <span>렌트왕 협력점 플랫폼</span>
          </div>
          <div className="flex gap-4 items-center text-[12px] text-rk-muted flex-wrap">
            <Link href="/apply" className="bg-rk-orange hover:bg-rk-orange-deep text-white px-3 py-1.5 rounded-full text-[11px] font-medium no-underline transition-colors">
              📝 분양 신청
            </Link>
            <span><b className="text-rk-ink">SK매직</b> 시범 분양 · 2026.05</span>
            <span>로그인: <b className="text-rk-ink">본사 마스터</b></span>
          </div>
        </header>

        <section className="mb-8 max-w-[720px]">
          <h1 className="text-[32px] font-bold tracking-[-.025em] leading-[1.25] mb-2.5 text-rk-ink">
            본사–<b className="text-rk-orange">협력점</b>–소비자, 3계층 렌탈 분양 운영 콘솔
          </h1>
          <p className="text-sm text-rk-muted leading-[1.65] m-0">
            본사가 SK매직 등 종합 렌탈 상품과 기준 정책을 잡고, 동종업계 협력점이 자기 도메인으로
            분양받아 운영합니다. 별도 본사 브랜드 사이트는 두지 않으며, 모든 소비자 트래픽은
            협력점 사이트에서 발생합니다.
          </p>
        </section>

        <div className="grid grid-cols-4 gap-3 mb-9">
          <Stat label="활성 협력점"     num="87"     unit="점"     delta="▲ 이번 달 +6" />
          <Stat label="이번 달 GMV"     num="12.4"   unit="억원"   delta="▲ 8.2% MoM" />
          <Stat label="등록 상품"       num="142"    unit="종"     note="SK매직 · LG · 코웨이" />
          <Stat label="최저 월렌탈가"   num="15,900" unit="원~"    note="비데 BID-S17D 기준" />
        </div>

        <div className="flex items-baseline gap-3 mb-3.5">
          <h2 className="text-[18px] font-bold text-rk-ink">3개 화면</h2>
          <small className="text-[11px] text-rk-muted tracking-[.08em]">SCREEN MAP / 클릭하여 진입</small>
        </div>

        <nav className="grid grid-cols-3 gap-4">
          <RoleCard
            href="/admin/franchise"
            num="02 / DEALER"
            device="DESKTOP 1280"
            title={<>협력점 운영<br /><span className="text-rk-orange">관리자</span></>}
            desc="협력점주가 자기 사이트를 직접 운영. 모델 진열·이벤트 배너 예약·정책 +/- 마진 조정·주문 관리·매출 대시보드."
            chips={["진열 드래그", "배너 예약", "+/- 마진", "매출 보드"]}
            cta="분양주 콘솔 →"
          />
          <RoleCard
            href="/admin/super"
            dark
            num="03 / HQ SUPER ADMIN"
            device="DESKTOP 1440"
            title={<>분양 슈퍼관리자<br /><span style={{ color: "#FFB374" }}>본사 콘솔</span></>}
            desc="본사 운영팀이 전체 협력점 + 정책 + 정산 관리. 협력점 신규 승인 및 일괄 공지."
            chips={["대시보드", "정책", "정산", "협력점 승인"]}
            cta="슈퍼관리자 진입 →"
          />
          <RoleCard
            href={`/p/${partners[0]?.partnerCode ?? "gangnam-skmagic"}`}
            num="01 / END USER"
            device="MOBILE 390"
            title={<>분양된 <br /><span className="text-rk-orange">협력점 사이트</span></>}
            desc="소비자가 보는 모바일 쇼핑몰. 협력점마다 사은품·차별화가 다르게 노출됩니다."
            chips={[`${partners.length}개 협력점`, "모바일", "DB 연동"]}
            cta="첫 협력점 사이트 →"
          />
        </nav>

        {/* 지역으로 시작 — SEO landing entry */}
        <div className="bg-white border border-rk-line rounded-lg p-5 mt-6">
          <div className="flex items-baseline gap-2 mb-3">
            <h3 className="text-[14px] font-bold text-rk-ink">🌐 지역으로 시작 ({regions.length})</h3>
            <small className="text-[11px] text-rk-muted">우리 동네 협력점 + 추천 상품 한 번에 보기</small>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {regions.map(r => (
              <Link
                key={r.slug}
                href={`/region/${r.slug}`}
                className="bg-rk-tint-blue hover:bg-rk-info hover:text-white border border-[#D8E4F4] rounded p-2.5 text-rk-info no-underline transition-colors"
              >
                <b className="block text-[12px]">{r.label}</b>
                <small className="block text-[10px] opacity-80 mt-0.5">{r.partners.length}개 협력점</small>
              </Link>
            ))}
          </div>
        </div>

        {/* All partner sites */}
        <div className="bg-white border border-rk-line rounded-lg p-5 mt-6">
          <div className="flex items-baseline gap-2 mb-3">
            <h3 className="text-[14px] font-bold text-rk-ink">활성 분양 사이트 ({partners.length})</h3>
            <small className="text-[11px] text-rk-muted">동일한 상품 마스터, 협력점마다 다른 사은품·차별화</small>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {partners.map(p => (
              <Link
                key={p.partnerCode}
                href={`/p/${p.partnerCode}`}
                className="block bg-rk-soft-2 hover:bg-white hover:border-rk-navy border border-rk-line-2 rounded-md p-3 text-decoration-none no-underline transition-colors"
              >
                <div className="font-mono text-[10px] text-rk-faint">/p/{p.partnerCode}</div>
                <b className="block text-rk-ink mt-0.5 text-[14px]">{p.partnerName}</b>
                <small className="block text-rk-muted text-[11px] mt-0.5">{p.brandLabel}</small>
                <small className="block text-rk-muted text-[11px] mt-0.5">📍 {p.region}</small>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-white border border-rk-line rounded-lg p-5 mt-8 grid grid-cols-[200px_1fr] gap-6">
          <div>
            <h3 className="text-[14px] mb-1 text-rk-ink">Next.js 포팅 현황</h3>
            <span className="text-rk-muted text-[12px]">3개 화면 모두 통합 완료</span>
          </div>
          <div>
            <ol className="m-0 pl-5 text-[13px] text-rk-text leading-[1.8]">
              <li><b className="text-rk-ink">소비자 모바일 사이트</b> — 히어로 자동 페이저 · 카테고리 탭 · 좋아요 토글</li>
              <li><b className="text-rk-ink">협력점 콘솔</b> — 9개 섹션 분해, 정책 편집기 라이브 미리보기, PIN 토글</li>
              <li><b className="text-rk-ink">슈퍼관리자</b> — KPI · 승인 큐 · 지역 그리드 · TOP/부진 · 정산 · 공지</li>
            </ol>
            <div className="bg-rk-tint-blue text-rk-info px-2.5 py-2 rounded text-[12px] font-medium mt-2.5 flex gap-1.5 items-start">
              <span>ⓘ</span>
              <span>
                정적 HTML 레퍼런스 버전도 비교용으로{" "}
                <a href="https://rentking.vercel.app" className="underline" target="_blank">rentking.vercel.app</a>
                에 유지되고 있습니다.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, num, unit, delta, note }: { label: string; num: string; unit: string; delta?: string; note?: string }) {
  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <span className="text-[11px] text-rk-muted block mb-1">{label}</span>
      <div className="text-[22px] font-bold text-rk-ink tracking-[-.02em] rk-num">
        {num}<small className="text-[13px] font-medium text-rk-muted">{unit}</small>
      </div>
      {delta && <div className="text-[11px] text-rk-success mt-0.5">{delta}</div>}
      {note && <span className="text-[11px] text-rk-muted mt-0.5 block">{note}</span>}
    </div>
  );
}

function RoleCard({
  href, disabled, dark, num, device, title, desc, chips, cta,
}: {
  href?: string; disabled?: boolean; dark?: boolean;
  num: string; device: string;
  title: React.ReactNode; desc: string; chips: string[]; cta: string;
}) {
  const inner = (
    <>
      <span className={"absolute top-3.5 right-4 text-[10px] font-mono tracking-[.04em] " + (dark ? "text-white/60" : "text-rk-faint")}>
        {device}
      </span>
      <div className={"rounded h-[110px] overflow-hidden border " + (dark ? "border-white/10 bg-rk-navy-deep" : "bg-rk-soft border-rk-line-2")} />
      <div>
        <div className={"text-[11px] tracking-[.12em] font-medium " + (dark ? "text-white/60" : "text-rk-muted")}>{num}</div>
        <div className={"text-[18px] font-bold leading-[1.25] tracking-[-.02em] " + (dark ? "text-white" : "text-rk-ink")}>{title}</div>
        <div className={"text-[13px] leading-[1.6] mt-2 min-h-[64px] " + (dark ? "text-white/60" : "text-rk-muted")}>{desc}</div>
      </div>
      <div className="flex flex-wrap gap-1">
        {chips.map(c => (
          <span
            key={c}
            className={"text-[11px] px-1.5 py-0.5 rounded font-medium " + (dark ? "bg-white/10 text-white/85" : "bg-rk-soft text-rk-text")}
          >
            {c}
          </span>
        ))}
      </div>
      <div
        className={
          "flex justify-between items-center pt-3 border-t mt-auto text-[13px] font-medium " +
          (dark ? "text-white border-white/15" : "text-rk-navy border-rk-line-2")
        }
      >
        <span>{cta}</span>
        <span
          className={
            "w-6 h-6 rounded-full grid place-items-center transition-all group-hover:bg-rk-orange group-hover:text-white group-hover:translate-x-[3px] " +
            (dark ? "bg-white/10 text-white" : "bg-rk-soft")
          }
        >
          →
        </span>
      </div>
    </>
  );

  const baseClass =
    "group rounded-[10px] p-5 cursor-pointer flex flex-col gap-3.5 transition-all border relative " +
    (dark
      ? "bg-rk-navy text-white border-rk-navy hover:shadow-[0_2px_8px_rgba(20,25,40,.06)] hover:-translate-y-0.5"
      : "bg-white border-rk-line hover:border-rk-navy hover:shadow-[0_2px_8px_rgba(20,25,40,.06)] hover:-translate-y-0.5") +
    (disabled ? " opacity-60 pointer-events-none" : "");

  if (disabled || !href) return <div className={baseClass}>{inner}</div>;
  return <Link href={href} className={baseClass + " no-underline"}>{inner}</Link>;
}
