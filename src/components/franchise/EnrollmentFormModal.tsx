"use client";

import { useEffect, useMemo, useState } from "react";

type ProductOption = {
  productCode: string;
  name: string;
  modelName: string;
  category: string;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  managementType: string;
  isFeatured: boolean;
};

type PriceMatrixEntry = {
  mode: "방문형" | "셀프형" | null;
  contractPeriod: number;
  ownershipPeriod?: number | null;
  visitInterval?: string | null;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  rivalCompensationPrice?: number | null;
  rivalCompensationHalfPriceMonths?: number | null;
};

type ProductDetail = {
  productCode: string;
  name: string;
  rentalPrice: number;
  cardDiscountPrice: number | null;
  contractPeriod: number;
  managementType: string;
  priceMatrix: PriceMatrixEntry[];
  colorOptions: string[];
};

// SK매직 결제일 정책 — 10/20/25 중 선택 (3가지로 좁힘, 2026-05).
// 기존 신청서가 month_end / day_15 / weekly_friday / custom 으로 저장돼 있을 수 있어
// 표시는 가능하되 신규 선택은 막음.
const PAYMENT_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "day_10", label: "매월 10일" },
  { key: "day_20", label: "매월 20일" },
  { key: "day_25", label: "매월 25일" },
];
const LEGACY_PAYMENT_LABEL: Record<string, string> = {
  month_end: "익월 말일 (구버전)",
  day_15: "매월 15일 (구버전)",
  weekly_friday: "익주 금요일 (구버전)",
  custom: "직접 입력 (구버전)",
};

const KOREAN_BANKS = [
  "국민", "신한", "우리", "하나", "농협", "기업", "SC제일", "씨티", "카카오뱅크",
  "케이뱅크", "토스뱅크", "수협", "부산", "대구", "광주", "전북", "경남", "제주", "산업",
];

const KOREAN_CARDS = [
  "BC", "KB국민", "신한", "우리", "하나", "삼성", "현대", "롯데", "NH농협",
  "씨티", "광주", "전북", "수협", "카카오뱅크", "토스뱅크",
];

export type EnrollmentFormModalProps = {
  leadId: string;
  /** lead 에서 prefill 할 기본값 */
  prefill: {
    customerName: string;
    phone: string;
    productCode: string;
    productName: string;
    managementMode: "방문형" | "셀프형" | null;
    contractPeriod: number;
    visitInterval?: string | null;
    monthlyPrice: number;
    isRivalCompensation: boolean;
    isHalfPriceMonths?: number | null;
    giftAmount: number;
    giftLabel?: string | null;
    selectedColor?: string | null;
    colorOptions?: string[];
    /** 모달 안에서 verify_failed/verify_revise 안내 + 재제출 메시지 표시용 */
    currentLeadStatus?: string | null;
    /** 본사가 회송 시 적은 사유 (lead.verifyLastReason) */
    verifyLastReason?: string | null;
    verifyAttempts?: number;
  };
  /** 기존 신청서 (수정 모드) */
  existing?: ExistingFormData | null;
  /** 저장 후 form_ready 자동 전이 여부 */
  autoAdvance?: boolean;
  onClose: () => void;
  onSaved: (advanced: boolean) => void;
};

export type ExistingFormData = {
  customerName: string;
  residentRegNumber: string;
  email: string | null;
  phone: string;
  address: string;
  addressDetail: string | null;
  paymentDayType: string;
  paymentDayValue: string | null;
  installSchedule: string | null;
  paymentMethod?: string | null;
  autoDebitBank: string | null;
  autoDebitAccount: string | null;
  autoDebitHolder: string | null;
  cardCompany?: string | null;
  cardNumber?: string | null;
  cardHolder?: string | null;
  cardExpiry?: string | null;
  giftBank: string | null;
  giftAccount: string | null;
  giftHolder: string | null;
  giftPaidBy?: string | null;
  giftCashAmount?: number | null;
  memo: string | null;
  lockedAt: string | null;
  selectedColor?: string | null;
  // 상품/약정 스냅샷 (Lead 와 분리되어 EnrollmentForm 에 저장된 값)
  productCode?: string | null;
  productName?: string | null;
  managementMode?: "방문형" | "셀프형" | null;
  contractPeriod?: number | null;
  monthlyPrice?: number | null;
  isRivalCompensation?: boolean | null;
};

