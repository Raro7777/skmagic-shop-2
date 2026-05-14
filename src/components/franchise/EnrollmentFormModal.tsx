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

const PAYMENT_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "month_end",     label: "익월 말일 (기본)" },
  { key: "day_10",        label: "매월 10일" },
  { key: "day_15",        label: "매월 15일" },
  { key: "day_20",        label: "매월 20일" },
  { key: "day_25",        label: "매월 25일" },
  { key: "weekly_friday", label: "익주 금요일" },
  { key: "custom",        label: "직접 입력" },
];

const KOREAN_BANKS = [
  "국민", "신한", "우리", "하나", "농협", "기업", "SC제일", "씨티", "카카오뱅크",
  "케이뱅크", "토스뱅크", "수협", "부산", "대구", "광주", "전북", "경남", "제주", "산업",
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
  autoDebitBank: string;
  autoDebitAccount: string;
  autoDebitHolder: string;
  giftBank: string | null;
  giftAccount: string | null;
  giftHolder: string | null;
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

  const [paymentDayType, setPaymentDayType] = useState(existing?.paymentDayType ?? "month_end");
  const [paymentDayValue, setPaymentDayValue] = useState(existing?.paymentDayValue ?? "");

  const [installSchedule, setInstallSchedule] = useState(existing?.installSchedule ?? "");

  const [autoDebitBank, setAutoDebitBank] = useState(existing?.autoDebitBank ?? "");
  const [autoDebitAccount, setAutoDebitAccount] = useState(existing?.autoDebitAccount ?? "");
  const [autoDebitHolder, setAutoDebitHolder] = useState(existing?.autoDebitHolder ?? prefill.customerName);

  // 사은계좌 — null 이면 자동이체와 동일
  const initialSameAccount = !existing?.giftBank;
  const [sameAccount, setSameAccount] = useState(initialSameAccount);
  const [giftBank, setGiftBank] = useState(existing?.giftBank ?? "");
  const [giftAccount, setGiftAccount] = useState(existing?.giftAccount ?? "");
  const [giftHolder, setGiftHolder] = useState(existing?.giftHolder ?? "");

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
    setMonthlyPrice(p.cardDiscountPrice ?? p.rentalPrice);
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
      const base = opt.cardDiscountPrice ?? opt.rentalPrice;
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
      setMonthlyPrice(productDetail.cardDiscountPrice ?? productDetail.rentalPrice);
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
          autoDebitBank: autoDebitBank.trim(),
          autoDebitAccount: autoDebitAccount.trim(),
          autoDebitHolder: autoDebitHolder.trim(),
          giftBank: sameAccount ? null : giftBank.trim(),
          giftAccount: sameAccount ? null : giftAccount.trim(),
          giftHolder: sameAccount ? null : (giftHolder.trim() || autoDebitHolder.trim()),
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
            body: JSON.stringify({ status: "revise_resubmit", memo: "[신청서 수정 후 재제출 — fallback]" }),
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
          <div className="bg-rk-tint-red text-rk-sale px-5 py-2 text-[13px] flex items-start gap-1.5 leading-[1.5]">
            <span>📩</span>
            <div>
              <b>본사가 수정요청을 보냈습니다 ({prefill.currentLeadStatus === "verify_failed" ? "인증실패" : "수정요청"}).</b>
              <br />아래 내용을 수정 후 <b>저장하면 자동으로 재제출</b>됩니다. (회신상태 → 본사 인증 재진행)
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
                    {currentMatrixOption?.cardDiscountPrice != null && currentMatrixOption.cardDiscountPrice < currentMatrixOption.rentalPrice && !rivalApplied && (
                      <div className="text-rk-orange-deep">
                        카드할인 적용 (정가 ₩{currentMatrixOption.rentalPrice.toLocaleString("ko-KR")} → ₩{currentMatrixOption.cardDiscountPrice.toLocaleString("ko-KR")})
                      </div>
                    )}
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

          {/* 결제일 */}
          <Section title="결제일">
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_OPTIONS.map(o => (
                <label key={o.key} className={
                  "border rounded-md px-2 py-1.5 text-[13px] cursor-pointer transition-colors " +
                  (paymentDayType === o.key ? "bg-rk-navy text-white border-rk-navy" : "bg-white border-rk-line text-rk-muted hover:border-rk-navy")
                }>
                  <input type="radio" name="payday" value={o.key} checked={paymentDayType === o.key} onChange={() => setPaymentDayType(o.key)} className="hidden" />
                  {o.label}
                </label>
              ))}
            </div>
            {paymentDayType === "custom" && (
              <input
                type="text"
                value={paymentDayValue}
                onChange={e => setPaymentDayValue(e.target.value)}
                placeholder="예: 매월 5일, 첫째 주 월요일 등"
                className="mt-2 w-full border border-rk-line rounded-md px-2.5 py-1.5 text-[14px] focus:outline-none focus:border-rk-navy"
              />
            )}
          </Section>

          {/* 설치 일정 */}
          <Section title="설치 일정">
            <Field label="" value={installSchedule} onChange={setInstallSchedule} placeholder="최대한 빠른 일정 / 5월 셋째 주 / 평일 오후 등" />
          </Section>

          {/* 자동이체 계좌 */}
          <Section title="자동이체 계좌">
            <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
              <Select label="은행" value={autoDebitBank} onChange={setAutoDebitBank} options={KOREAN_BANKS} required />
              <Field label="계좌번호" value={autoDebitAccount} onChange={setAutoDebitAccount} placeholder="92391020289807" required />
              <Field label="예금주" value={autoDebitHolder} onChange={setAutoDebitHolder} required />
            </div>
          </Section>

          {/* 사은계좌 */}
          <Section title="사은계좌">
            <label className="flex items-center gap-1.5 text-[14px] text-rk-ink cursor-pointer mb-2">
              <input type="checkbox" checked={sameAccount} onChange={e => setSameAccount(e.target.checked)} className="accent-rk-navy" />
              자동이체와 동일한 계좌 사용
            </label>
            {!sameAccount && (
              <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
                <Select label="은행" value={giftBank} onChange={setGiftBank} options={KOREAN_BANKS} />
                <Field label="계좌번호" value={giftAccount} onChange={setGiftAccount} />
                <Field label="예금주" value={giftHolder} onChange={setGiftHolder} />
              </div>
            )}
          </Section>

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
