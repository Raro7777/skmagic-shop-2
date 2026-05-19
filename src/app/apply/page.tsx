import Link from "next/link";
import ApplyForm from "./ApplyForm";
import { listActivePartners } from "@/lib/partnerSite";
import { HQ_HOTLINE, HQ_COMPANY_NAME } from "@/lib/constants/hq";

export const metadata = {
  title: "분양 신청 · SK매직 공식인증점 모집",
  description: "월 30,000원부터 시작하는 SK매직 공식인증점 분양. 본사가 상품·정책·정산을 전부 관장합니다.",
};

export default async function ApplyPage() {
  const demoPartners = await listActivePartners();

  return (
    <div className="bg-rk-soft-2 min-h-screen">
      {/* Top nav */}
      <header className="bg-white border-b border-rk-line sticky top-0 z-30">
        <div className="max-w-[1100px] mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div className="w-7 h-7 bg-rk-orange text-white rounded grid place-items-center font-bold text-[12px]">SK</div>
            <b className="text-rk-ink text-[14px]">SK매직 공식인증점 모집</b>
          </Link>
          <nav className="hidden md:flex gap-5 text-[13px] text-rk-text ml-4 font-medium">
            <a href="#why" className="no-underline hover:text-rk-orange-deep transition-colors">왜 인증점인가</a>
            <a href="#packages" className="no-underline hover:text-rk-orange-deep transition-colors">분양 패키지</a>
            <a href="#revenue" className="no-underline hover:text-rk-orange-deep transition-colors">수익 모델</a>
            <a href="#process" className="no-underline hover:text-rk-orange-deep transition-colors">분양 절차</a>
            <a href="#faq" className="no-underline hover:text-rk-orange-deep transition-colors">FAQ</a>
          </nav>
          <a
            href="#apply"
            className="ml-auto bg-rk-orange hover:bg-rk-orange-deep text-white px-4 py-1.5 rounded text-[13px] font-semibold no-underline transition-colors"
          >
            지금 신청
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-rk-navy text-white" style={{ backgroundImage: "radial-gradient(ellipse at 90% 100%, rgba(242,106,31,.4), transparent 60%)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-16 md:py-24 text-center">
          <span className="inline-block bg-white/15 text-white text-[12px] px-3 py-1.5 rounded-full font-semibold mb-5 tracking-wide">
            SK매직·코웨이·청호나이스 종합 렌탈
          </span>
          <h1 className="text-[30px] md:text-[44px] font-bold tracking-[-.025em] leading-[1.25] m-0 mb-5">
            <span className="text-[#FFB374]">월 ₩30,000</span>으로 시작하는<br />
            나만의 SK매직 분양점
          </h1>
          <p className="text-[16px] md:text-[18px] text-white/95 leading-[1.7] m-0 mb-8 max-w-[700px] mx-auto font-medium">
            본사가 상품·정책·정산까지 전부 관장합니다. 분양주는 <b className="text-[#FFB374]">자기 영업·차별화 사은품</b>에만 집중하세요.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="#apply"
              className="bg-rk-orange hover:bg-rk-orange-deep text-white px-7 py-3.5 rounded-md font-semibold text-[15px] no-underline transition-colors shadow-md"
            >
              📝 분양 신청서 작성
            </a>
            <a
              href="#packages"
              className="bg-white/15 hover:bg-white/25 text-white px-7 py-3.5 rounded-md font-semibold text-[15px] no-underline transition-colors border border-white/20"
            >
              패키지 비교 보기
            </a>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-10 md:mt-14 max-w-[600px] mx-auto">
            <Stat num="87" unit="개" label="활성 분양점" />
            <Stat num="142" unit="종" label="등록 상품" />
            <Stat num="₩30k~" unit="" label="월 분양료" />
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="why" className="bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <span className="text-[12px] text-rk-orange-deep font-bold tracking-[.12em] uppercase">왜 인증점인가</span>
            <h2 className="text-[26px] md:text-[32px] font-bold text-rk-ink tracking-[-.02em] mt-2 leading-[1.3]">
              혼자 사이트 만들고 운영할 필요가 없습니다
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Feature icon="🎯" title="본사가 모든 걸 처리" desc="상품 마스터·기준가·약관·정산 자동화. 분양주는 영업과 사은품 차별화에만 집중하면 됩니다." />
            <Feature icon="🔗" title="자기 URL · 자기 QR" desc="분양받은 즉시 자기만의 분양 사이트 URL과 QR이 발급됩니다. 영업자별 단독 링크도 무제한 (프리미엄)." />
            <Feature icon="💰" title="투명한 정산" desc="설치 완료 시 자동으로 정산 행 생성. 협력점 콘솔에서 실시간으로 정산액 확인 가능 (룰북 8.2-7)." />
            <Feature icon="📊" title="실시간 lead" desc="고객이 신청하는 즉시 협력점 콘솔에 표시. 휴대폰 마스킹 + 풀번호 권한 자동 적용 (룰북 A3)." />
            <Feature icon="🎁" title="사은품 자율" desc="본사가 정한 수수료 한도 안에서 사은품·설치비 환원을 자유롭게 운영. 상품마다, 시즌마다 다르게." />
            <Feature icon="📱" title="전국 동일 가격" desc="월 렌탈료는 본사가 정한 전국 동일가. 가격 경쟁 없이 사은품/설치비로만 차별화하는 깨끗한 시장." />
          </div>
        </div>
      </section>

      {/* Packages */}
      <section id="packages" className="bg-rk-soft-2">
        <div className="max-w-[1100px] mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <span className="text-[12px] text-rk-orange-deep font-bold tracking-[.12em] uppercase">분양 패키지</span>
            <h2 className="text-[26px] md:text-[32px] font-bold text-rk-ink tracking-[-.02em] mt-2 leading-[1.3]">
              규모에 맞춰 시작하세요
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Plan
              name="베이직"
              price="30,000"
              tag="개인 영업자 시작용"
              features={["분양 사이트 1개 (자기 URL)", "lead DB 관리", "QR + 카톡 공유 문구", "이번 달 정산 미리보기", "월 기본 리포트"]}
            />
            <Plan
              name="스탠다드"
              price="50,000"
              tag="2~3인 팀에 추천"
              highlight
              features={["베이직 모든 기능", "영업자 개인 링크 3명", "지역 키워드 페이지 1개", "상담 상태 관리 (감사 로그)", "카톡 공유 문구 빌더"]}
            />
            <Plan
              name="프리미엄"
              price="80,000"
              tag="회사 단위 운영"
              features={["스탠다드 모든 기능", "영업자 개인 링크 무제한", "광고 추적 리포트 (UTM)", "지역 페이지 다수 운영", "본사 우선 배정 lead 제공"]}
            />
          </div>

          <div className="bg-white border border-rk-line rounded-lg p-6 mt-6 text-[14px] text-rk-text leading-[1.75]">
            <b className="text-rk-ink block mb-2 text-[15px]">📌 공통 사항 (모든 패키지)</b>
            • 분양료는 <b>월 단위</b>로 후불 청구. 첫 30일은 시범 사용 (해지 가능).<br />
            • 설치 완료 시 별도로 <b>대당 ₩37,000~₩60,000</b>의 판매수수료 정산 (상품마다 다름).<br />
            • 본사 일괄 이벤트(어버이날 등) 참여 의무 — 기간 중 사은품 환원 일시 잠금.<br />
            • 협력점 사이트 도메인은 <code className="bg-rk-soft px-1 rounded font-mono text-[13px]">skmagic-shop.com/p/[코드]</code> 형태이며, 추가 비용으로 자기 도메인 연결 가능 (예: gangnam-skmagic.com).
          </div>
        </div>
      </section>

      {/* Revenue model */}
      <section id="revenue" className="bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <span className="text-[12px] text-rk-orange-deep font-bold tracking-[.12em] uppercase">수익 모델</span>
            <h2 className="text-[26px] md:text-[32px] font-bold text-rk-ink tracking-[-.02em] mt-2 leading-[1.3]">
              가입 1건당 평균 <span className="text-rk-orange">₩37,000</span> 실수령
            </h2>
            <p className="text-[14px] text-rk-text mt-3 max-w-[620px] mx-auto leading-[1.6]">
              본사 수수료에서 협력점이 사은품/설치비 환원으로 사용한 금액을 차감한 실수령액 예시 (정수기 PURE+ 기준)
            </p>
          </div>

          <div className="bg-gradient-to-br from-rk-tint-orange to-rk-tint-blue border border-[#F4DCC9] rounded-lg p-6 md:p-8 max-w-[760px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-center">
              <RevExample title="월 5건 가입" sub="개인 영업자" amount="185,000" />
              <RevExample title="월 20건 가입" sub="팀 단위 운영" amount="740,000" highlight />
              <RevExample title="월 50건 가입" sub="회사 단위" amount="1,850,000" />
            </div>
            <div className="text-center text-[13px] text-rk-text mt-6 leading-[1.7]">
              ⓘ PURE+ 기준 (월 ₩29,900) · 본사 수수료 ₩45,000 + 인센티브 ₩5,000 − 사은품 ₩8,000 − 설치비 환원 ₩0 = <b className="text-rk-ink">실수령 ₩37,000/대</b><br />
              상품마다 수수료가 다르며 안마의자·매트리스 등 고가 상품은 대당 ₩60,000~₩120,000도 가능합니다.
            </div>
          </div>
        </div>
      </section>

      {/* Demo sites */}
      <section className="bg-rk-soft-2">
        <div className="max-w-[1100px] mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-8">
            <span className="text-[12px] text-rk-orange-deep font-bold tracking-[.12em] uppercase">실제 분양 사이트 시연</span>
            <h2 className="text-[26px] md:text-[32px] font-bold text-rk-ink tracking-[-.02em] mt-2 leading-[1.3]">
              지금 운영 중인 분양 사이트
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {demoPartners.map(p => (
              <Link
                key={p.partnerCode}
                href={`/p/${p.partnerCode}`}
                target="_blank"
                className="block bg-white border border-rk-line rounded-lg p-5 hover:border-rk-navy hover:shadow-md transition-all no-underline"
              >
                <div className="font-mono text-[11px] text-rk-faint">/p/{p.partnerCode}</div>
                <b className="block text-rk-ink mt-1.5 text-[17px] tracking-[-.01em]">{p.partnerName}</b>
                <small className="block text-rk-muted text-[13px] mt-1">{p.brandLabel}</small>
                <small className="block text-rk-text text-[13px] mt-2">📍 {p.region}</small>
                <div className="text-[13px] text-rk-info mt-4 font-semibold">사이트 열기 →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <span className="text-[12px] text-rk-orange-deep font-bold tracking-[.12em] uppercase">분양 절차</span>
            <h2 className="text-[26px] md:text-[32px] font-bold text-rk-ink tracking-[-.02em] mt-2 leading-[1.3]">
              신청부터 운영 시작까지 1주일
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Step n="1" title="분양 신청서 제출" desc="본 페이지 폼 작성 후 제출. 사업자 등록증 첨부 (개인사업자/법인 모두 가능)." />
            <Step n="2" title="본사 검토" desc="1~2 영업일 내 자격 확인 및 인증코드 발급 (SK매직 인증점 자격 등)." />
            <Step n="3" title="분양 계약 + 셋업" desc="분양 계약 체결 후 협력점 코드 발급 → 자기 사이트 즉시 활성화." />
            <Step n="4" title="영업 시작" desc="QR/카톡 공유 문구로 즉시 영업 시작. 콘솔에서 lead 처리 + 정책 조정." />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-rk-soft-2">
        <div className="max-w-[760px] mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-8">
            <span className="text-[12px] text-rk-orange-deep font-bold tracking-[.12em] uppercase">자주 묻는 질문</span>
            <h2 className="text-[26px] md:text-[32px] font-bold text-rk-ink tracking-[-.02em] mt-2 leading-[1.3]">
              분양 전 궁금한 것들
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            <Faq q="개인사업자도 분양받을 수 있나요?" a="네. 개인사업자, 법인, 1인 영업자 모두 가능합니다. 사업자 등록증과 SK매직 인증코드(없으면 본사가 발급 도움)가 필요합니다." />
            <Faq q="기존 영업하던 분야는 그대로 유지되나요?" a="네. 본사가 강제로 영업 방식을 바꾸지 않습니다. 자기 인맥·블로그·SNS·전단지 등 기존 채널을 그대로 쓰면서, 추가로 본 플랫폼의 분양 사이트와 도구만 활용하시면 됩니다." />
            <Faq q="월 렌탈료를 제가 깎아서 영업할 수 있나요?" a="아닙니다. 월 렌탈료는 본사가 정한 전국 동일가입니다. 다만 협력점이 받는 본사 수수료의 ⅔까지 사은품/설치비 면제로 환원해서 차별화할 수 있습니다." />
            <Faq q="설치 완료된 건은 언제 정산되나요?" a="설치 완료 처리되면 즉시 정산 행이 생성되며, 매월 15일에 일괄 송금됩니다. 정산 금액은 콘솔에서 실시간으로 확인 가능합니다." />
            <Faq q="해지하려면 어떻게 하나요?" a="첫 30일은 시범 사용으로 자유롭게 해지 가능. 이후 월 분양료를 1개월 단위로 후불 청구하므로 해지 즉시 효력 발생합니다. 단, 미정산된 lead는 끝까지 정산받습니다." />
            <Faq q="SK매직 외 다른 브랜드도 분양받을 수 있나요?" a="현재는 SK매직 단독 분양이며, 코웨이·청호나이스 등 입점 브랜드는 본사 기준 정책에 따라 시범 운영 중입니다. 신청서에 관심 브랜드를 표시해주세요." />
            <Faq q="자기 도메인을 연결할 수 있나요?" a="가능합니다 (스탠다드 이상). 자기 보유 도메인(예: gangnam-skmagic.com) 또는 본사가 제공하는 서브도메인으로 자기 분양 사이트에 연결해 운영 가능합니다." />
          </div>
        </div>
      </section>

      {/* Apply form */}
      <section id="apply" className="bg-rk-navy">
        <div className="max-w-[760px] mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-8">
            <span className="text-[12px] text-[#FFB374] font-bold tracking-[.12em] uppercase">분양 신청</span>
            <h2 className="text-[26px] md:text-[32px] font-bold text-white tracking-[-.02em] mt-2 leading-[1.3]">
              지금 분양 신청서를 제출하세요
            </h2>
            <p className="text-[15px] text-white/90 mt-3 font-medium">제출 후 1~2 영업일 내 연락드립니다.</p>
          </div>
          <ApplyForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-rk-soft px-6 py-8 text-[13px] text-rk-text leading-[1.7]">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex gap-4 flex-wrap mb-3">
            <Link href="/legal/terms" className="text-rk-ink font-semibold no-underline">이용약관</Link>
            <Link href="/legal/privacy" className="text-rk-ink font-semibold no-underline">개인정보처리방침</Link>
            <Link href="/" className="text-rk-text no-underline">허브</Link>
          </div>
          <p className="m-0 text-[12px] text-rk-muted">
            © {HQ_COMPANY_NAME} · 분양형 렌탈 플랫폼 · 통신판매중개자 · {HQ_HOTLINE}
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ============ Sub-components ============ */
function Stat({ num, unit, label }: { num: string; unit: string; label: string }) {
  return (
    <div>
      <div className="text-[22px] md:text-[30px] font-bold tracking-[-.02em] text-[#FFB374] rk-num">
        {num}<small className="text-[13px] font-medium text-white/90 ml-0.5">{unit}</small>
      </div>
      <small className="text-[12px] text-white/85 uppercase tracking-[.08em] font-medium">{label}</small>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-rk-soft-2 border border-rk-line-2 rounded-lg p-6">
      <div className="text-[32px] mb-2.5">{icon}</div>
      <b className="text-[16px] text-rk-ink block mb-2 tracking-[-.01em]">{title}</b>
      <p className="text-[14px] text-rk-text m-0 leading-[1.7]">{desc}</p>
    </div>
  );
}

function Plan({
  name, price, tag, features, highlight,
}: {
  name: string; price: string; tag: string; features: string[]; highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg p-6 transition-all " +
        (highlight
          ? "bg-rk-navy text-white border-2 border-rk-orange shadow-lg"
          : "bg-white border border-rk-line")
      }
    >
      {highlight && (
        <span className="inline-block bg-rk-orange text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-2 tracking-wide">
          가장 인기
        </span>
      )}
      <b className={"block text-[20px] font-bold tracking-[-.02em] " + (highlight ? "text-white" : "text-rk-ink")}>{name}</b>
      <small className={"text-[13px] font-medium " + (highlight ? "text-white/85" : "text-rk-muted")}>{tag}</small>
      <div className="mt-3 mb-4">
        <span className={"text-[13px] " + (highlight ? "text-white/85" : "text-rk-muted")}>월</span>{" "}
        <span className={"text-[32px] font-bold tracking-[-.02em] rk-num " + (highlight ? "text-[#FFB374]" : "text-rk-ink")}>
          ₩{price}
        </span>
      </div>
      <ul className={"text-[14px] leading-[1.85] m-0 pl-5 list-disc " + (highlight ? "text-white/95" : "text-rk-text")}>
        {features.map(f => <li key={f}>{f}</li>)}
      </ul>
    </div>
  );
}

function RevExample({ title, sub, amount, highlight }: { title: string; sub: string; amount: string; highlight?: boolean }) {
  return (
    <div className={"py-4 px-4 rounded-md " + (highlight ? "bg-rk-navy text-white" : "")}>
      <b className={"text-[15px] " + (highlight ? "text-white" : "text-rk-ink")}>{title}</b>
      <small className={"block text-[12px] mt-0.5 " + (highlight ? "text-white/85" : "text-rk-muted")}>{sub}</small>
      <div className={"text-[24px] font-bold mt-2 rk-num " + (highlight ? "text-[#FFB374]" : "text-rk-orange-deep")}>
        ₩{amount}
      </div>
      <small className={"text-[12px] font-medium " + (highlight ? "text-white/85" : "text-rk-muted")}>월 실수령</small>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="bg-rk-soft-2 border border-rk-line-2 rounded-lg p-6 relative">
      <div className="absolute -top-3 -left-3 w-9 h-9 bg-rk-orange text-white rounded-full grid place-items-center font-bold text-[15px]">
        {n}
      </div>
      <b className="text-[16px] text-rk-ink block mb-2 mt-1 tracking-[-.01em]">{title}</b>
      <p className="text-[14px] text-rk-text m-0 leading-[1.7]">{desc}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-white border border-rk-line rounded-md p-5">
      <summary className="cursor-pointer list-none flex items-center justify-between text-[15px] font-semibold text-rk-ink">
        <span>Q. {q}</span>
        <span className="text-rk-muted text-[13px] group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <p className="text-[14px] text-rk-text leading-[1.75] mt-3 m-0 pl-3 border-l-2 border-rk-orange">{a}</p>
    </details>
  );
}
