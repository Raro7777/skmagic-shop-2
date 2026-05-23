"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";

type FooterFields = {
  companyName: string | null;
  ownerName: string | null;
  address: string | null;
  businessNumber: string | null;
  commerceNumber: string | null;
  hotlineNumber: string | null;
  csHours: string | null;
  csLunchHours: string | null;
  csHolidays: string | null;
  kakaoChannelUrl: string | null;
  footerLogoUrl: string | null;
};

const TEXT_FIELDS: Array<{ key: keyof FooterFields; label: string; placeholder?: string }> = [
  { key: "companyName",     label: "상호",       placeholder: "본인 사업자명 또는 노출하고 싶은 이름" },
  { key: "ownerName",       label: "대표자",     placeholder: "본인 이름" },
  { key: "address",         label: "주소" },
  { key: "businessNumber",  label: "사업자번호" },
  { key: "commerceNumber",  label: "통신판매번호" },
  { key: "hotlineNumber",   label: "고객센터",   placeholder: "010-1234-5678 또는 02-xxxx" },
  { key: "csHours",         label: "영업시간",   placeholder: "평일 09:00-18:00" },
  { key: "csLunchHours",    label: "점심시간",   placeholder: "12:00-13:00" },
  { key: "csHolidays",      label: "휴무일",     placeholder: "토·일·공휴일" },
  { key: "kakaoChannelUrl", label: "카카오 채널", placeholder: "https://pf.kakao.com/_xxxx" },
];

export default function SellerFooterEditor({
  initial,
  partnerDefaults,
}: {
  initial: FooterFields;
  partnerDefaults: FooterFields;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.footerLogoUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<Record<keyof FooterFields, string>>(() => {
    const v = {} as Record<keyof FooterFields, string>;
    for (const f of TEXT_FIELDS) v[f.key] = initial[f.key] ?? "";
    v.footerLogoUrl = initial.footerLogoUrl ?? "";
    return v;
  });

  const save = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const body: Record<string, string> = {};
      for (const f of TEXT_FIELDS) body[f.key] = values[f.key];
      const res = await fetch("/api/seller/footer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "저장 실패" }); return; }
      setFlash({ tone: "ok", text: "저장되었습니다. 내 영업자 페이지 푸터에 즉시 반영됩니다." });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally {
      setBusy(false);
    }
  };

  const onLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setFlash(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/seller/footer/logo", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "업로드 실패" }); return; }
      setLogoUrl(j.url);
      setFlash({ tone: "ok", text: "로고 업로드 완료." });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onLogoRemove = async () => {
    if (!window.confirm("내 로고를 삭제할까요? 협력점 로고로 폴백됩니다.")) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/seller/footer/logo", { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "삭제 실패" }); return; }
      setLogoUrl(null);
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
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-rk-ink">텍스트 정보</h3>
        <small className="text-[12px] text-rk-muted">비워두면 협력점 정보가 표시됩니다 (괄호 안 회색)</small>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-[13px] items-center">
        {TEXT_FIELDS.map(f => (
          <Row
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            partnerFallback={partnerDefaults[f.key]}
            value={values[f.key]}
            onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
            disabled={busy}
          />
        ))}
      </div>

      {flash && (
        <div className={"mt-3 px-3 py-2 rounded text-[13px] " + (flash.tone === "ok" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-red text-rk-sale")}>
          {flash.text}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-4 py-1.5 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50"
        >
          {busy ? "저장 중…" : "텍스트 저장"}
        </button>
      </div>

      <div className="border-t border-rk-line mt-5 pt-5">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[14px] font-semibold text-rk-ink">내 로고 (푸터)</h3>
          <small className="text-[12px] text-rk-muted">PNG/JPG/WebP · 최대 4MB · 600px WebP 변환</small>
        </div>
        <p className="text-[12px] text-rk-muted mb-3 leading-[1.5]">
          내 영업자 페이지 푸터에만 적용됩니다. 미설정 시 협력점 로고로 폴백되고, 협력점도 없으면 로고 없이 텍스트만 표시됩니다.
        </p>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-2 flex items-center justify-center min-w-[120px] min-h-[80px]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="내 로고 미리보기" className="max-h-[60px] max-w-[200px] object-contain" />
            ) : partnerDefaults.footerLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={partnerDefaults.footerLogoUrl} alt="협력점 로고 폴백" className="max-h-[60px] max-w-[200px] object-contain opacity-40" title="협력점 폴백 (미설정)" />
            ) : (
              <span className="text-[12px] text-rk-faint">로고 없음</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onLogoSelect} disabled={busy} className="text-[13px]" />
            {logoUrl && (
              <button
                type="button"
                onClick={onLogoRemove}
                disabled={busy}
                className="text-[13px] bg-white border border-rk-line text-rk-sale hover:bg-rk-tint-red px-2.5 py-1 rounded self-start cursor-pointer disabled:opacity-50"
              >
                {busy ? "처리 중…" : "✕ 내 로고 삭제 (협력점 로고로 폴백)"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label, placeholder, partnerFallback, value, onChange, disabled,
}: {
  label: string;
  placeholder?: string;
  partnerFallback: string | null;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <label className="text-rk-muted">{label}</label>
      <div className="flex flex-col gap-0.5">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? ""}
          maxLength={200}
          disabled={disabled}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />
        {!value && partnerFallback && (
          <small className="text-[11px] text-rk-faint">협력점 값: {partnerFallback}</small>
        )}
      </div>
    </>
  );
}
