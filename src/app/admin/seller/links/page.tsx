import Link from "next/link";
import { auth } from "@/auth";
import { getSellerDashboard } from "@/lib/sellerDashboard";
import CopyLink from "@/components/seller/CopyLink";

export const metadata = { title: "공유 링크 · 영업자" };
export const dynamic = "force-dynamic";

export default async function SellerLinksPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "seller") return null;
  const data = await getSellerDashboard(session.user.id);
  if (!data) return null;
  const { profile } = data;

  // production base URL — env에 없으면 fallback
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rentking-next.vercel.app";
  const personalUrl = `${baseUrl}/p/${profile.partnerCode}/s/${profile.sellerCode}`;
  const partnerUrl = `${baseUrl}/p/${profile.partnerCode}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(personalUrl)}`;

  // 카톡 공유 문구
  const kakaoShare =
    `[${profile.partnerName}] ${profile.name}입니다 😊\n` +
    `SK매직 정수기/공기청정기 상담 환영합니다.\n` +
    `사은품과 단독 혜택은 아래 링크에서 확인 가능합니다.\n${personalUrl}`;

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">공유 링크 / QR</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        링크/QR로 들어온 신청은 자동으로 본인에게 할당됩니다.
      </p>

      <section className="bg-white border border-rk-line rounded-lg p-4 mb-3">
        <div className="text-[14px] font-semibold mb-2.5">🔗 내 분양 링크 (sellerCode 부착)</div>
        <CopyLink url={personalUrl} label="내 분양 링크 복사" />
        <small className="text-[13px] text-rk-muted mt-1.5 block">
          이 링크를 통해 들어온 모든 lead는 자동으로 <b>{profile.name}</b>에게 sellerId가 매핑됩니다.
        </small>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[13px] text-rk-muted mb-1.5">QR 코드 (오프라인 명함/포스터용)</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="QR" className="w-[180px] h-[180px] border border-rk-line rounded" />
          </div>
          <div>
            <div className="text-[13px] text-rk-muted mb-1.5">카톡 공유 문구 (복사해서 보내기)</div>
            <textarea
              readOnly
              value={kakaoShare}
              rows={6}
              className="w-full text-[13px] font-mono border border-rk-line rounded p-2 bg-rk-soft-2 leading-[1.5]"
            />
            <small className="text-[12px] text-rk-muted mt-0.5 block">
              본문 복사 → 카카오톡/문자에 붙여넣어 전송하시면 됩니다.
            </small>
          </div>
        </div>
      </section>

      <section className="bg-white border border-rk-line rounded-lg p-4 mb-3">
        <div className="text-[14px] font-semibold mb-2.5">🏪 협력점 메인 (참고)</div>
        <CopyLink url={partnerUrl} label="협력점 메인 링크" />
        <small className="text-[13px] text-rk-muted mt-1.5 block">
          이 링크는 sellerCode 없이 협력점 공통 페이지로 들어갑니다.
          본인 sellerId 매핑이 필요하면 위쪽의 <Link href="#" className="underline text-rk-info">내 분양 링크</Link>를 사용하세요.
        </small>
      </section>

      <div className="bg-rk-tint-blue text-rk-info px-3 py-2 rounded text-[13px] leading-[1.6]">
        💡 <b>활용 팁</b>: 카톡 채팅방 프로필, 명함 QR, 단톡 공지에 분양 링크를 게시하시면 들어오는 신청이 모두 본인 lead로 자동 분류됩니다.
      </div>
    </>
  );
}
