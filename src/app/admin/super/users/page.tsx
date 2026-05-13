import UserManager from "@/components/super/UserManager";

export const metadata = { title: "사용자 관리 · 슈퍼관리자" };
export const dynamic = "force-dynamic";

export default function UsersPage() {
  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">사용자 관리</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        본사 / 협력점 / 영업자 계정 — 잠금 해제 · 임시 비밀번호 발급 · 활성/비활성
      </p>

      <UserManager />

      <div className="mt-3 bg-rk-tint-orange text-rk-orange-deep px-3 py-2 rounded text-[13px] leading-[1.6]">
        ⚠ <b>임시 비밀번호</b>는 발급 직후 1회만 노출됩니다. 화면을 닫으면 다시 조회할 수 없으니 사용자에게 즉시 전달해주세요.
        사용자가 첫 로그인 후 본인이 <a href="/admin/profile" className="underline">내 계정</a> 페이지에서 본인 비밀번호로 변경하도록 안내하세요.
      </div>
    </>
  );
}
