import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HqTemplateEnter from "@/components/super/HqTemplateEnter";

export const metadata = { title: "본사 표준 메인페이지 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

const HQ_TEMPLATE_CODE = "hq-template";

export default async function HqTemplatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fadmin%2Fsuper%2Fhq-template");
  if (session.user.role !== "hq") redirect("/admin");

  const tpl = await prisma.partner.findUnique({
    where: { partnerCode: HQ_TEMPLATE_CODE },
    select: { partnerCode: true, partnerName: true, status: true, theme: true, updatedAt: true },
  });

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">📐 본사 표준 메인페이지</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        신규 협력점이 분양 승인될 때 이 표준의 배너·진열·테마·정책을 그대로 복제합니다.
        본사 콘솔로 임시 진입하여 협력점 콘솔과 동일한 UI로 편집할 수 있습니다.
      </p>

      {!tpl ? (
        <div className="bg-rk-tint-red text-rk-sale p-3 rounded text-[14px]">
          ⚠ hq-template Partner row 가 없습니다. scripts/add-hq-template-partner.ts 를 실행하세요.
        </div>
      ) : (
        <>
          <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[14px]">
              <dt className="text-rk-muted">partnerCode</dt>
              <dd className="font-mono text-rk-ink">{tpl.partnerCode}</dd>
              <dt className="text-rk-muted">상태</dt>
              <dd>
                <span className="text-[12px] px-1.5 py-0.5 rounded font-medium bg-rk-tint-blue text-rk-info">
                  {tpl.status}
                </span>
                <small className="ml-2 text-[12px] text-rk-faint">컨슈머 사이트 노출 X (status=active 아님)</small>
              </dd>
              <dt className="text-rk-muted">테마</dt>
              <dd className="text-rk-ink">{tpl.theme}</dd>
              <dt className="text-rk-muted">최근 갱신</dt>
              <dd className="text-rk-ink rk-num text-[13px]">{tpl.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</dd>
            </dl>
          </div>

          <HqTemplateEnter partnerCode={tpl.partnerCode} />

          <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
            ⓘ 본사 표준은 <b>신규 협력점 생성 시점에만 1회 복제</b>됩니다 (Snapshot).
            기존 협력점은 본사 표준이 바뀌어도 영향받지 않습니다.
            <br />
            푸터 정보(상호 · 사업자 · 주소 · 연락처)는 협력점 신청서 데이터로 채워지며, 본사 표준에서 복제하지 않습니다.
          </div>
        </>
      )}
    </>
  );
}
