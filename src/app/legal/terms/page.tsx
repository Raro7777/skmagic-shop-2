export const metadata = { title: "이용약관 · 렌트왕" };

export default function TermsPage() {
  return (
    <>
      <h1 className="text-[24px] font-bold text-rk-ink mb-1 tracking-[-.02em]">이용약관</h1>
      <p className="text-[12px] text-rk-muted mb-8">
        시행일자: 2026.05.01 · 최종 개정: 2026.05.01
      </p>

      <Article num="1" title="목적">
        <p>
          본 약관은 ㈜렌트왕(이하 &quot;회사&quot;)이 운영하는 분양형 렌탈 플랫폼(이하 &quot;플랫폼&quot;)에서 회사 및
          회사로부터 분양받은 협력점(이하 &quot;협력점&quot;)이 제공하는 렌탈 상품 상담·신청 서비스 이용에 관한 회사,
          협력점, 이용자 간 권리·의무 및 책임사항, 이용절차 등 기본적인 사항을 규정함을 목적으로 합니다.
        </p>
      </Article>

      <Article num="2" title="용어의 정의">
        <ol>
          <li><b>&quot;플랫폼&quot;</b>이라 함은 회사가 운영하는 렌탈 상품 분양형 사이트 운영 시스템을 말합니다.</li>
          <li><b>&quot;협력점&quot;</b>이라 함은 회사로부터 사이트를 분양받아 자기 도메인 또는 분양 URL로 렌탈 상담 서비스를 제공하는 가맹점을 말합니다.</li>
          <li><b>&quot;이용자&quot;</b>라 함은 협력점 사이트를 통해 렌탈 상품을 조회·상담 신청·이용하는 자를 말합니다.</li>
          <li><b>&quot;상담 신청&quot;</b>이라 함은 이용자가 사이트의 신청 폼을 통해 본인 정보(이름·연락처·관심상품 등)를 회사 및 담당 협력점에 제공하여 렌탈 상담을 요청하는 행위를 말합니다.</li>
          <li><b>&quot;렌탈 상품&quot;</b>이라 함은 SK매직㈜ 등 제조사가 공급하고 회사가 본 플랫폼에 등록한 정수기·공기청정기·비데 등의 가전 렌탈 상품을 말합니다.</li>
        </ol>
      </Article>

      <Article num="3" title="플랫폼 운영 구조">
        <ol>
          <li>회사는 통신판매중개자로서, 본 약관에 따라 협력점이 이용자에게 렌탈 상담 서비스를 제공할 수 있도록 플랫폼을 운영합니다.</li>
          <li>회사는 상품 마스터·기준가·기준 정책(판매수수료·사은품 환원 한도)을 관장합니다.</li>
          <li>협력점은 회사가 정한 기준 정책 범위 안에서 사은품 환원·설치비 면제 등을 자율적으로 운영합니다.</li>
          <li>월 렌탈료, 의무사용기간, 카드할인가 등은 <b>전국 동일</b>이며 협력점이 임의 변경할 수 없습니다.</li>
        </ol>
      </Article>

      <Article num="4" title="이용자의 책임">
        <ol>
          <li>이용자는 상담 신청 시 본인의 정확한 정보를 입력해야 합니다.</li>
          <li>타인의 정보 도용·허위 정보 입력으로 발생한 불이익은 이용자가 부담합니다.</li>
          <li>이용자는 본 약관 및 관계 법령을 준수하여야 하며, 회사 또는 협력점의 정상적인 영업을 방해하는 행위를 하여서는 안 됩니다.</li>
        </ol>
      </Article>

      <Article num="5" title="상담 신청 및 lead 처리">
        <ol>
          <li>이용자가 협력점 사이트에서 상담을 신청하면, 해당 협력점 또는 본사 풀로 자동 배정됩니다.</li>
          <li>최초로 상담 신청이 접수된 협력점이 해당 lead의 1차 소유권을 가지며, 동일 휴대폰 번호로 30일 이내 재접수가 발생할 경우 중복으로 표시됩니다.</li>
          <li>접수 후 30분 이내 담당 협력점이 카톡 또는 전화로 연락드립니다.</li>
        </ol>
      </Article>

      <Article num="6" title="렌탈 계약의 체결">
        <ol>
          <li>실제 렌탈 계약은 SK매직㈜ 등 상품 공급사와 이용자 간에 체결되며, 본 플랫폼은 통신판매중개자입니다.</li>
          <li>렌탈 계약의 의무사용기간·중도해지 위약금률 등은 상품 공급사의 약관을 따릅니다.</li>
        </ol>
      </Article>

      <Article num="7" title="환불·취소·청약철회">
        <ol>
          <li>설치 전 14일 이내라면 100% 환불이 가능합니다.</li>
          <li>설치 후의 청약철회는 상품 공급사 약관에 따른 위약금이 발생할 수 있습니다.</li>
        </ol>
      </Article>

      <Article num="8" title="개인정보 보호">
        <p>
          회사는 「개인정보 보호법」 및 관련 법령을 준수하며, 이용자의 개인정보 처리에 관한 사항은 별도의{" "}
          <a href="/legal/privacy" className="text-rk-info underline">개인정보처리방침</a>에 따릅니다.
        </p>
      </Article>

      <Article num="9" title="회사 및 협력점의 면책">
        <ol>
          <li>회사는 천재지변, 전쟁, 통신 장애 등 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.</li>
          <li>이용자가 입력한 정보의 오류 또는 허위로 인해 발생한 손해에 대해 회사는 책임을 지지 않습니다.</li>
          <li>협력점은 회사가 정한 기준 정책의 범위 내에서만 영업을 수행하며, 그 범위를 벗어난 약속·계약은 회사를 구속하지 않습니다.</li>
        </ol>
      </Article>

      <Article num="10" title="분쟁 해결">
        <ol>
          <li>회사와 이용자 간 분쟁이 발생한 경우 「전자상거래법」 및 「소비자기본법」 등 관련 법령을 따릅니다.</li>
          <li>본 약관과 관련한 소송의 관할법원은 회사의 본점 소재지를 관할하는 법원으로 합니다.</li>
        </ol>
      </Article>

      <Article num="11" title="약관의 변경">
        <p>
          회사는 필요한 경우 본 약관을 개정할 수 있으며, 개정약관은 공지일로부터 7일 후 효력이 발생합니다. 다만 이용자에게 불리한 변경의 경우 30일 전 공지합니다.
        </p>
      </Article>

      <p className="text-[11px] text-rk-muted mt-8 pt-6 border-t border-rk-line">
        ⓘ 본 약관은 시연용 데모로 작성된 사례입니다. 실제 운영 시 법무 검토를 거쳐 확정해야 합니다.
      </p>
    </>
  );
}

function Article({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 [&_p]:text-rk-text [&_p]:text-[13px] [&_li]:text-rk-text [&_li]:text-[13px] [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:text-rk-ink">
      <h2 className="text-[15px] font-bold text-rk-ink mb-2 tracking-[-.02em]">제{num}조 ({title})</h2>
      {children}
    </section>
  );
}
