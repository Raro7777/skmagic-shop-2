import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PasswordChangeForm from "@/components/PasswordChangeForm";
import ProfileEditForm from "@/components/ProfileEditForm";

export const metadata = { title: "내 계정" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  hq: "본사 슈퍼관리자",
  partner_admin: "협력점 관리자",
  seller: "영업자",
};

export default async function ProfilePage({
  searchParams,
}: { searchParams?: Promise<{ force?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fadmin%2Fprofile");
  const sp = (await searchParams) ?? {};
  const isForce = sp.force === "1" || !!session.user.mustChangePassword;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true, name: true, role: true, status: true,
      partnerId: true, lastLoginAt: true, createdAt: true,
      mustChangePassword: true, passwordUpdatedAt: true,
      partner: { select: { partnerName: true } },
      seller: { select: { sellerCode: true, name: true, phone: true, telegramChatId: true } },
    },
  });
  if (!user) redirect("/login");

  // 자기 콘솔로 돌아갈 링크
  const homeFor = (r: string) =>
    r === "hq" ? "/admin/super"
    : r === "partner_admin" ? "/admin/franchise"
    : r === "seller" ? "/admin/seller" : "/";

  return (
    <div className="min-h-screen bg-rk-admin-bg p-6 flex justify-center">
      <div className="max-w-[640px] w-full">
        <div className="flex items-center mb-3 gap-3">
          {!isForce && (
            <Link href={homeFor(user.role)} className="text-[14px] text-rk-muted no-underline">← 콘솔로</Link>
          )}
          <h1 className="text-[20px] font-bold tracking-[-.02em]">내 계정</h1>
        </div>
        {isForce ? (
          <div className="mb-3 bg-rk-tint-orange text-rk-orange-deep p-3 rounded-md text-[13px] leading-[1.6]">
            🔒 <b>초기 비밀번호 변경 필요</b><br />
            계정 보안을 위해 새 비밀번호로 변경 후 콘솔을 이용할 수 있습니다.<br />
            아래 정책에 맞춰 새 비밀번호를 설정해주세요.
          </div>
        ) : (
          <p className="text-rk-muted text-[14px] mb-[18px]">로그인 정보 확인 + 비밀번호 변경</p>
        )}

        <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
          <h3 className="text-[14px] font-semibold text-rk-ink mb-3">계정 정보</h3>
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[14px]">
            <dt className="text-rk-muted">이메일</dt>
            <dd className="text-rk-ink font-mono">{user.email}</dd>
            <dt className="text-rk-muted">이름</dt>
            <dd className="text-rk-ink">{user.name ?? "—"}</dd>
            <dt className="text-rk-muted">권한</dt>
            <dd className="text-rk-ink">{ROLE_LABEL[user.role] ?? user.role}</dd>
            {user.partner && (
              <>
                <dt className="text-rk-muted">소속 협력점</dt>
                <dd className="text-rk-ink">{user.partner.partnerName} <span className="text-[12px] font-mono text-rk-faint">({user.partnerId})</span></dd>
              </>
            )}
            {user.seller && (
              <>
                <dt className="text-rk-muted">영업자 코드</dt>
                <dd className="text-rk-ink font-mono">{user.seller.sellerCode}</dd>
              </>
            )}
            <dt className="text-rk-muted">계정 상태</dt>
            <dd>
              <span className={"text-[12px] px-1.5 py-0.5 rounded font-medium " + (user.status === "active" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
                {user.status}
              </span>
            </dd>
            <dt className="text-rk-muted">최근 로그인</dt>
            <dd className="text-rk-ink rk-num text-[13px]">{user.lastLoginAt?.toISOString().replace("T", " ").slice(0, 19) ?? "—"}</dd>
            <dt className="text-rk-muted">계정 생성</dt>
            <dd className="text-rk-ink rk-num text-[13px]">{user.createdAt.toISOString().slice(0, 10)}</dd>
          </dl>
        </div>

        {/* force 모드(첫 로그인 비번 변경)에서는 기본 정보 편집 숨김 — 비밀번호 변경에만 집중. */}
        {!isForce && (
          <ProfileEditForm
            initial={{
              name: user.name ?? "",
              email: user.email,
              phone: user.seller?.phone ?? null,
              telegramChatId: user.seller?.telegramChatId ?? null,
            }}
            role={user.role as "hq" | "partner_admin" | "seller"}
          />
        )}

        <PasswordChangeForm forceChange={isForce} />

        <div className="bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
          ⓘ 비밀번호 분실 시 본사 슈퍼관리자에게 문의해 임시 비밀번호 발급을 받을 수 있습니다.
        </div>
      </div>
    </div>
  );
}
