/**
 * 협력점 푸터 로고 업로드 + 삭제.
 *   POST   — 이미지 업로드 (multipart/form-data, field "file")
 *   DELETE — 협력점 본인의 로고 제거 (Blob 파일도 함께 삭제)
 *
 * 헤더는 본사 정책상 SK매직 공식 로고 고정. 협력점 자체 로고는 푸터 전용.
 */
import { NextResponse } from "next/server";
import { gatePartnerOrHq } from "@/lib/effectivePartner";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB — 로고이므로 배너보다 작게
const MAX_WIDTH = 600; // 푸터 노출이라 큰 해상도 불필요
const WEBP_QUALITY = 85;

export async function POST(req: Request) {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }

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

  // 기존 로고가 있으면 Blob 에서 삭제 (덮어쓰기 → 고아 파일 방지)
  const cur = await prisma.partner.findUnique({
    where: { partnerCode: eff.partnerId },
    select: { footerLogoUrl: true },
  });
  if (cur?.footerLogoUrl) {
    try { await del(cur.footerLogoUrl); } catch { /* 구 파일 삭제 실패는 무시 */ }
  }

  const filename = `partner-logos/${eff.partnerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
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

  await prisma.partner.update({
    where: { partnerCode: eff.partnerId },
    data: { footerLogoUrl: blobUrl },
  });

  return NextResponse.json({ ok: true, url: blobUrl });
}

export async function DELETE() {
  const eff = await gatePartnerOrHq();
  if ("error" in eff) {
    return NextResponse.json({ error: eff.error }, { status: eff.error === "unauthorized" ? 401 : 403 });
  }
  const cur = await prisma.partner.findUnique({
    where: { partnerCode: eff.partnerId },
    select: { footerLogoUrl: true },
  });
  if (cur?.footerLogoUrl) {
    try { await del(cur.footerLogoUrl); } catch { /* noop */ }
  }
  await prisma.partner.update({
    where: { partnerCode: eff.partnerId },
    data: { footerLogoUrl: null },
  });
  return NextResponse.json({ ok: true });
}