export default function EnrollmentFormModal({
  leadId, prefill, existing, autoAdvance, onClose, onSaved,
}: EnrollmentFormModalProps) {
  const isEdit = !!existing;
  const isLocked = !!existing?.lockedAt;

  const [customerName, setCustomerName] = useState(existing?.customerName ?? prefill.customerName);
  const [residentRegNumber, setRRN] = useState(existing?.residentRegNumber ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? prefill.phone);
  const [address, setAddress] = useState(existing?.address ?? "");
  const [addressDetail, setAddressDetail] = useState(existing?.addressDetail ?? "");

  const [paymentDayType, setPaymentDayType] = useState(existing?.paymentDayType ?? "day_10");
  const [paymentDayValue, setPaymentDayValue] = useState(existing?.paymentDayValue ?? "");

  const [installSchedule, setInstallSchedule] = useState(existing?.installSchedule ?? "");

  const [paymentMethod, setPaymentMethod] = useState<"auto_debit" | "card">(
    (existing?.paymentMethod === "card" ? "card" : "auto_debit") as "auto_debit" | "card"
  );
  const [autoDebitBank, setAutoDebitBank] = useState(existing?.autoDebitBank ?? "");
  const [autoDebitAccount, setAutoDebitAccount] = useState(existing?.autoDebitAccount ?? "");
  const [autoDebitHolder, setAutoDebitHolder] = useState(existing?.autoDebitHolder ?? prefill.customerName);
  const [cardCompany, setCardCompany] = useState(existing?.cardCompany ?? "");
  const [cardNumber, setCardNumber] = useState(existing?.cardNumber ?? "");
  const [cardHolder, setCardHolder] = useState(existing?.cardHolder ?? prefill.customerName);
  const [cardExpiry, setCardExpiry] = useState(existing?.cardExpiry ?? "");

  // 사은계좌 — null 이면 자동이체와 동일.
  // 신용카드 결제는 계좌가 없으므로 sameAccount 가 의미 없음 → 초기값/자동 해제 처리.
  const initialSameAccount = existing?.paymentMethod !== "card" && !existing?.giftBank;
  const [sameAccount, setSameAccount] = useState(initialSameAccount);
  const [giftBank, setGiftBank] = useState(existing?.giftBank ?? "");
  const [giftAccount, setGiftAccount] = useState(existing?.giftAccount ?? "");
  const [giftHolder, setGiftHolder] = useState(existing?.giftHolder ?? "");

  // 사은품 지급처 — "본사" | "협력점" | null (미지정)
  const [giftPaidBy, setGiftPaidBy] = useState<string>(existing?.giftPaidBy ?? "");
  // 협력점이 직접 입금하는 현금 금액 (giftPaidBy === "협력점" 일 때만 의미)
  const [giftCashAmount, setGiftCashAmount] = useState(
    existing?.giftCashAmount != null ? String(existing.giftCashAmount) : ""
  );

  // 결제수단 변경 시 — 신용카드로 바뀌면 sameAccount 강제 해제 (자동이체 계좌가 없어 동일 사용 불가)
  useEffect(() => {
    if (paymentMethod === "card" && sameAccount) {
      setSameAccount(false);
    }
  }, [paymentMethod, sameAccount]);

  const [memo, setMemo] = useState(existing?.memo ?? "");

  // 상품 선택 — existing(저장된 신청서) 우선, 없으면 prefill(Lead) fallback.
  // 협력점이 모달에서 상품/약정/모드/가격을 변경 후 저장하면 그 값이 다시 열 때 그대로 노출.
  const [productCode, setProductCode] = useState(existing?.productCode ?? prefill.productCode ?? "");
  const [productName, setProductName] = useState(existing?.productName ?? prefill.productName ?? "");
  const [contractPeriod, setContractPeriod] = useState<number>(existing?.contractPeriod ?? prefill.contractPeriod ?? 60);
  const [monthlyPrice, setMonthlyPrice] = useState<number>(existing?.monthlyPrice ?? prefill.monthlyPrice ?? 0);
  const [productSearch, setProductSearch] = useState("");
  const [productList, setProductList] = useState<ProductOption[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  // 옵션 시뮬 — 운영방식·약정·타사보상이 동적으로 동작하는 박스
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"방문형" | "셀프형" | null>(
    existing?.managementMode ?? prefill.managementMode ?? null,
  );
  const [rivalApplied, setRivalApplied] = useState(existing?.isRivalCompensation ?? prefill.isRivalCompensation ?? false);

  // 색상/사이즈 변형 — 가격에는 영향 없음
  const [selectedColor, setSelectedColor] = useState<string | null>(
    existing?.selectedColor ?? prefill.selectedColor ?? prefill.colorOptions?.[0] ?? null,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 변경 사유 — 수정 모드에서만 노출, 저장 시 history 에 기록
  const isReturned = prefill.currentLeadStatus === "verify_failed" || prefill.currentLeadStatus === "verify_revise";
  const [changeSource, setChangeSource] = useState<"customer_request" | "internal_correction" | "hq_revision_response">(
    isReturned ? "hq_revision_response" : "internal_correction"
  );
  const [changeReason, setChangeReason] = useState("");

  // body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // 마운트 직후 active 상품 목록 prefetch
  useEffect(() => {
    let cancelled = false;
    setProductLoading(true);
    fetch(`/api/products?limit=200`, { credentials: "include" })
      .then(r => r.json())
      .then(j => {
        if (cancelled) return;
        if (Array.isArray(j.products)) setProductList(j.products);
      })
      .catch(() => { /* noop */ })
      .finally(() => { if (!cancelled) setProductLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return productList.slice(0, 30);
    return productList
      .filter(p =>
        p.name.toLowerCase().includes(q)
        || p.productCode.toLowerCase().includes(q)
        || p.modelName.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [productList, productSearch]);

  const selectProduct = (p: ProductOption) => {
    setProductCode(p.productCode);
    setProductName(p.name);
    setContractPeriod(p.contractPeriod);
    setMonthlyPrice((p.cardDiscountPrice && p.cardDiscountPrice > 0) ? p.cardDiscountPrice : p.rentalPrice);
    setProductOpen(false);
    setProductSearch("");
    setProductDetail(null); // 새 detail fetch 트리거
    setRivalApplied(false);
  };

  // productCode 변경 시 detail (priceMatrix 포함) 가져오기
  useEffect(() => {
    if (!productCode.trim()) { setProductDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/products/${encodeURIComponent(productCode.trim())}`, { credentials: "include" })
      .then(r => r.json())
      .then(j => {
        if (cancelled) return;
        if (!j?.product) { setProductDetail(null); return; }
        const detail: ProductDetail = {
          productCode: j.product.productCode,
          name: j.product.name,
          rentalPrice: j.product.rentalPrice,
          cardDiscountPrice: j.product.cardDiscountPrice ?? null,
          contractPeriod: j.product.contractPeriod,
          managementType: j.product.managementType,
          priceMatrix: Array.isArray(j.product.priceMatrix) ? j.product.priceMatrix : [],
          colorOptions: Array.isArray(j.product.colorOptions) ? j.product.colorOptions : [],
        };
        setProductDetail(detail);

        // 운영방식 default — prefill 우선, 그 다음 priceMatrix 첫 mode
        const matrixModes = Array.from(new Set(detail.priceMatrix.map(o => o.mode).filter((m): m is "방문형" | "셀프형" => m === "방문형" || m === "셀프형")));
        if (selectedMode == null && matrixModes.length > 0) {
          setSelectedMode(matrixModes[0]);
        }

        // 색상 default — 이미 선택된 게 colorOptions 안에 없으면 첫 번째로 fallback
        if (detail.colorOptions.length > 0) {
          if (!selectedColor || !detail.colorOptions.includes(selectedColor)) {
            setSelectedColor(detail.colorOptions[0]);
          }
        } else {
          setSelectedColor(null);
        }
      })
      .catch(() => setProductDetail(null))
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [productCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // priceMatrix가 있으면 mode/contractPeriod에 맞는 옵션을 골라 월요금 자동 갱신
  const matrixModes = useMemo(() => {
    if (!productDetail) return [] as Array<"방문형" | "셀프형">;
    return Array.from(new Set(
      productDetail.priceMatrix
        .map(o => o.mode)
        .filter((m): m is "방문형" | "셀프형" => m === "방문형" || m === "셀프형")
    ));
  }, [productDetail]);

  const matrixPeriods = useMemo(() => {
    if (!productDetail) return [] as number[];
    const inMode = productDetail.priceMatrix.filter(o => (o.mode ?? null) === selectedMode);
    return Array.from(new Set(inMode.map(o => o.contractPeriod))).sort((a, b) => a - b);
  }, [productDetail, selectedMode]);

  const currentMatrixOption = useMemo(() => {
    if (!productDetail) return null;
    return productDetail.priceMatrix.find(o => (o.mode ?? null) === selectedMode && o.contractPeriod === contractPeriod) ?? null;
  }, [productDetail, selectedMode, contractPeriod]);

  const canRival = !!(currentMatrixOption?.rivalCompensationPrice && currentMatrixOption.rivalCompensationPrice > 0);

  // 옵션 또는 타사보상 토글 변경 시 monthlyPrice 자동 계산
  // 타사보상 적용 시 = (rentalNow × 0.5 × halfMonths + rentalNow × (cp - halfMonths)) / cp
  // — PriceConfigurator 의 신정책 평균 월가 산정과 동일. rivalCompensationPrice 가 없으면 cardDiscountPrice/rentalPrice 를 rentalNow 로 사용.
  useEffect(() => {
    if (!productDetail) return;
    if (currentMatrixOption) {
      const opt = currentMatrixOption;
      const base = (opt.cardDiscountPrice && opt.cardDiscountPrice > 0) ? opt.cardDiscountPrice : opt.rentalPrice;
      if (rivalApplied) {
        const rentalNow = opt.rivalCompensationPrice && opt.rivalCompensationPrice > 0 ? opt.rivalCompensationPrice : base;
        const halfMonths = opt.rivalCompensationHalfPriceMonths ?? 0;
        const cp = contractPeriod || (opt.contractPeriod ?? 36);
        if (halfMonths > 0 && cp > 0) {
          const total = rentalNow * 0.5 * halfMonths + rentalNow * (cp - halfMonths);
          setMonthlyPrice(Math.round(total / cp));
        } else {
          setMonthlyPrice(rentalNow);
        }
      } else {
        setMonthlyPrice(base);
      }
    } else if (productDetail.priceMatrix.length === 0) {
      setMonthlyPrice((productDetail.cardDiscountPrice && productDetail.cardDiscountPrice > 0) ? productDetail.cardDiscountPrice : productDetail.rentalPrice);
    }
  }, [productDetail, currentMatrixOption, rivalApplied, contractPeriod]);

  // 타사보상 불가능한 옵션이면 자동으로 끔
  useEffect(() => {
    if (rivalApplied && !canRival) setRivalApplied(false);
  }, [canRival, rivalApplied]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isLocked) { setError("잠금 상태 — 본사에 잠금 해제 요청 필요"); return; }
    if (!productCode.trim()) { setError("상품을 선택해주세요."); return; }
    if (!monthlyPrice || monthlyPrice <= 0) { setError("월 렌탈가를 확인해주세요."); return; }
    setBusy(true);
    try {
      const payload = {
        autoAdvance: !isEdit && !!autoAdvance,
        changeReason: isEdit ? (changeReason.trim() || null) : null,
        changeSource: isEdit ? changeSource : "initial_create",
        data: {
          customerName: customerName.trim(),
          residentRegNumber: residentRegNumber.trim(),
          email: email.trim() || null,
          phone: phone.trim(),
          address: address.trim(),
          addressDetail: addressDetail.trim() || null,
          productCode: productCode.trim(),
          productName: productName.trim(),
          managementMode: selectedMode,
          contractPeriod,
          visitInterval: currentMatrixOption?.visitInterval ?? prefill.visitInterval ?? null,
          monthlyPrice,
          isRivalCompensation: rivalApplied,
          isHalfPriceMonths: rivalApplied ? (currentMatrixOption?.rivalCompensationHalfPriceMonths ?? prefill.isHalfPriceMonths ?? null) : null,
          selectedColor,
          giftAmount: prefill.giftAmount,
          giftLabel: prefill.giftLabel ?? null,
          paymentDayType,
          paymentDayValue: paymentDayType === "custom" ? paymentDayValue.trim() : null,
          installSchedule: installSchedule.trim() || null,
          paymentMethod,
          autoDebitBank: paymentMethod === "auto_debit" ? autoDebitBank.trim() : null,
          autoDebitAccount: paymentMethod === "auto_debit" ? autoDebitAccount.trim() : null,
          autoDebitHolder: paymentMethod === "auto_debit" ? autoDebitHolder.trim() : null,
          cardCompany: paymentMethod === "card" ? cardCompany.trim() : null,
          cardNumber: paymentMethod === "card" ? cardNumber.replace(/[\s-]/g, "").trim() : null,
          cardHolder: paymentMethod === "card" ? cardHolder.trim() : null,
          cardExpiry: paymentMethod === "card" ? cardExpiry.replace(/[\s-]/g, "").trim() : null,
          // 신용카드 결제는 자동이체 계좌가 없어 sameAccount 의미 없음 → 항상 별도 사은계좌 사용.
          giftBank: paymentMethod !== "card" && sameAccount ? null : giftBank.trim(),
          giftAccount: paymentMethod !== "card" && sameAccount ? null : giftAccount.trim(),
          giftHolder: sameAccount ? null : (giftHolder.trim() || autoDebitHolder.trim()),
          // 사은품 지급처 (본사/협력점) + 협력점 직접 지급 시 현금 금액. 다른 지급처면 cashAmount null.
          giftPaidBy: giftPaidBy.trim() || null,
          giftCashAmount: giftPaidBy === "협력점" && giftCashAmount.trim()
            ? Math.max(0, Math.floor(Number(giftCashAmount.replace(/[^\d]/g, "")) || 0))
            : null,
          memo: memo.trim() || null,
        },
      };
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(`/api/leads/${leadId}/enrollment`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "저장 실패"); return; }

      // 인증실패/수정요청 상태에서 저장했는데도 자동 전이가 안 잡혔다면 fallback PATCH 로 직접 전이.
      // (API path 가 모두 정상이면 거의 안 타지만, 안전망)
      const wasReturned = prefill.currentLeadStatus === "verify_failed" || prefill.currentLeadStatus === "verify_revise";
      if (wasReturned && !j.advanced) {
        try {
          await fetch(`/api/leads/${leadId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "apply_submitted", memo: "[신청서 수정 후 재제출 — fallback]" }),
          });
        } catch (e) {
          // fallback 자체 실패 — 사용자 흐름은 유지하되 운영자가 알 수 있게 로그
          console.error("[EnrollmentFormModal] fallback status PATCH failed:", e instanceof Error ? e.message : e);
        }
      }

      onSaved(!!j.advanced || wasReturned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl w-[640px] max-w-[95vw] shadow-2xl"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-rk-line flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-rk-ink">📝 가입 신청서 {isEdit ? "수정" : "작성"}</h3>
            <small className="text-[13px] text-rk-muted">
              {prefill.customerName} · {productName || "상품 미선택"} · 월 ₩{monthlyPrice.toLocaleString("ko-KR")}
              {prefill.isRivalCompensation && <span className="ml-1.5 text-rk-orange-deep">🔄 타사보상</span>}
            </small>
          </div>
          <button type="button" onClick={onClose} className="text-rk-muted hover:text-rk-ink text-[20px] bg-transparent border-0 cursor-pointer leading-none">×</button>
        </div>

        {(prefill.currentLeadStatus === "verify_failed" || prefill.currentLeadStatus === "verify_revise") && (
          <div className="bg-rk-tint-red text-rk-sale px-5 py-2.5 text-[13px] flex items-start gap-2 leading-[1.5]">
            <span className="text-[16px] leading-none mt-0.5">📩</span>
            <div className="flex-1">
              <b>본사 {prefill.currentLeadStatus === "verify_failed" ? "인증 실패" : "수정 요청"} — 회신 답변</b>
              {typeof prefill.verifyAttempts === "number" && prefill.verifyAttempts > 0 && (
                <span className="ml-1.5 text-[12px] opacity-70">(재시도 {prefill.verifyAttempts}회)</span>
              )}
              {prefill.verifyLastReason ? (
                <blockquote className="mt-1.5 mb-1.5 pl-3 border-l-2 border-rk-sale bg-white/60 py-1.5 px-2 rounded-r text-rk-ink whitespace-pre-wrap font-normal">
                  {prefill.verifyLastReason}
                </blockquote>
              ) : (
                <div className="mt-1 mb-1 text-rk-faint">본사가 사유를 적지 않았습니다.</div>
              )}
              <div className="mt-1">아래 내용을 수정 후 <b>저장하면 본사 인증 큐에 자동 재투입</b>됩니다.</div>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="bg-rk-tint-blue px-5 py-2.5 border-b border-rk-line text-[13px]">
            <div className="font-semibold text-rk-info mb-1.5">📋 변경 사유 (감사 로그 기록)</div>
            <div className="flex gap-3 flex-wrap mb-1.5">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="changeSource"
                  checked={changeSource === "customer_request"}
                  onChange={() => setChangeSource("customer_request")}
                /> <span>고객 요청</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="changeSource"
                  checked={changeSource === "internal_correction"}
                  onChange={() => setChangeSource("internal_correction")}
                /> <span>내부 보완</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="radio" name="changeSource"
                  checked={changeSource === "hq_revision_response"}
                  onChange={() => setChangeSource("hq_revision_response")}
                /> <span>본사 수정요청 회신</span>
              </label>
            </div>
            <input
              type="text"
              value={changeReason}
              onChange={e => setChangeReason(e.target.value)}
              placeholder="구체적 사유 (선택, 예: 고객이 계좌번호 정정 요청)"
              className="w-full px-2 py-1 border border-rk-line rounded text-[13px] bg-white"
            />
          </div>
        )}

        {isLocked && (
          <div className="bg-rk-tint-orange text-rk-orange-deep px-5 py-2 text-[13px]">
            🔒 이 신청서는 잠금 상태입니다. 본사에 잠금 해제를 요청하세요.
          </div>
        )}

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 상품 선택 — lead에서 prefill 안 됐거나 변경 필요할 때 직접 선택 */}
          <Section title="가입 상품">
            {productCode && !productOpen ? (
              <div className="flex items-center gap-2 border border-rk-line rounded-md px-2.5 py-1.5 bg-rk-soft">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-rk-ink truncate">{productName || productCode}</div>
                  <div className="text-[12px] text-rk-muted font-mono">{productCode} · 의무 {contractPeriod}개월 · 월 ₩{monthlyPrice.toLocaleString("ko-KR")}</div>
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => setProductOpen(true)}
                    className="text-[13px] text-rk-navy hover:text-rk-ink bg-white border border-rk-line rounded px-2 py-0.5 cursor-pointer"
                  >
                    변경
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder={productLoading ? "상품 목록 불러오는 중…" : "상품명 / 코드 / 모델명 검색"}
                  className="w-full border border-rk-line rounded-md px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy"
                  autoFocus={productOpen}
                />
                <div className="max-h-[180px] overflow-y-auto border border-rk-line rounded-md divide-y divide-rk-line">
                  {filteredProducts.length === 0 ? (
                    <div className="px-2.5 py-2 text-[13px] text-rk-muted">
                      {productLoading ? "불러오는 중…" : productList.length === 0 ? "상품 없음" : "검색 결과 없음"}
                    </div>
                  ) : (
                    filteredProducts.map(p => (
                      <button
                        type="button"
                        key={p.productCode}
                        onClick={() => selectProduct(p)}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-rk-soft transition-colors bg-white border-0 cursor-pointer block"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-[14px] text-rk-ink font-medium truncate">
                            {p.name}
                            {p.isFeatured && <span className="ml-1 text-[9px] text-rk-orange-deep">⭐</span>}
                          </div>
                          <div className="text-[13px] text-rk-ink font-medium rk-num shrink-0">
                            ₩{(p.cardDiscountPrice ?? p.rentalPrice).toLocaleString("ko-KR")}/월
                          </div>
                        </div>
                        <div className="text-[12px] text-rk-muted font-mono">
                          {p.productCode} · {p.modelName} · 의무 {p.contractPeriod}개월 · {p.managementType}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {productCode && (
                  <button
                    type="button"
                    onClick={() => { setProductOpen(false); setProductSearch(""); }}
                    className="text-[12px] text-rk-muted hover:text-rk-ink bg-transparent border-0 cursor-pointer"
                  >
                    취소 (현재 선택 유지)
                  </button>
                )}
              </div>
            )}
          </Section>

          {/* 가입 옵션 — 동적 시뮬레이션 박스 */}
          {productCode && (
            <Section title="가입 옵션 (운영방식·약정·타사보상)">
              {detailLoading ? (
                <div className="text-[13px] text-rk-muted">옵션 정보 불러오는 중…</div>
              ) : !productDetail ? (
                <div className="text-[13px] text-rk-muted">옵션 정보를 가져오지 못했습니다.</div>
              ) : (
                <div className="bg-rk-soft rounded-md border border-rk-line p-2.5 space-y-2.5">
                  {/* 운영방식 */}
                  {matrixModes.length > 0 ? (
                    <div>
                      <div className="text-[12px] text-rk-muted uppercase tracking-[.06em] font-semibold mb-1">운영방식</div>
                      <div className="flex flex-wrap gap-1.5">
                        {matrixModes.map(m => (
                          <button
                            type="button"
                            key={m}
                            onClick={() => !isLocked && setSelectedMode(m)}
                            disabled={isLocked}
                            className={
                              "border rounded px-2 py-1 text-[13px] cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed " +
                              (selectedMode === m
                                ? "bg-rk-navy text-white border-rk-navy"
                                : "bg-white border-rk-line text-rk-muted hover:border-rk-navy")
                            }
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12px] text-rk-muted">
                      이 상품엔 옵션 매트릭스가 없습니다. 기본 운영방식: <b>{productDetail.managementType}</b>
                    </div>
                  )}

                  {/* 약정기간 */}
                  {matrixPeriods.length > 0 && (
                    <div>
                      <div className="text-[12px] text-rk-muted uppercase tracking-[.06em] font-semibold mb-1">약정 (의무기간)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {matrixPeriods.map(p => (
                          <button
                            type="button"
                            key={p}
                            onClick={() => !isLocked && setContractPeriod(p)}
                            disabled={isLocked}
                            className={
                              "border rounded px-2 py-1 text-[13px] cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed " +
                              (contractPeriod === p
                                ? "bg-rk-navy text-white border-rk-navy"
                                : "bg-white border-rk-line text-rk-muted hover:border-rk-navy")
                            }
                          >
                            {p}개월
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 타사보상 토글 */}
                  {canRival && (
                    <label className="flex items-center gap-1.5 text-[13px] text-rk-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rivalApplied}
                        onChange={e => !isLocked && setRivalApplied(e.target.checked)}
                        disabled={isLocked}
                        className="accent-rk-orange"
                      />
                      🔄 타사보상 적용 — 월 ₩{(currentMatrixOption?.rivalCompensationPrice ?? 0).toLocaleString("ko-KR")}
                      {currentMatrixOption?.rivalCompensationHalfPriceMonths && currentMatrixOption.rivalCompensationHalfPriceMonths > 0 && (
                        <span className="text-rk-orange-deep">· 첫 {currentMatrixOption.rivalCompensationHalfPriceMonths}개월 반값</span>
                      )}
                    </label>
                  )}

                  {/* 색상/사이즈 변형 — 가격 영향 없음 */}
                  {productDetail.colorOptions.length > 0 && (
                    <div>
                      <div className="text-[12px] text-rk-muted uppercase tracking-[.06em] font-semibold mb-1">색상 / 변형</div>
                      {productDetail.colorOptions.length === 1 ? (
                        <div className="text-[13px] text-rk-ink font-medium">{productDetail.colorOptions[0]}</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {productDetail.colorOptions.map(c => (
                            <button
                              type="button"
                              key={c}
                              onClick={() => !isLocked && setSelectedColor(c)}
                              disabled={isLocked}
                              className={
                                "border rounded px-2 py-1 text-[13px] cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed " +
                                (selectedColor === c
                                  ? "bg-rk-navy text-white border-rk-navy"
                                  : "bg-white border-rk-line text-rk-muted hover:border-rk-navy")
                              }
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 시뮬 박스 — 자동 계산 결과 */}
                  <div className="bg-rk-tint-blue border border-[#D8E4F4] rounded p-2.5 text-[13px]">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-rk-info font-semibold">💰 적용 월 렌탈가</span>
                      <b className="text-[18px] text-rk-info tracking-[-.02em] rk-num">
                        ₩{monthlyPrice.toLocaleString("ko-KR")}<small className="text-[12px] font-medium ml-0.5">/월</small>
                      </b>
                    </div>
                    {/* 카드할인 효과 표시 — 타사보상 적용/미적용 무관하게 항상 보여야 함 */}
                    {currentMatrixOption?.cardDiscountPrice != null && currentMatrixOption.cardDiscountPrice < currentMatrixOption.rentalPrice && (() => {
                      const cardDiscountEffect = currentMatrixOption.rentalPrice - currentMatrixOption.cardDiscountPrice;
                      // 타사보상이면 타사보상가에서 카드할인 차감, 아니면 정상 cardDiscountPrice
                      const baseForCard = rivalApplied && currentMatrixOption.rivalCompensationPrice
                        ? currentMatrixOption.rivalCompensationPrice
                        : currentMatrixOption.rentalPrice;
                      const cardPrice = Math.max(0, baseForCard - cardDiscountEffect);
                      return (
                        <div className="text-rk-sale">
                          💳 신용카드 할인가: 월 ₩{cardPrice.toLocaleString("ko-KR")}
                          <small className="text-rk-muted ml-1">(−₩{cardDiscountEffect.toLocaleString("ko-KR")}/월)</small>
                        </div>
                      );
                    })()}
                    {rivalApplied && (
                      <div className="text-rk-orange-deep">
                        🔄 타사보상가 적용 (정가 ₩{(currentMatrixOption?.rentalPrice ?? 0).toLocaleString("ko-KR")} → ₩{(currentMatrixOption?.rivalCompensationPrice ?? 0).toLocaleString("ko-KR")})
                      </div>
                    )}
                    <div className="text-rk-muted mt-1">
                      의무 {contractPeriod}개월 · 총 ₩{(monthlyPrice * contractPeriod).toLocaleString("ko-KR")} 예상
                    </div>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* 고객 정보 */}
          <Section title="고객 정보">
            <div className="grid grid-cols-2 gap-2">
              <Field label="성함" value={customerName} onChange={setCustomerName} required />
              <Field label="주민번호" value={residentRegNumber} onChange={setRRN} placeholder="791105-2251224" required />
              <Field label="연락처" value={phone} onChange={setPhone} placeholder="01012345678" required />
              <Field label="이메일" value={email} onChange={setEmail} placeholder="you@example.com" />
            </div>
            <div className="grid grid-cols-[2fr_1fr] gap-2 mt-2">
              <Field label="주소" value={address} onChange={setAddress} placeholder="경기 안성시 중앙로419번길 63 (숭인동)" required />
              <Field label="상세 주소" value={addressDetail} onChange={setAddressDetail} placeholder="1층" />
            </div>
          </Section>

          {/* 결제일 — SK매직 정책: 10 / 20 / 25 중 선택 */}
          <Section title="결제일 (SK매직 정책)">
            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_OPTIONS.map(o => (
                <label key={o.key} className={
                  "border rounded-md px-2 py-1.5 text-[13px] cursor-pointer transition-colors text-center " +
                  (paymentDayType === o.key ? "bg-rk-navy text-white border-rk-navy" : "bg-white border-rk-line text-rk-muted hover:border-rk-navy")
                }>
                  <input type="radio" name="payday" value={o.key} checked={paymentDayType === o.key} onChange={() => setPaymentDayType(o.key)} className="hidden" />
                  {o.label}
                </label>
              ))}
            </div>
            {/* 구버전 값(month_end / day_15 / weekly_friday / custom)이 저장된 신청서는 그 값을 그대로 노출. 신규 선택은 위 3가지로 강제. */}
            {LEGACY_PAYMENT_LABEL[paymentDayType] && (
              <div className="mt-2 bg-rk-tint-orange text-rk-orange-deep text-[12px] px-2.5 py-1.5 rounded">
                ⚠ 현재 저장된 값: <b>{LEGACY_PAYMENT_LABEL[paymentDayType]}</b>{paymentDayValue ? ` · "${paymentDayValue}"` : ""} — SK매직 정책 변경으로 신규 신청서는 10/20/25 중 선택해 주세요.
              </div>
            )}
          </Section>

          {/* 설치 일정 */}
          <Section title="설치 일정">
            <Field label="" value={installSchedule} onChange={setInstallSchedule} placeholder="최대한 빠른 일정 / 5월 셋째 주 / 평일 오후 등" />
          </Section>

          {/* 결제수단 — 자동이체 vs 신용카드 */}
          <Section title="결제수단">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("auto_debit")}
                className={"px-3 py-1.5 rounded text-[13px] border cursor-pointer " + (paymentMethod === "auto_debit" ? "bg-rk-navy text-white border-rk-navy" : "bg-white text-rk-text border-rk-line")}
              >
                자동이체
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={"px-3 py-1.5 rounded text-[13px] border cursor-pointer " + (paymentMethod === "card" ? "bg-rk-navy text-white border-rk-navy" : "bg-white text-rk-text border-rk-line")}
              >
                신용카드
              </button>
            </div>
            {paymentMethod === "auto_debit" ? (
              <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
                <Select label="은행" value={autoDebitBank} onChange={setAutoDebitBank} options={KOREAN_BANKS} required />
                <Field label="계좌번호" value={autoDebitAccount} onChange={setAutoDebitAccount} placeholder="92391020289807" required />
                <Field label="예금주" value={autoDebitHolder} onChange={setAutoDebitHolder} required />
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-2">
                <Select label="카드사" value={cardCompany} onChange={setCardCompany} options={KOREAN_CARDS} required />
                <Field label="카드번호" value={cardNumber} onChange={setCardNumber} placeholder="0000-0000-0000-0000" required />
                <Field label="명의자" value={cardHolder} onChange={setCardHolder} required />
                <Field label="유효기간 MM/YY" value={cardExpiry} onChange={setCardExpiry} placeholder="12/27" required />
              </div>
            )}
          </Section>

          {/* 사은품 지급처 */}
          <Section title="사은품 지급처">
            <div className="grid grid-cols-2 gap-1.5">
              {(["본사", "협력점"] as const).map(opt => (
                <label key={opt} className={
                  "border rounded-md px-2 py-1.5 text-[13px] cursor-pointer transition-colors text-center " +
                  (giftPaidBy === opt ? "bg-rk-navy text-white border-rk-navy" : "bg-white border-rk-line text-rk-muted hover:border-rk-navy")
                }>
                  <input type="radio" name="giftPaidBy" value={opt} checked={giftPaidBy === opt} onChange={() => setGiftPaidBy(opt)} className="hidden" />
                  {opt === "본사" ? "🏢 본사 지급" : "🏪 협력점 직접 지급"}
                </label>
              ))}
            </div>
            {giftPaidBy === "협력점" && (
              <div className="mt-2 flex flex-col gap-1">
                <label className="text-[12px] text-rk-muted">협력점이 고객에게 입금할 현금 금액 *</label>
                <div className="flex items-center gap-2">
                  <span className="text-rk-muted text-[14px]">₩</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={giftCashAmount === "0" ? "" : giftCashAmount ? Number(giftCashAmount.replace(/[^\d]/g, "")).toLocaleString("ko-KR") : ""}
                    onChange={e => setGiftCashAmount(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="예: 300,000"
                    className="border border-rk-line rounded px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy rk-num w-[200px]"
                  />
                  <span className="text-[12px] text-rk-muted">원</span>
                </div>
                <small className="text-[11px] text-rk-faint">개통 확인 후 협력점이 고객에게 직접 입금. 본사 지급 사은품과 별개로 운영.</small>
              </div>
            )}
            {giftPaidBy === "본사" && (
              <small className="text-[11px] text-rk-info block mt-2">ⓘ 본사가 사은품(또는 상응 캐시백)을 직접 지급합니다.</small>
            )}
          </Section>

          {/* 사은계좌 */}
          <Section title="사은계좌">
            <label className={"flex items-center gap-1.5 text-[14px] mb-2 " + (paymentMethod === "card" ? "text-rk-faint cursor-not-allowed" : "text-rk-ink cursor-pointer")}>
              <input
                type="checkbox"
                checked={paymentMethod === "card" ? false : sameAccount}
                onChange={e => setSameAccount(e.target.checked)}
                disabled={paymentMethod === "card"}
                className="accent-rk-navy"
              />
              자동이체와 동일한 계좌 사용
              {paymentMethod === "card" && (
                <small className="text-[12px] text-rk-muted ml-1">(신용카드 결제는 계좌가 없으므로 사은계좌 별도 입력)</small>
              )}
            </label>
            {(!sameAccount || paymentMethod === "card") && (
              <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
                <Select label="은행" value={giftBank} onChange={setGiftBank} options={KOREAN_BANKS} />
                <Field label="계좌번호" value={giftAccount} onChange={setGiftAccount} />
                <Field label="예금주" value={giftHolder} onChange={setGiftHolder} />
              </div>
            )}
          </Section>

          {/* 첨부 서류 — 신청서가 이미 저장된 경우(isEdit)만 활성. 신규는 먼저 저장 후 다시 열어 첨부. */}
          {isEdit && (
            <Section title="첨부 서류">
              <DocumentsPanel leadId={leadId} locked={isLocked} />
            </Section>
          )}

          {/* 메모 */}
          <Section title="비고">
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={2}
              className="w-full border border-rk-line rounded-md px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy"
              placeholder="고객 요청사항, 본사 전달 메모 등"
            />
          </Section>
        </div>

        {/* Footer */}
        {error && <div className="bg-rk-tint-red text-rk-sale px-5 py-2 text-[13px]">⚠ {error}</div>}
        <div className="px-5 py-3 border-t border-rk-line flex items-center gap-2">
          <small className="text-[12px] text-rk-faint flex-1">
            저장 시 신청서 정보가 본사 운영 콘솔에 노출됩니다. 주민번호·계좌는 PII로 마스킹 처리되어 다른 점·영업자에게는 가려집니다.
          </small>
          <button type="button" onClick={onClose} disabled={busy} className="bg-rk-soft hover:bg-rk-line text-rk-ink border-0 px-3.5 py-1.5 rounded text-[14px] cursor-pointer disabled:opacity-50">
            취소
          </button>
          <button type="submit" disabled={busy || isLocked} className="bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-4 py-1.5 rounded text-[14px] font-medium cursor-pointer disabled:opacity-50">
            {busy ? "저장 중…" : isEdit ? "저장" : (autoAdvance ? "저장 + 작성 완료 → 본사 제출 대기" : "저장")}
          </button>
        </div>
      </form>
    </div>
  );
}

type DocItem = {
  id: string;
  kind: string;
  label: string | null;
  url: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  id_card: "신분증",
  rival_payment: "타사 납부확인증",
  bank_book: "통장 사본",
  other: "기타",
};
const KIND_OPTIONS = ["id_card", "rival_payment", "bank_book", "other"] as const;

function DocumentsPanel({ leadId, locked }: { leadId: string; locked: boolean }) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("id_card");
  const [label, setLabel] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/leads/${leadId}/documents`, { cache: "no-store" });
      const j = await r.json();
      if (r.ok) setDocs(j.documents ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [leadId]);

  const onUpload = async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      if (label.trim()) fd.append("label", label.trim());
      const r = await fetch(`/api/leads/${leadId}/documents`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "업로드 실패"); return; }
      setDocs(prev => [...prev, j.document]);
      setLabel("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "네트워크 오류");
    } finally { setUploading(false); }
  };

  const onDelete = async (docId: string) => {
    if (!window.confirm("이 문서를 삭제할까요?")) return;
    const r = await fetch(`/api/leads/${leadId}/documents/${docId}`, { method: "DELETE" });
    if (r.ok) setDocs(prev => prev.filter(d => d.id !== docId));
  };

  return (
    <div className="flex flex-col gap-2 text-[13px]">
      <p className="text-[12px] text-rk-muted m-0">
        신분증·타사 납부확인증 등 본사 인증에 필요한 서류. 이미지(PNG/JPG/WebP) 또는 PDF, 최대 12MB.
      </p>
      <div className="flex gap-2 items-end flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-rk-muted text-[12px]">종류</span>
          <select value={kind} onChange={e => setKind(e.target.value)} disabled={locked || uploading} className="border border-rk-line rounded px-2 py-1 bg-white text-[14px]">
            {KIND_OPTIONS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-rk-muted text-[12px]">라벨 (선택)</span>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="예: 주민등록증 앞면" disabled={locked || uploading} className="border border-rk-line rounded px-2 py-1 text-[14px]" />
        </label>
        <label className={"flex items-center gap-1.5 px-3 py-1.5 rounded cursor-pointer text-[13px] font-medium " + (locked || uploading ? "bg-rk-soft text-rk-faint" : "bg-rk-navy hover:bg-rk-navy-deep text-white")}>
          {uploading ? "업로드 중…" : "📎 파일 선택"}
          <input
            type="file"
            accept="image/*,application/pdf"
            disabled={locked || uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) void onUpload(f); e.target.value = ""; }}
            className="hidden"
          />
        </label>
      </div>
      {err && <div className="text-rk-sale text-[12px]">⚠ {err}</div>}

      {loading ? (
        <div className="text-rk-muted">로딩 중…</div>
      ) : docs.length === 0 ? (
        <div className="text-rk-faint text-[12px]">첨부된 서류가 없습니다.</div>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
          {docs.map(d => {
            const isImage = (d.contentType ?? "").startsWith("image/");
            return (
              <li key={d.id} className="flex items-center gap-2.5 bg-white border border-rk-line rounded px-2 py-1.5">
                {isImage ? (
                  <img src={d.url} alt={d.fileName} className="w-[44px] h-[44px] object-cover rounded border border-rk-line" />
                ) : (
                  <div className="w-[44px] h-[44px] rounded bg-rk-tint-red text-rk-sale flex items-center justify-center text-[11px] font-bold">PDF</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-rk-tint-blue text-rk-info">{KIND_LABEL[d.kind] ?? d.kind}</span>
                    {d.label && <b className="text-rk-ink">{d.label}</b>}
                  </div>
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-[12px] text-rk-info no-underline truncate block hover:underline">
                    {d.fileName}
                  </a>
                </div>
                <DocDownloadButton url={d.url} fileName={d.fileName} />
                {!locked && (
                  <button type="button" onClick={() => onDelete(d.id)} className="text-rk-sale text-[12px] bg-transparent border-0 cursor-pointer hover:underline">
                    삭제
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 첨부 파일 강제 다운로드 — fetch → blob → ObjectURL 패턴. */
function DocDownloadButton({ url, fileName }: { url: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const handleClick = async () => {
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank", "noreferrer");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={`${fileName} 다운로드`}
      className="text-[12px] px-2 py-1 rounded bg-rk-soft hover:bg-rk-line-2 text-rk-ink border-0 cursor-pointer disabled:opacity-50 shrink-0"
    >
      {busy ? "…" : "⬇"}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[13px] uppercase tracking-[.06em] text-rk-muted font-semibold mb-1.5">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (s: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      {label && <small className="text-[12px] text-rk-muted block mb-0.5">{label}{required && <span className="text-rk-sale">*</span>}</small>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full border border-rk-line rounded-md px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy"
      />
    </label>
  );
}

function Select({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (s: string) => void; options: string[]; required?: boolean;
}) {
  return (
    <label className="block">
      {label && <small className="text-[12px] text-rk-muted block mb-0.5">{label}{required && <span className="text-rk-sale">*</span>}</small>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full border border-rk-line rounded-md px-2 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy bg-white"
      >
        <option value="">선택</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
