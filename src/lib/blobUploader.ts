import { put } from "@vercel/blob";
import sharp from "sharp";

/**
 * 외부 이미지 다운로드 → sharp 로 리사이즈/압축 → Vercel Blob 업로드.
 *
 * 룰:
 *   - 다운로드 timeout 10초
 *   - 원본 8MB cap (다운로드 시점)
 *   - content-type "image/*" 만 허용
 *   - 너비 1600px 초과 → 1600px 로 다운사이즈 (비율 유지)
 *   - 출력: WebP 82% quality (PNG transparency 도 보존)
 *   - 실패 시 null (예외 안 던짐) — Promise.allSettled 친화적
 */

const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 1600;
const WEBP_QUALITY = 82;
const TIMEOUT_MS = 10_000;

export type BlobResult = {
  url: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  contentType: string;
};

export async function downloadAndStore(
  sourceUrl: string,
  pathname: string,
): Promise<BlobResult | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(sourceUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": "rentking-image-importer/1.0" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const lenHeader = res.headers.get("content-length");
    if (lenHeader && Number(lenHeader) > MAX_DOWNLOAD_BYTES) return null;

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_DOWNLOAD_BYTES || buf.byteLength === 0) return null;

    // sharp 처리 — 너비 1600 초과 시 다운사이즈, WebP 82% 로 변환
    let processed: Buffer;
    let width: number | null = null;
    let height: number | null = null;
    try {
      const img = sharp(Buffer.from(buf), { failOn: "none" });
      const meta = await img.metadata();
      const resizeOpts = (meta.width && meta.width > MAX_WIDTH)
        ? { width: MAX_WIDTH, withoutEnlargement: true }
        : undefined;
      const pipeline = resizeOpts ? img.resize(resizeOpts) : img;
      processed = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
      // 최종 메타데이터 (실제 출력 크기)
      const outMeta = await sharp(processed).metadata();
      width = outMeta.width ?? null;
      height = outMeta.height ?? null;
    } catch {
      // sharp 변환 실패 (예: 손상된 파일) — 원본 그대로 업로드 시도
      processed = Buffer.from(buf);
    }

    const blob = await put(`${pathname}.webp`, processed, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: true,
    });
    return {
      url: blob.url,
      sizeBytes: processed.byteLength,
      width,
      height,
      contentType: "image/webp",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 외부 URL 들을 일괄 다운로드 + 리사이즈 + 저장. 실패 안전. */
export async function downloadMany(
  items: Array<{ sourceUrl: string; pathname: string }>,
  concurrency = 5,
): Promise<Array<{ sourceUrl: string; result: BlobResult | null }>> {
  const out: Array<{ sourceUrl: string; result: BlobResult | null }> = [];
  const queue = [...items];
  let active = 0;
  return new Promise(resolve => {
    const next = () => {
      if (queue.length === 0 && active === 0) { resolve(out); return; }
      while (active < concurrency && queue.length > 0) {
        const item = queue.shift()!;
        active++;
        downloadAndStore(item.sourceUrl, item.pathname).then(result => {
          out.push({ sourceUrl: item.sourceUrl, result });
        }).finally(() => {
          active--;
          next();
        });
      }
    };
    next();
  });
}
