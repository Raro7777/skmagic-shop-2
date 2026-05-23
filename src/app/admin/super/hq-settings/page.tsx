import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JoinConditionsEditor from "@/components/super/JoinConditionsEditor";

export const metadata = { title: "본사 설정 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default async function HqSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fadmin%2Fsuper%2Fhq-settings");
  if (session.user.role !== "hq") redirect("/admin");

  const setting = await prisma.hqSetting.findUnique({ where: { id: 1 } });
  const j = (setting?.joinConditions ?? null) as null | {
    ageMin?: number | null;
    ageMax?: number | null;
    creditGrade?: string | null;
    paymentMethods?: string | null;
    helpCallNumber?: string | null;
    memo?: string | null;
  };

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">본사 설정</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        SK매직 가입조건 fact sheet — 영업자/협력점이 상담 중 즉시 확인하는 핵심 정보
      </p>

      <JoinConditionsEditor
        initial={{
          ageMin: j?.ageMin ?? null,
          ageMax: j?.ageMax ?? null,
          creditGrade: j?.creditGrade ?? "",
          paymentMethods: j?.paymentMethods ?? "",
          helpCallNumber: j?.helpCallNumber ?? "",
          memo: j?.memo ?? "",
        }}
      />
    </>
  );
}
