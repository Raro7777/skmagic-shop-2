import { auth } from "@/auth";
import LiveLeads from "@/components/franchise/LiveLeads";
import InquiryQueue from "@/components/franchise/InquiryQueue";
import MemoTimeline from "@/components/franchise/MemoTimeline";
import OrderPipeline from "@/components/franchise/OrderPipeline";
import {
  getOrderPipeline,
  getInquiryQueue,
  getMemoTimeline,
} from "@/lib/franchiseDashboard";

export const metadata = { title: "상담 / 문의 · 협력점 콘솔" };
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await auth();
  const partnerId = session?.user?.partnerId;
  if (!partnerId) {
    return (
      <div className="bg-rk-tint-orange text-rk-orange-deep px-4 py-3 rounded text-[13px]">
        협력점 계정이 아닙니다. 본사 콘솔로 접속해주세요.
      </div>
    );
  }

  const [pipeline, inquiry, memo] = await Promise.all([
    getOrderPipeline(partnerId),
    getInquiryQueue(partnerId),
    getMemoTimeline(partnerId),
  ]);

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">상담 / 문의</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        실시간 신규 lead · 상태 변경 · 응대 대기열 · 처리 이력
      </p>

      <LiveLeads />

      <OrderPipeline data={pipeline} />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <InquiryQueue data={inquiry} />
        <MemoTimeline data={memo} />
      </div>
    </>
  );
}
