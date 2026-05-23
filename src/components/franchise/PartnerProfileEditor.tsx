"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HQ_HOTLINE } from "@/lib/constants/hq";

type InitialProfile = {
  partnerCode: string;
  partnerName: string;
  brandLabel: string;
  region: string | null;
  address: string | null;
  ownerName: string | null;
  hotlineNumber: string;
  phone: string | null;
  businessNumber: string | null;
  commerceNumber: string | null;
  telegramChatId: string | null;
  csHours: string | null;
  csLunchHours: string | null;
  csHolidays: string | null;
};

export default function PartnerProfileEditor({ initial }: { initial: InitialProfile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [brandLabel, setBrandLabel] = useState(initial.brandLabel);
  const [region, setRegion] = useState(initial.region ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [ownerName, setOwnerName] = useState(initial.ownerName ?? "");
  const [hotlineNumber, setHotlineNumber] = useState(initial.hotlineNumber);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [businessNumber, setBusinessNumber] = useState(initial.businessNumber ?? "");
  const [commerceNumber, setCommerceNumber] = useState(initial.commerceNumber ?? "");
  const [telegramChatId, setTelegramChatId] = useState(initial.telegramChatId ?? "");
  const [csHours, setCsHours] = useState(initial.csHours ?? "");
  const [csLunchHours, setCsLunchHours] = useState(initial.csLunchHours ?? "");
  const [csHolidays, setCsHolidays] = useState(initial.csHolidays ?? "");

  const dirty =
    brandLabel !== initial.brandLabel ||
    (region || null) !== initial.region ||
    (address || null) !== initial.address ||
    (ownerName || null) !== initial.ownerName ||
    hotlineNumber !== initial.hotlineNumber ||
    (phone || null) !== initial.phone ||
    (businessNumber || null) !== initial.businessNumber ||
    (commerceNumber || null) !== initial.commerceNumber ||
    (telegramChatId || null) !== initial.telegramChatId ||
    (csHours || null) !== initial.csHours ||
    (csLunchHours || null) !== initial.csLunchHours ||
    (csHolidays || null) !== initial.csHolidays;

  const save = async () => {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/franchise/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandLabel,
          region: region.trim() || null,
          address: address.trim() || null,
          ownerName: ownerName.trim() || null,
          hotlineNumber,
          phone: phone.trim() || null,
          businessNumber: businessNumber.trim() || null,
          commerceNumber: commerceNumber.trim() || null,
          telegramChatId: telegramChatId.trim() || null,
          csHours: csHours.trim() || null,
          csLunchHours: csLunchHours.trim() || null,
          csHolidays: csHolidays.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setFlash({ tone: "err", text: j.error ?? "저장 실패" }); return; }
      setFlash({ tone: "ok", text: "저장되었습니다. 소비자 사이트에 즉시 반영됩니다." });
      startTransition(() => router.refresh());
    } catch {
      setFlash({ tone: "err", text: "네트워크 오류" });
    } finally { setBusy(false); }
  };

  const reset = () => {
    setBrandLabel(initial.brandLabel);
    setRegion(initial.region ?? "");
    setAddress(initial.address ?? "");
    setOwnerName(initial.ownerName ?? "");
    setHotlineNumber(initial.hotlineNumber);
    setPhone(initial.phone ?? "");
    setBusinessNumber(initial.businessNumber ?? "");
    setCommerceNumber(initial.commerceNumber ?? "");
    setTelegramChatId(initial.telegramChatId ?? "");
    setCsHours(initial.csHours ?? "");
    setCsLunchHours(initial.csLunchHours ?? "");
    setCsHolidays(initial.csHolidays ?? "");
    setFlash(null);
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-5 mb-3">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-rk-ink">자율 편집 항목</h3>
        <small className="text-[12px] text-rk-muted">소비자 사이트(/p/...) 즉시 반영</small>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2.5 text-[13px] items-center">
        {/* 협력점 코드 — 변경 불가 */}
        <label className="text-rk-muted">협력점 코드</label>
        <div className="text-rk-ink font-mono text-[13px]">
          {initial.partnerCode} <span className="text-[12px] text-rk-faint">(변경 불가)</span>
        </div>

        {/* 상호 — 본사 승인 필요 */}
        <label className="text-rk-muted">상호</label>
        <div className="flex items-center gap-2">
          <span className="text-rk-ink">{initial.partnerName}</span>
          <span className="text-[11px] px-1.5 py-px rounded bg-rk-tint-orange text-rk-orange-deep">본사 변경</span>
        </div>

        {/* 브랜드 라벨 */}
        <label htmlFor="brandLabel" className="text-rk-muted">브랜드 라벨</label>
        <input
          id="brandLabel"
          type="text"
          value={brandLabel}
          onChange={e => setBrandLabel(e.target.value)}
          maxLength={60}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />

        {/* 지역 */}
        <label htmlFor="region" className="text-rk-muted">지역</label>
        <input
          id="region"
          type="text"
          value={region}
          onChange={e => setRegion(e.target.value)}
          placeholder="예: 서울 강남구"
          maxLength={60}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />

        {/* 대표자명 */}
        <label htmlFor="ownerName" className="text-rk-muted">대표자명</label>
        <input
          id="ownerName"
          type="text"
          value={ownerName}
          onChange={e => setOwnerName(e.target.value)}
          maxLength={40}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />

        {/* 고객센터 번호 */}
        <label htmlFor="hotlineNumber" className="text-rk-muted">고객센터 번호</label>
        <input
          id="hotlineNumber"
          type="text"
          value={hotlineNumber}
          onChange={e => setHotlineNumber(e.target.value)}
          placeholder={`예: ${HQ_HOTLINE}`}
          maxLength={24}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50 rk-num"
        />

        {/* CS 운영시간 (자유 텍스트) — 컨슈머 사이트 footer/CTA 영역에 노출 */}
        <label htmlFor="csHours" className="text-rk-muted">영업시간</label>
        <input
          id="csHours"
          type="text"
          value={csHours}
          onChange={e => setCsHours(e.target.value)}
          placeholder="예: 평일 09:00-18:00"
          maxLength={80}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />

        <label htmlFor="csLunchHours" className="text-rk-muted">점심시간</label>
        <input
          id="csLunchHours"
          type="text"
          value={csLunchHours}
          onChange={e => setCsLunchHours(e.target.value)}
          placeholder="예: 12:00-13:00"
          maxLength={80}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />

        <label htmlFor="csHolidays" className="text-rk-muted">휴무일</label>
        <input
          id="csHolidays"
          type="text"
          value={csHolidays}
          onChange={e => setCsHolidays(e.target.value)}
          placeholder="예: 토·일·공휴일"
          maxLength={80}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />

        {/* 협력점 연락처 */}
        <label htmlFor="phone" className="text-rk-muted">협력점 연락처</label>
        <input
          id="phone"
          type="text"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="예: 02-1234-5678"
          maxLength={24}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50 rk-num"
        />

        {/* 주소 */}
        <label htmlFor="address" className="text-rk-muted">주소</label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="예: 서울특별시 강남구 테헤란로 123, 5층"
          maxLength={200}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />

        {/* 사업자번호 — 협력점 직접 입력 (항목 12) */}
        <label htmlFor="businessNumber" className="text-rk-muted">사업자번호</label>
        <input
          id="businessNumber"
          type="text"
          value={businessNumber}
          onChange={e => setBusinessNumber(e.target.value)}
          placeholder="예: 123-45-67890"
          maxLength={20}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50 rk-num"
        />

        <label htmlFor="commerceNumber" className="text-rk-muted">통신판매번호</label>
        <input
          id="commerceNumber"
          type="text"
          value={commerceNumber}
          onChange={e => setCommerceNumber(e.target.value)}
          placeholder="예: 제2024-서울강남-1234호"
          maxLength={40}
          disabled={busy}
          className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50"
        />

        {/* 텔레그램 chat_id — 신규 lead/신청서 알림용 */}
        <label htmlFor="telegramChatId" className="text-rk-muted">텔레그램 chat_id</label>
        <div className="flex flex-col gap-1">
          <input
            id="telegramChatId"
            type="text"
            value={telegramChatId}
            onChange={e => setTelegramChatId(e.target.value)}
            placeholder="예: 123456789 (받기 안 받으려면 비워두세요)"
            maxLength={32}
            disabled={busy}
            className="border border-rk-line rounded px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-rk-navy disabled:opacity-50 rk-num"
          />
          <small className="text-[11px] text-rk-faint leading-[1.5]">
            본사 봇이 신규 상담/신청서를 이 chat_id 로 알림 발송합니다. 텔레그램에서 <b>@SKmagicShopBot</b> 검색 → 대화 시작 → <code className="font-mono bg-rk-soft px-1 rounded">/start</code> 메시지 보내면 봇이 응답하면서 chat_id 안내합니다 (또는 본사 운영팀 문의).
          </small>
        </div>
      </div>

      {flash && (
        <div
          className={
            "mt-3 px-3 py-2 rounded text-[13px] " +
            (flash.tone === "ok"
              ? "bg-rk-tint-green text-rk-success"
              : "bg-rk-tint-red text-rk-sale")
          }
        >
          {flash.text}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={busy || pending || !dirty}
          className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-4 py-1.5 rounded text-[13px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy || !dirty}
          className="bg-white hover:bg-rk-soft-2 text-rk-ink border border-rk-line rounded px-3 py-1.5 text-[13px] cursor-pointer disabled:opacity-50"
        >
          되돌리기
        </button>
        {dirty && (
          <small className="text-[12px] text-rk-orange-deep ml-2">⚠ 저장하지 않은 변경사항</small>
        )}
      </div>
    </div>
  );
}
