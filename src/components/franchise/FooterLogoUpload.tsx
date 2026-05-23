"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 협력점 푸터 로고 업로드 + 미리보기 + 삭제.
 * 헤더 로고는 본사 정책상 SK매직 공식 로고 고정 — 푸터 전용.
 */
export default function FooterLogoUpload({ initialUrl }: { initialUrl: string | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setFlash(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/franchise/footer-logo", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "업로드 실패" }); return; }
      setUrl(j.url);
      setFlash({ tone: "ok", text: "업로드 완료 — 컨슈머 사이트 푸터에 즉시 반영됩니다." });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onRemove = async () => {
    if (!window.confirm("협력점 로고를 삭제하시겠습니까? 컨슈머 사이트 푸터에서 즉시 사라집니다.")) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/franchise/footer-logo", { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "삭제 실패" }); return; }
      setUrl(null);
      setFlash({ tone: "ok", text: "로고가 삭제되었습니다." });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[14px] font-semibold text-rk-ink">협력점 로고 (푸터 노출)</h3>
        <small className="text-[12px] text-rk-muted">PNG/JPG/WebP · 최대 4MB · 자동으로 너비 600px WebP 로 변환</small>
      </div>
      <p className="text-[12px] text-rk-muted mb-3 leading-[1.5]">
        헤더 로고는 본사 정책상 SK매직 공식 로고로 고정됩니다. 협력점 자체 로고는 컨슈머 사이트 <b>푸터 상단</b>에만 노출되며,
        업로드하지 않으면 푸터에 로고 없이 텍스트 정보만 표시됩니다.
      </p>

      <div className="flex items-start gap-4 flex-wrap">
        <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-2 flex items-center justify-center min-w-[120px] min-h-[80px]">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="협력점 로고 미리보기" className="max-h-[60px] max-w-[200px] object-contain" />
          ) : (
            <span className="text-[12px] text-rk-faint">로고 없음</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onSelect}
            disabled={busy}
            className="text-[13px]"
          />
          {url && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="text-[13px] bg-white border border-rk-line text-rk-sale hover:bg-rk-tint-red px-2.5 py-1 rounded self-start cursor-pointer disabled:opacity-50"
            >
              {busy ? "처리 중…" : "✕ 로고 삭제"}
            </button>
          )}
        </div>
      </div>

      {flash && (
        <div className={"mt-3 px-3 py-2 rounded text-[13px] " + (flash.tone === "ok" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
          {flash.text}
        </div>
      )}
    </div>
  );
}
