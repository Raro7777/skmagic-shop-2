/**
 * 영업자 본인 푸터 로고 업로드/삭제. 협력점 로고와 별개 — 영업자 페이지에서만 적용.
 * 비우면 협력점 로고로 폴백.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_WIDTH = 600;
const WEBP_QUALITY = 85;

async function gateSelf() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.user.role !== "seller") {
    return { err: NextResponse.json({ error: "영업자 본인만" }, { status: 403 }) };
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: session.user.id },
    select: { id: true, partnerId: true, footerLogoUrl: true },
  });
  if (!seller) return { err: NextResponse.json({ error: "Seller row not found" }, { status: 404 }) };
  return { seller };
}

export async function POST(req: Request) {
  const g = await gateSelf();
  if ("err" in g) return g.err;

  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ error: "multipart/form-data 필요" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file 필드 누락" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB > 4MB)` }, { status: 400 });
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let outBuffer: Buffer;
  try {
    const image = sharp(inputBuffer);
    const meta = await image.metadata();
    const needsResize = (meta.width ?? 0) > MAX_WIDTH;
    const pipeline = needsResize ? image.resize({ width: MAX_WIDTH, withoutEnlargement: true }) : image;
    const result = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    outBuffer = result.data;
  } catch (e) {
    return NextResponse.json({ error: "이미지 처리 실패: " + (e instanceof Error ? e.message : "unknown") }, { status: 400 });
  }

  if (g.seller.footerLogoUrl) {
    try { await del(g.seller.footerLogoUrl); } catch { /* noop */ }
  }

  const filename = `seller-logos/${g.seller.partnerId}/${g.seller.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  let blobUrl: string;
  try {
    const blob = await put(filename, outBuffer, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
    });
    blobUrl = blob.url;
  } catch (e) {
    return NextResponse.json({ error: "Blob 업로드 실패: " + (e instanceof Error ? e.message : "unknown") }, { status: 500 });
  }

  await prisma.seller.update({ where: { id: g.seller.id }, data: { footerLogoUrl: blobUrl } });
  return NextResponse.json({ ok: true, url: blobUrl });
}

export async function DELETE() {
  const g = await gateSelf();
  if ("err" in g) return g.err;
  if (g.seller.footerLogoUrl) {
    try { await del(g.seller.footerLogoUrl); } catch { /* noop */ }
  }
  await prisma.seller.update({ where: { id: g.seller.id }, data: { footerLogoUrl: null } });
  return NextResponse.json({ ok: true });
}
