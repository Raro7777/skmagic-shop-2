import Link from "next/link";
import { notFound } from "next/navigation";
import PartnerHeader from "@/components/consumer/PartnerHeader";
import PartnerFooter from "@/components/consumer/PartnerFooter";
import PartnerCta from "@/components/consumer/PartnerCta";
import { getPartnerHeader } from "@/lib/partnerSite";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerCode: string }>;
}) {
  const { partnerCode } = await params;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) return { title: "Not Found" };
  return { title: `고객센터 · ${partner.partnerName}` };
}

const FAQS = [
  {
    section: "가입 · 신청",
    items: [
      { q: "상담 신청은 어떻게 하나요?", a: "사이트 하단의 '✍ 상담 신청' 버튼을 눌러 이름·휴대폰·관심상품을 입력하시면 됩니다. 접수 후 30분 이내에 카톡 또는 전화로 연락드립니다." },
      { q: "방문상담도 가능한가요?", a: "가능합니다. 카톡 상담에서 방문 일정을 협의하시거나, 신청 시 메모에 '방문상담 희망'을 남겨주시면 매니저가 일정 맞춰 방문드립니다." },
      { q: "신청 후 취소가 가능한가요?", a: "설치 전이라면 언제든 취소 가능합니다. 설치 후에는 본 상품 공급사(SK매직㈜)의 위약금 규정이 적용됩니다." },
    ],
  },
  {
    section: "가격 · 결제",
    items: [
      { q: "월 렌탈료는 협력점마다 다른가요?", a: "아닙니다. 월 렌탈료는 본사가 정한 전국 동일가입니다. 사은품/설치비 면제 등의 혜택만 협력점마다 다릅니다." },
      { q: "신용카드 할인은 어떻게 받나요?", a: "신청 시 제휴 카드를 신규 발급하시면 매월 자동으로 할인된 금액이 차감됩니다. 카드 발급은 무료, 연회비는 카드사에 따라 다릅니다." },
      { q: "카드 결제 외 다른 방법도 있나요?", a: "은행 자동이체 등 다양한 결제 방법이 가능합니다. 자세한 사항은 상담 시 안내드립니다." },
    ],
  },
  {
    section: "설치 · A/S",
    items: [
      { q: "설치는 언제 가능한가요?", a: "신청 일정에 따라 다음 영업일 또는 협의된 날짜에 SK매직㈜ 직영 기사가 방문 설치합니다." },
      { q: "이사 시 이전설치는 어떻게 하나요?", a: "이전설치는 가능합니다. 이사 1주일 전 고객센터로 연락 주시면 이전 일정을 잡아드립니다 (자가관리는 무료, 방문관리는 일부 비용 발생)." },
      { q: "고장 시 어디로 연락하나요?", a: "본 협력점 또는 SK매직㈜ 본사 콜센터(1588-1588)로 직접 연락하시면 신속히 출동해드립니다." },
      { q: "필터 교체는 어떻게 하나요?", a: "자가관리 모델은 정기 교체 키트를 발송해드리며, 방문관리 모델은 매니저가 정기 방문하여 교체합니다." },
    ],
  },
  {
    section: "의무사용 · 해지",
    items: [
      { q: "의무사용기간은 어떻게 되나요?", a: "상품에 따라 36개월 또는 60개월입니다. 신청 페이지에서 각 상품의 의무사용기간을 확인하실 수 있습니다." },
      { q: "중도 해지 시 위약금은 얼마인가요?", a: "잔여기간 렌탈료의 35%가 위약금으로 발생합니다. 정확한 금액은 가입 시 계약서를 확인해주세요." },
      { q: "의무사용 종료 후 어떻게 되나요?", a: "월 렌탈료는 그대로 유지되며, 언제든 해지하시면 위약금 없이 종료됩니다. 또는 신모델로 교체 가능합니다." },
    ],
  },
];

