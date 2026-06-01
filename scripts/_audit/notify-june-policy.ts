/**
 * Phase 4 — 본사 텔레그램 알림 (협력점/영업자 broadcast 는 사용자 컨펌 후 별도 실행)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { notifyHq } from "../../src/lib/telegram";

const msg = `🆕 <b>6월 정책 적용 완료</b>

✅ 신규 상품 19종 메인 노출 (active):
   • 매트리스: 워커힐 스위트/클라우드/스탠다드 Q/K, 수납형 프레임, 패브릭/PVC 헤드/파운데이션 등
   • 공기청정기: ACL16/22 디아트 신형(다크그린), 슈퍼 ACL300
   • 정수기: 위글위글 GBC, MEGA ICE mini 애쉬블루

📝 7종은 draft 상태 (이미지·스펙 비어있음 — admin 보완 필요):
   MAT*D011/H511 series, MATQH651RZWD

📊 수수료 변동 (≥1만원 기준):
   • 인하 16건 / 인상 4건
   • 최대 인하: 투워터 정수기 -75,000원 (-18.3%)
   • 최대 인상: MEGA ICE 60m+ 약정 +192,455~237,818원 (장기약정 장려금 신설)

🎁 타사보상 200건 자동 적용 (xlsx 직접 명시 → 별도 PDF 매핑 불필요)
🚫 단종 0건 (기존 60종 모두 유지)

✓ VAT 정책 5월과 동일 (÷1.1 공급가 저장, 정산도 공급가, 마지막에 VAT 가산)

협력점 관리자/영업자에게 broadcast 알림은 슈퍼관리자 confirm 후 별도 발송.`;

async function main() {
  await notifyHq(msg);
  console.log("✅ 본사 텔레그램 알림 발송 완료");
}
main().catch(e => { console.error(e); process.exit(1); });
