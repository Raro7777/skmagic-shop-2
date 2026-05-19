/**
 * POST /api/admin/banner-templates/upload-image
 *
 * 본사 슈퍼관리자가 표준 배너 템플릿 이미지를 업로드.
 *   - multipart/form-data, field "file"
 *   - 1600px 너비로 리사이즈 + WebP 82% 압축 (협력점 endpoint 와 동일 정책)
 *   - Vercel Blob 저장 경로: banners/_templates/{timestamp}-...webp
 *   - 응답: { url, width, height, sizeBytes }
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { put } from "@vercel/blob";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 82;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "hq") return NextResponse.json({ error: "Forbidden — 본사 전용" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart/form-data 필요" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file 필드 누락" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: `파일이 너무 큽니다 (${(file.size / 1024 / 1024).toFixed(1)}MB > 8MB)` }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  let outBuffer: Buffer;
  let width: number | null = null;
  let height: number | null = null;
  try {
    const image = sharp(inputBuffer);
    const meta = await image.metadata();
    const needsResize = (meta.width ?? 0) > MAX_WIDTH;
    const pipeline = needsResize
      ? image.resize({ width: MAX_WIDTH, withoutEnlargement: true })
      : image;
    const result = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    outBuffer = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch (e) {
    return NextResponse.json({ error: "이미지 처리 실패 (sharp): " + (e instanceof Error ? e.message : "unknown") }, { status: 400 });
  }

  // 본사 템플릿 이미지는 _templates 네임스페이스에 저장 (협력점 banners/{partnerId}/ 와 분리).
  const filename = `banners/_templates/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
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

  return NextResponse.json({
    ok: true,
    url: blobUrl,
    width,
    height,
    sizeBytes: outBuffer.length,
  });
}
