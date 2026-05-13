"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export type ContentImageRow = {
  id: string;
  url: string;
  sourceUrl: string;
  order: number;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  status: string;
  downloadedAt: string;
};

export default function ContentImagesPanel({ productCode, images }: { productCode: string; images: ContentImageRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null); // image id or "_refresh"
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const totalKB = Math.round(images.reduce((s, i) => s + (i.sizeBytes ?? 0), 0) / 1024);

  const deleteOne = async (img: ContentImageRow) => {
    if (!confirm(`이 이미지를 삭제합니다. (Blob + DB)\n${img.sourceUrl.slice(0, 80)}`)) return;
    setError(null); setMsg(null);
    setBusy(img.id);
    try {
      const r = await fetch(`/api/admin/products/${productCode}/content-images/${img.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "삭제 실패"); return; }
      startTransition(() => router.refresh());
    } finally { setBusy(null); }
  };

  const refreshIncremental = async (force: boolean) => {
    const label = force ? "전체 삭제 후 재다운로드" : "신규 sourceUrl 만 다운로드";
    if (!confirm(`${label}.\n(최근 크롤 결과의 contentImageUrls 기반)`)) return;
    setError(null); setMsg(null);
    setBusy("_refresh");
    try {
      const r = await fetch(`/api/admin/products/${productCode}/content-images/refresh${force ? "?force=true" : ""}`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "재다운로드 실패"); return; }
      setMsg(`성공 — 삭제 ${j.removed}장, 시도 ${j.attempted}장, 저장 ${j.stored}장, 실패 ${j.failed}장, 기존 스킵 ${j.skippedExisting}장`);
      startTransition(() => router.refresh());
    } finally { setBusy(null); }
  };

  return (
    <section className="bg-white border border-rk-line rounded-lg p-4">
      <div className="flex items-baseline mb-3 flex-wrap gap-2">
        <h3 className="text-[14px] font-semibold text-rk-ink">📋 본문 마케팅 이미지</h3>
        <small className="text-[13px] text-rk-muted">
          {images.length}장 · 총 {fmt(totalKB)}KB · Vercel Blob 영구 저장
        </small>
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            disabled={!!busy || pending}
            onClick={() => refreshIncremental(false)}
            className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50"
          >
            {busy === "_refresh" ? "처리 중…" : "🔄 신규만 동기화"}
          </button>
          <button
            type="button"
            disabled={!!busy || pending}
            onClick={() => refreshIncremental(true)}
            className="bg-rk-sale text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50"
          >
            {busy === "_refresh" ? "처리 중…" : "♻ 전체 재다운로드"}
          </button>
        </div>
      </div>

      {error && <div className="bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[13px] mb-2">⚠ {error}</div>}
      {msg && <div className="bg-rk-tint-green text-rk-success px-3 py-1.5 rounded text-[13px] mb-2">✓ {msg}</div>}

      {images.length === 0 ? (
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-6 text-center text-[14px] text-rk-muted">
          저장된 본문 이미지가 없습니다. 크롤 승인 시점에 자동으로 다운로드되거나, 위 "🔄 신규만 동기화" 버튼으로 가져옵니다.
        </div>
      ) : (
        <>
          {/* 범례 */}
          <div className="mb-2 text-[12px] text-rk-muted">
            전체 {images.length}장 · 매장 노출 <b className="text-rk-success">{images.filter(i => i.status === "active").length}장</b>
            {images.some(i => i.status === "anomalous_size") && <> · 자동 가려짐 <b className="text-rk-orange-deep">{images.filter(i => i.status === "anomalous_size").length}장</b> (median ±15% 밖)</>}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {images.map(img => {
              const isAnomalous = img.status === "anomalous_size";
              return (
                <div key={img.id} className={
                  "border rounded overflow-hidden " +
                  (isAnomalous ? "border-rk-orange opacity-60 bg-rk-tint-orange" : "border-rk-line bg-rk-soft-2")
                }>
                  <a href={img.url} target="_blank" rel="noreferrer" className="block aspect-[3/4] bg-white relative">
                    <img src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
                    {isAnomalous && (
                      <span className="absolute top-1 left-1 bg-rk-orange text-white text-[9px] px-1 py-px rounded font-semibold">
                        가려짐
                      </span>
                    )}
                  </a>
                  <div className="p-1.5 text-[12px] text-rk-muted">
                    <div className="flex justify-between">
                      <span>#{img.order}</span>
                      <span className={"rk-num " + (isAnomalous ? "text-rk-orange-deep font-medium" : "")}>
                        {img.width && img.height ? `${img.width}×${img.height}` : "—"}
                      </span>
                    </div>
                    <div className="rk-num">{img.sizeBytes ? `${Math.round(img.sizeBytes / 1024)}KB` : "—"}</div>
                    {isAnomalous && (
                      <div className="text-[9px] text-rk-orange-deep">⚠ 매장 자동 가려짐</div>
                    )}
                    <a
                      href={img.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-rk-info no-underline truncate font-mono"
                      title={img.sourceUrl}
                    >
                      원본 →
                    </a>
                    <button
                      type="button"
                      disabled={busy === img.id || pending}
                      onClick={() => deleteOne(img)}
                      className="mt-1 w-full bg-rk-soft hover:bg-rk-sale hover:text-white text-rk-muted border-0 py-0.5 rounded text-[12px] cursor-pointer disabled:opacity-50"
                    >
                      {busy === img.id ? "삭제 중…" : "삭제"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
