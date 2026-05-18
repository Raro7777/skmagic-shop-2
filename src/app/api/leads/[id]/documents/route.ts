/**
 * GET  /api/leads/[id]/documents  — 신청서 첨부 서류 목록
 * POST /api/leads/[id]/documents  — 업로드 (multipart: file, kind, label?)
 *
 * 협력점/영업자/본사 모두 본인 스코프 lead 의 문서 관리 가능.
 * 이미지/PDF 원본을 Vercel Blob 에 그대로 저장. 신분증·금융 정보 포함 → PII 취급.
 */
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLeadById } from "@/lib/leadStore";
import type { ActorRole } from "@/lib/leadStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024; // 12MB (신분증 사진 + PDF 여유)
const ALLOWED_KINDS = ["id_card", "rival_payment", "bank_book", "other"] as const;
const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf)$/i;

async function gate(id: string) {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = session.user.role;
  let actorRole: ActorRole;
  if (role === "hq") actorRole = "hq";
  else if (role === "partner_admin") actorRole = "partner_admin";
  else if (role === "seller") actorRole = "seller";
  else return { err: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  const lead = await getLeadById(id);
  if (!lead) return { err: NextResponse.json({ error: "Lead not found" }, { status: 404 }) };

  if (actorRole === "partner_admin" && lead.partnerId !== session.user.partnerId) {
    return { err: NextResponse.json({ error: "Forbidden — 본인 점 lead 가 아닙니다." }, { status: 403 }) };
  }
  if (actorRole === "seller") {
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!seller || lead.sellerId !== seller.id) {
      return { err: NextResponse.json({ error: "Forbidden — 본인이 받은 lead 만 접근 가능합니다." }, { status: 403 }) };
    }
  }
  return { actorRole, actorId: session.user.id ?? null, lead };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await gate(id);
  if ("err" in g) return g.err;

  const form = await prisma.enrollmentForm.findUnique({ where: { leadId: id }, select: { id: true } });
  if (!form) return NextResponse.json({ documents: [] });

  const docs = await prisma.enrollmentDocument.findMany({
    where: { formId: form.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    documents: docs.map(d => ({
      id: d.id,
      kind: d.kind,
      label: d.label,
      url: d.url,
      fileName: d.fileName,
      contentType: d.contentType,
      sizeBytes: d.sizeBytes,
      uploadedByRole: d.uploadedByRole,
      createdAt: d.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await gate(id);
  if ("err" in g) return g.err;

  const form = await prisma.enrollmentForm.findUnique({ where: { leadId: id }, select: { id: true } });
  if (!form) return NextResponse.json({ error: "신청서가 먼저 작성되어야 합니다." }, { status: 400 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "multipart/form-data 필요" }, { status: 400 }); }

  const file = formData.get("file");
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const labelRaw = String(formData.get("label") ?? "").trim();

  if (!(file instanceof File)) return NextResponse.json({ error: "file 필드 누락" }, { status: 400 });
  if (!ALLOWED_KINDS.includes(kindRaw as never)) return NextResponse.json({ error: "kind 누락 또는 잘못됨" }, { status: 400 });
  if (!ALLOWED_MIME.test(file.type)) return NextResponse.json({ error: "이미지 또는 PDF 만 업로드 가능합니다." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB > 12MB)` }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "doc";
  const path = `enrollments/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  let blobUrl: string;
  try {
    const blob = await put(path, buf, { access: "public", contentType: file.type, addRandomSuffix: false });
    blobUrl = blob.url;
  } catch (e) {
    return NextResponse.json({ error: "Blob 업로드 실패: " + (e instanceof Error ? e.message : "unknown") }, { status: 500 });
  }

  const created = await prisma.enrollmentDocument.create({
    data: {
      formId: form.id,
      leadId: id,
      kind: kindRaw,
      label: labelRaw || null,
      url: blobUrl,
      fileName: file.name.slice(0, 200),
      contentType: file.type,
      sizeBytes: file.size,
      uploadedById: g.actorId,
      uploadedByRole: g.actorRole,
    },
  });

  return NextResponse.json({
    ok: true,
    document: {
      id: created.id,
      kind: created.kind,
      label: created.label,
      url: created.url,
      fileName: created.fileName,
      contentType: created.contentType,
      sizeBytes: created.sizeBytes,
      uploadedByRole: created.uploadedByRole,
      createdAt: created.createdAt.toISOString(),
    },
  });
}
