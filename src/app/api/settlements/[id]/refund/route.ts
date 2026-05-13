import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { startRefund, advanceRefund, cancelRefund } from "@/lib/settlementStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 환수 프로세스 액션 — 본사 전담
 *
 * POST   /api/settlements/[id]/refund   body: { amount, reason }   → 환수 시작 (paid → refund_pending)
 * PATCH  /api/settlements/[id]/refund   body: { action: "advance" | "cancel" }
 *    - advance → refund_pending → refund_progress → refund_done
 *    - cancel  → refundStatus null 로 되돌림 (refund_done 은 불가)
 */

async function requireHq() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "hq") {
    return { err: NextResponse.json({ error: "Forbidden — 환수는 본사 전담입니다." }, { status: 403 }) };
  }
  return { user: session.user };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireHq();
  if ("err" in guard) return guard.err;

  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const b = body as Partial<{ amount: number; reason: string }>;
  if (typeof b.amount !== "number" || !b.reason) {
    return NextResponse.json({ error: "amount(number) + reason(string) 필수" }, { status: 400 });
  }

  const r = await startRefund({ settlementId: id, amount: b.amount, reason: b.reason });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireHq();
  if ("err" in guard) return guard.err;

  const { id } = await ctx.params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const b = body as Partial<{ action: "advance" | "cancel" }>;
  if (b.action !== "advance" && b.action !== "cancel") {
    return NextResponse.json({ error: "action 은 'advance' 또는 'cancel'" }, { status: 400 });
  }

  const r = b.action === "advance" ? await advanceRefund(id) : await cancelRefund(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, ...(r as object) });
}
