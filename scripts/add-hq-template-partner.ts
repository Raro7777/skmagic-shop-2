/**
 * 본사 표준 메인페이지를 위한 special Partner row 생성.
 *   partnerCode: "hq-template"
 *   status: "hq_template"  ← 컨슈머 조회(/api/listActivePartners 등)에서 제외
 *
 * 본사 슈퍼관리자가 hq_view_partner 쿠키에 이 partnerCode 를 세팅하면 협력점
 * 콘솔(/admin/franchise) 으로 임시 진입하여 배너·진열·정책 등 본사 표준을 편집.
 * 신규 협력점 분양 승인 시 이 row 의 설정·배너·정책을 새 partner 로 복제.
 *
 * 멱등: INSERT ON CONFLICT DO NOTHING.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const HQ_TEMPLATE_CODE = "hq-template";
  const existing = await prisma.partner.findUnique({ where: { partnerCode: HQ_TEMPLATE_CODE } });
  if (existing) {
    console.log(`✓ hq-template Partner row 이미 존재 (status=${existing.status})`);
    return;
  }
  const created = await prisma.partner.create({
    data: {
      partnerCode: HQ_TEMPLATE_CODE,
      partnerName: "본사 표준",
      brandLabel: "SK매직 공식인증점",
      status: "hq_template",
      tier: "basic",
    },
  });
  console.log(`✓ hq-template Partner row 생성 — id=${created.id} status=${created.status}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