export default async function HelpPage({
  params,
}: {
  params: Promise<{ partnerCode: string }>;
}) {
  const { partnerCode } = await params;
  const partner = await getPartnerHeader(partnerCode);
  if (!partner) notFound();

  return (
    <div className="bg-rk-soft-2 min-h-screen flex justify-center items-start gap-6 max-md:p-0 md:py-8">
      <div className="w-full md:w-[390px] bg-white md:rounded-[32px] md:shadow-[0_8px_24px_rgba(20,25,40,.08)] overflow-hidden md:border-8 md:border-[#1A1D24]">
        <div className="hidden md:flex bg-white h-9 items-center justify-between px-[22px] text-[12px] font-semibold">
          <span className="rk-num">9:41</span>
          <span>● ●</span>
        </div>

        <PartnerHeader partner={partner} showFullNav />

        {/* Hero */}
        <section className="bg-rk-navy text-white px-4 py-6">
          <h1 className="text-[20px] font-bold m-0 tracking-[-.02em]">고객센터</h1>
          <p className="text-[12px] opacity-80 mt-1.5 m-0">
            {partner.partnerName} · 자주 묻는 질문 모음
          </p>
        </section>

        {/* Contact card */}
        <section className="bg-white px-4 py-4 border-b-8 border-rk-soft">
          <h3 className="text-[14px] font-semibold text-rk-ink mb-2">📞 연락처</h3>
          <div className="bg-rk-soft-2 rounded-md p-3 grid grid-cols-[80px_1fr] gap-y-2 text-[12px]">
            <span className="text-rk-muted">고객센터</span>
            <a href={`tel:${partner.hotlineNumber.replace(/\D/g, "")}`} className="text-rk-ink font-bold rk-num no-underline">
              {partner.hotlineNumber}
            </a>
            <span className="text-rk-muted">운영시간</span>
            <span className="text-rk-ink">평일 09:00–22:00</span>
            <span className="text-rk-muted">주소</span>
            <span className="text-rk-text">{partner.address ?? "—"}</span>
            {partner.ownerName && (
              <>
                <span className="text-rk-muted">담당</span>
                <span className="text-rk-text">{partner.ownerName}</span>
              </>
            )}
          </div>
        </section>

        {/* FAQ sections */}
        {FAQS.map(section => (
          <section key={section.section} className="bg-white px-4 py-4 border-b-8 border-rk-soft">
            <h3 className="text-[14px] font-semibold text-rk-ink mb-2">{section.section}</h3>
            <div className="flex flex-col gap-2">
              {section.items.map((item, i) => (
                <details key={i} className="group bg-rk-soft-2 border border-rk-line-2 rounded-md p-3">
                  <summary className="cursor-pointer list-none flex items-center justify-between text-[12px] font-medium text-rk-ink">
                    <span>Q. {item.q}</span>
                    <span className="text-rk-muted text-[11px] group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-[11px] text-rk-text leading-[1.7] mt-2 m-0 pl-3 border-l-2 border-rk-line whitespace-pre-line">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {/* Legal links */}
        <section className="bg-white px-4 py-4 border-b-8 border-rk-soft">
          <h3 className="text-[14px] font-semibold text-rk-ink mb-2">📄 약관 · 정책</h3>
          <div className="flex flex-col gap-1">
            <Link href="/legal/terms" className="block text-[12px] text-rk-info py-1 no-underline">
              · 이용약관 →
            </Link>
            <Link href="/legal/privacy" className="block text-[12px] text-rk-info py-1 no-underline">
              · 개인정보처리방침 →
            </Link>
          </div>
        </section>

        {/* Need help — direct link to consult */}
        <section className="bg-rk-tint-orange px-4 py-5 text-center">
          <h3 className="text-[14px] font-semibold text-rk-orange-deep">아직 궁금한 점이 남았나요?</h3>
          <p className="text-[12px] text-rk-orange-deep mt-1 mb-3">
            카톡으로 바로 답변 받으세요.
          </p>
          <a className="inline-block bg-[#FEE500] text-[#1A1D24] py-2 px-5 rounded-md font-semibold text-[13px] no-underline cursor-pointer">
            💬 카카오톡 상담
          </a>
        </section>

        <PartnerFooter partner={partner} />
        <PartnerCta partner={partner} />
      </div>
    </div>
  );
}
