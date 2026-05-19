import { HQ_HOTLINE, HQ_HOTLINE_HOURS } from "@/lib/constants/hq";

export const metadata = { title: "개인정보처리방침" };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-[24px] font-bold text-rk-ink mb-1 tracking-[-.02em]">개인정보처리방침</h1>
      <p className="text-[12px] text-rk-muted mb-8">
        시행일자: 2026.05.01 · 최종 개정: 2026.05.01
      </p>

      <p className="text-[13px] text-rk-text mb-8">
        ㈜렌트왕(이하 &quot;회사&quot;)은 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 및 관련 법령을 준수합니다.
        본 방침은 회사가 운영하는 분양형 렌탈 플랫폼 및 협력점 사이트를 통해 수집한 개인정보의 처리 방법을 명시합니다.
      </p>

      <Article num="1" title="수집하는 개인정보 항목">
        <p>회사는 다음 항목을 수집합니다.</p>
        <table className="w-full border-collapse text-[12px] mt-3 mb-3">
          <thead>
            <tr className="border-b border-rk-line">
              <th className="text-left py-2 pr-3 font-medium text-rk-muted text-[11px] uppercase tracking-[.04em]">시점</th>
              <th className="text-left py-2 pr-3 font-medium text-rk-muted text-[11px] uppercase tracking-[.04em]">필수 항목</th>
              <th className="text-left py-2 font-medium text-rk-muted text-[11px] uppercase tracking-[.04em]">선택 항목</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rk-line-2">
              <td className="py-2 pr-3 align-top">상담 신청</td>
              <td className="py-2 pr-3 align-top">이름, 휴대폰번호, 관심 상품</td>
              <td className="py-2 align-top">설치 희망 지역, 상담 메모</td>
            </tr>
            <tr className="border-b border-rk-line-2">
              <td className="py-2 pr-3 align-top">자동 수집</td>
              <td className="py-2 pr-3 align-top">접속 IP(해시 처리), 유입 경로(UTM), 접속일시</td>
              <td className="py-2 align-top">기기 정보(브라우저·OS)</td>
            </tr>
          </tbody>
        </table>
      </Article>

      <Article num="2" title="개인정보의 수집·이용 목적">
        <ol>
          <li>렌탈 상품 상담 및 신청 처리</li>
          <li>담당 협력점 배정 및 본사·협력점·이용자 간 분쟁 해결 근거 자료</li>
          <li>마케팅·광고 효율 측정 (UTM 등 채널 데이터 분석)</li>
          <li>서비스 개선을 위한 통계 및 분석 (개인을 식별할 수 없도록 익명화)</li>
          <li>법령상 의무 이행 (전자상거래법 등)</li>
        </ol>
      </Article>

      <Article num="3" title="개인정보의 보유 및 이용기간">
        <ol>
          <li><b>상담 신청 데이터</b>: 수집일로부터 <b>3년 보유</b> 후 <b>자동 익명화</b>(이름·휴대폰번호 등 식별정보 삭제, 통계용 메타 정보만 유지)</li>
          <li><b>마케팅 수신 동의 정보</b>: 동의 철회 시 즉시 파기</li>
          <li><b>법령상 의무 보유</b>: 전자상거래법 등에 따른 거래 기록은 5년간 보존</li>
        </ol>
        <p className="text-[12px] text-rk-muted bg-rk-soft-2 px-3 py-2 rounded mt-2">
          ⓘ 익명화는 야간 자동 배치로 일 1회 실행됩니다.
        </p>
      </Article>

      <Article num="4" title="개인정보의 제3자 제공">
        <p>회사는 이용자의 개인정보를 다음의 경우에 한하여 제공합니다.</p>
        <ol>
          <li><b>담당 협력점</b>: 상담 신청자의 이름, 마스킹된 휴대폰번호(예: 010-1***-2222), 관심 상품, 지역. 담당으로 배정된 협력점만 접근 가능합니다.</li>
          <li><b>설치 협력업체(SK매직㈜ 등)</b>: 설치 일정 협의를 위한 최소 정보(이름·휴대폰·주소)</li>
          <li>법령에 따른 요청이 있는 경우</li>
        </ol>
      </Article>

      <Article num="5" title="휴대폰번호 마스킹 정책">
        <p>회사는 다음 원칙으로 이용자의 휴대폰번호를 보호합니다.</p>
        <ol>
          <li><b>리스트 화면(어드민 등)</b>: 항상 마스킹된 형태로만 표시 (예: <code className="bg-rk-soft px-1 rounded font-mono">010-1***-2222</code>)</li>
          <li><b>풀번호 열람 가능 조건</b>: 본인이 담당으로 배정된 lead AND 상담 상태가 &quot;신규&quot; 또는 &quot;상담중&quot;일 때만</li>
          <li><b>다운로드 권한</b>: 본사 관리자에 한정. 협력점 관리자는 화면 조회만 가능</li>
        </ol>
      </Article>

      <Article num="6" title="개인정보의 파기 절차 및 방법">
        <ol>
          <li>보유 기간이 경과한 개인정보는 자동 익명화 또는 파기됩니다.</li>
          <li>전자적 파일은 복구 불가능한 방법으로 영구 삭제하며, 종이 문서는 분쇄하거나 소각합니다.</li>
        </ol>
      </Article>

      <Article num="7" title="이용자의 권리">
        <p>이용자는 다음 권리를 행사할 수 있습니다.</p>
        <ol>
          <li>개인정보 열람·정정·삭제·처리정지 요구</li>
          <li>마케팅 수신 동의 철회</li>
          <li>회원 탈퇴 (회원 시스템 도입 시)</li>
        </ol>
        <p>요청은 회사 고객센터({HQ_HOTLINE}) 또는 협력점 담당자에게 문의하시면 즉시 처리해 드립니다.</p>
      </Article>

      <Article num="8" title="개인정보 보호책임자">
        <p>회사는 개인정보 처리에 관한 업무를 총괄하는 책임자를 다음과 같이 지정합니다.</p>
        <ul>
          <li>책임자: 본사 운영팀장</li>
          <li>연락처: {HQ_HOTLINE} ({HQ_HOTLINE_HOURS})</li>
          <li>이메일: privacy@rentking.kr</li>
        </ul>
      </Article>

      <Article num="9" title="안전성 확보 조치">
        <ol>
          <li>접근 통제 (NextAuth 기반 권한 분리: 본사·협력점·영업자)</li>
          <li>암호화 (전송 구간 TLS, 비밀번호 bcrypt 해시)</li>
          <li>접속 기록 저장 (lead 상태 변경 등 주요 활동의 감사 로그 보관)</li>
          <li>로그인 5회 실패 시 10분 자동 잠금</li>
        </ol>
      </Article>

      <Article num="10" title="개인정보처리방침의 변경">
        <p>본 방침의 내용 추가, 삭제 및 수정이 있을 시 변경 사항 적용 7일 전부터 본 페이지를 통해 고지합니다.</p>
      </Article>

      <p className="text-[11px] text-rk-muted mt-8 pt-6 border-t border-rk-line">
        ⓘ 본 방침은 시연용 데모로 작성된 사례입니다. 실제 운영 시 법무·개인정보보호 전문가 검토를 거쳐 확정해야 합니다.
      </p>
    </>
  );
}

function Article({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7 [&_p]:text-rk-text [&_p]:text-[13px] [&_p]:my-1 [&_li]:text-rk-text [&_li]:text-[13px] [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_b]:text-rk-ink">
      <h2 className="text-[15px] font-bold text-rk-ink mb-2 tracking-[-.02em]">제{num}조 ({title})</h2>
      {children}
    </section>
  );
}
