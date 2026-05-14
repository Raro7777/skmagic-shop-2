"use client";

import { useEffect, useState } from "react";

type Item = {
  id: string;
  productCode: string | null;
  productName: string | null;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  installPhotoUrl: string | null;
  region: string | null;
  approvalStatus: string;
  rejectReason: string | null;
  createdAt: string;
  approvedAt: string | null;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:  { label: "🟡 본사 검토 중", cls: "bg-rk-tint-orange text-rk-orange-deep" },
  approved: { label: "✅ 승인 노출 중",  cls: "bg-rk-tint-green text-rk-success" },
  rejected: { label: "❌ 거절됨",        cls: "bg-rk-tint-red text-rk-sale" },
};

export default function ReviewEditorClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [region, setRegion] = useState("");
  const [installPhotoUrl, setInstallPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/franchise/reviews", { cache: "no-store" });
      const j = await res.json();
      if (res.ok) setItems(j.items ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const uploadFile = async (file: File) => {
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/franchise/banners/upload-image", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "업로드 실패"); return; }
      setInstallPhotoUrl(j.url);
    } catch {
      setError("네트워크 오류");
    } finally { setUploading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerName.trim() || !body.trim()) { setError("고객 이름과 후기 본문은 필수입니다."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/franchise/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: productCode.trim() || undefined,
          customerName: customerName.trim(),
          rating, title: title.trim() || undefined,
          body: body.trim(),
          region: region.trim() || undefined,
          installPhotoUrl: installPhotoUrl || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "등록 실패"); return; }
      setToast("등록 완료 — 본사 승인 후 컨슈머 사이트에 노출됩니다.");
      setTimeout(() => setToast(null), 5000);
      setShowForm(false);
      setCustomerName(""); setProductCode(""); setRating(5); setTitle(""); setBody(""); setRegion(""); setInstallPhotoUrl("");
      await load();
    } finally { setSubmitting(false); }
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      {toast && (
        <div className="bg-rk-tint-green text-rk-success px-3 py-2 rounded text-[13px] mb-3">✓ {toast}</div>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3.5 py-2 rounded text-[13px] cursor-pointer font-semibold mb-3"
        >
          + 새 후기 등록
        </button>
      ) : (
        <form onSubmit={submit} className="bg-rk-soft-2 border border-rk-line-2 rounded p-3 mb-3 flex flex-col gap-2 text-[13px]">
          <div className="font-semibold text-rk-ink mb-1">새 후기 등록</div>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="text-rk-muted block mb-1">고객 이름 (마스킹 권장: 김*희)</span>
              <input required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-2 py-1 border border-rk-line rounded" placeholder="김*희" />
            </label>
            <label>
              <span className="text-rk-muted block mb-1">지역</span>
              <input value={region} onChange={e => setRegion(e.target.value)} className="w-full px-2 py-1 border border-rk-line rounded" placeholder="강남구" />
            </label>
            <label>
              <span className="text-rk-muted block mb-1">상품 코드 (선택)</span>
              <input value={productCode} onChange={e => setProductCode(e.target.value.toUpperCase())} className="w-full px-2 py-1 border border-rk-line rounded font-mono" placeholder="WPUIAC506SNS" />
            </label>
            <label>
              <span className="text-rk-muted block mb-1">별점 (1~5)</span>
              <select value={rating} onChange={e => setRating(parseInt(e.target.value, 10))} className="w-full px-2 py-1 border border-rk-line rounded bg-white">
                {[5,4,3,2,1].map(n => <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5-n)} ({n})</option>)}
              </select>
            </label>
          </div>
          <label>
            <span className="text-rk-muted block mb-1">제목 (선택)</span>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-2 py-1 border border-rk-line rounded" placeholder="설치 후 한 달 사용 후기" />
          </label>
          <label>
            <span className="text-rk-muted block mb-1">후기 본문 *</span>
            <textarea required value={body} onChange={e => setBody(e.target.value)} rows={4} className="w-full px-2 py-1 border border-rk-line rounded resize-y" placeholder="고객 동의 하에 작성한 후기 내용" />
          </label>
          <label>
            <span className="text-rk-muted block mb-1">설치 사진 (선택)</span>
            <div className="flex items-center gap-2">
              {installPhotoUrl && (
                <>
                  <img src={installPhotoUrl} alt="" className="w-[60px] h-[60px] object-cover rounded border border-rk-line" />
                  <button type="button" onClick={() => setInstallPhotoUrl("")} className="text-[11px] text-rk-sale bg-transparent border-0 cursor-pointer">제거</button>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.target.value = ""; }}
                className="text-[12px]"
              />
              {uploading && <small className="text-rk-info">⏳ 업로드 중…</small>}
            </div>
          </label>
          {error && <div className="text-rk-sale">⚠ {error}</div>}
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={submitting} className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1.5 rounded cursor-pointer font-semibold disabled:opacity-50">
              {submitting ? "등록 중…" : "등록 (본사 승인 대기)"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="bg-white border border-rk-line text-rk-text px-3 py-1.5 rounded cursor-pointer">
              취소
            </button>
            <small className="text-rk-faint ml-auto self-center">고객 동의 후 등록. 본사 검토 후 컨슈머 사이트에 노출.</small>
          </div>
        </form>
      )}

      <h3 className="text-[14px] font-semibold text-rk-ink mb-2">내 점 등록 후기 ({items.length})</h3>
      {loading ? (
        <div className="text-rk-muted text-[14px] py-4 text-center">로딩 중…</div>
      ) : items.length === 0 ? (
        <div className="text-rk-faint text-[14px] py-4 text-center">아직 등록된 후기가 없습니다.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(it => {
            const badge = STATUS_BADGE[it.approvalStatus] ?? STATUS_BADGE.pending;
            return (
              <article key={it.id} className="border border-rk-line-2 rounded p-2.5 flex gap-2.5">
                {it.installPhotoUrl && <img src={it.installPhotoUrl} alt="" className="w-[80px] h-[80px] object-cover rounded shrink-0 border border-rk-line" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap mb-1">
                    <span className="text-rk-warn">{"★".repeat(it.rating)}</span>
                    <b className="text-[13px] text-rk-ink">{it.customerName}</b>
                    {it.region && <span className="text-[12px] text-rk-muted">· {it.region}</span>}
                    <span className={"text-[11px] px-1.5 py-0.5 rounded font-medium " + badge.cls}>{badge.label}</span>
                    <span className="text-[12px] text-rk-faint ml-auto rk-num">{it.createdAt.slice(0, 10)}</span>
                  </div>
                  {it.title && <b className="block text-[13px] text-rk-ink mb-0.5">{it.title}</b>}
                  <p className="text-[12px] text-rk-text m-0 line-clamp-3 whitespace-pre-wrap">{it.body}</p>
                  {it.rejectReason && (
                    <div className="mt-1 text-[12px] bg-rk-tint-red text-rk-sale px-2 py-1 rounded">
                      거절 사유: {it.rejectReason}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
