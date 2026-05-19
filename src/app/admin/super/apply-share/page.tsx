import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/constants/site";
import ApplyShareClient from "@/components/super/ApplyShareClient";

export const metadata = { title: "분양신청 링크 공유 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default async function ApplyShareLinkPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "hq") redirect("/login");

  const applyUrl = `${SITE_URL}/apply`;

  return (
    <>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <h1 className="text-[20px] font-bold tracking-[-.02em]">📢 분양신청 링크 공유</h1>
      </div>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        협력점 모집용 분양신청 페이지 링크 · 카톡/문자/네이버 카페 등 채널별 공유 · 유입 경로 자동 추적 (UTM).
      </p>

      <ApplyShareClient baseUrl={applyUrl} />

      <div className="mt-3 bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        ⓘ <b>채널별 링크</b>를 보내면 마케팅 분석에서 어떤 채널이 효과적이었는지 자동 집계됩니다.
        (예: 카톡 단톡방 ↔ 인스타그램 DM ↔ 네이버 카페 글 등)
        <br />
        ⓘ <Link href="/admin/super/analytics" className="text-rk-info underline">마케팅 분석</Link> 페이지에서 유입 채널별 분양 신청 수 확인 가능.
      </div>
    </>
  );
}
