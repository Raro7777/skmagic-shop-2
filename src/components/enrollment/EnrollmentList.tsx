"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { STATUS_PILL, STATUS_LABEL, type LeadStatus } from "@/lib/leadStatus";

// PAYMENT_DAY_LABEL — 인라인 (lib/enrollmentForm 은 prisma 의존성 있어 클라이언트에서 import 불가)
const PAYMENT_DAY_LABEL: Record<string, string> = {
  month_end:     "익월 말일",
  day_10:        "매월 10일",
  day_15:        "매월 15일",
  day_20:        "매월 20일",
  day_25:        "매월 25일",
  weekly_friday: "익주 금요일",
  custom:        "직접 입력",
};

const fmt = (n: number) => n.toLocaleString("ko-KR");

export type EnrollmentItem = {
  id: string;
  leadId: string;
  leadStatus: string;
  leadStatusLabel: string;
  leadCreatedAt: string;
  partnerId: string | null;
  partnerName: string | null;
  sellerCode: string | null;
  sellerName: string | null;
  customerName: string;
  residentRegNumber: string;
  phone: string;
  address: string;
  productCode: string;
  productName: string;
  managementMode: string | null;
  contractPeriod: number;
  monthlyPrice: number;
  isRivalCompensation: boolean;
  selectedColor: string | null;
  paymentDayType: string;
  paymentDayValue: string | null;
  installSchedule: string | null;
  installPreferredDate: string | null;
  memo: string | null;
  autoDebitBank: string;
  autoDebitAccount: string;
  autoDebitHolder: string;
  giftBank: string | null;
  giftAccount: string | null;
  giftHolder: string | null;
  lockedAt: string | null;
  createdByRole: string;
  updatedAt: string;
};

type Scope = "hq" | "partner" | "seller";

export default function EnrollmentList({ scope }: { scope: Scope }) {
  const [items, setItems] = useState<EnrollmentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [partnerFilter, setPartnerFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (scope === "hq" && partnerFilter) params.set("partnerId", partnerFilter);
      const r = await fetch(`/api/enrollments?${params.toString()}`);
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "조회 실패"); return; }
      setItems(j.items);
      setTotal(j.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void load(); }}
          placeholder="고객명 검색"
          className="border border-rk-line rounded px-2.5 py-1 text-[14px] focus:outline-none focus:border-rk-navy"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-rk-line rounded px-2 py-1 text-[14px] focus:outline-none bg-white"
        >
          <option value="">상태 전체</option>
          <option value="form_ready">📝 작성됨 (제출 대기)</option>
          <option value="apply_submitted,verify_pending">⏳ 인증 대기</option>
          <option value="verify_failed,verify_revise,revise_resubmit">🚨 회신 필요</option>
          <option value="install_pending">📦 설치 대기</option>
          <option value="install_done,settle_pending">💳 정산 진행</option>
          <option value="settle_done">✅ 정산 완료</option>
        </select>
        {scope === "hq" && (
          <input
            type="text"
            value={partnerFilter}
            onChange={e => setPartnerFilter(e.target.value)}
            placeholder="협력점 코드 필터"
            className="border border-rk-line rounded px-2.5 py-1 text-[14px] focus:outline-none focus:border-rk-navy"
          />
        )}
        <button
          type="button"
          onClick={() => void load()}
          className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1 rounded text-[14px] cursor-pointer"
        >
          {loading ? "조회 중…" : "필터 적용"}
        </button>
        <span className="ml-auto text-[13px] text-rk-muted">
          총 <b className="text-rk-ink rk-num">{total}</b>건
        </span>
      </div>

      {error && <div className="bg-rk-tint-red text-rk-sale px-3 py-1.5 rounded text-[13px] mb-2">⚠ {error}</div>}

      {items.length === 0 ? (
        <div className="text-center py-8 text-[14px] text-rk-muted">
          {loading ? "로딩 중…" : "신청서가 없습니다."}
        </div>
      ) : (
        <table className="w-full text-[14px] border-collapse">
          <thead>
            <tr>
              {(scope === "hq"
                ? ["", "접수", "고객", "협력점·영업자", "상품 · 옵션", "월요금", "결제일", "상태", ""]
                : scope === "partner"
                  ? ["", "접수", "고객", "영업자", "상품 · 옵션", "월요금", "결제일", "상태", ""]
                  : ["", "접수", "고객", "상품 · 옵션", "월요금", "결제일", "상태", ""]
              ).map((h, i) => (
                <th key={i} className="text-left px-1.5 py-2 font-medium text-rk-muted text-[12px] uppercase tracking-[.04em] border-b border-rk-line">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const isOpen = expanded.has(it.id);
              return (
                <Fragment key={it.id}>
                  <tr
                    onClick={() => toggleExpand(it.id)}
                    className={"hover:bg-rk-soft-2 cursor-pointer " + (it.lockedAt ? "bg-rk-tint-orange/40" : "")}
                  >
                    <td className="px-1.5 py-2.5 border-b border-rk-line-2 w-7">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); toggleExpand(it.id); }}
                        aria-label={isOpen ? "접기" : "펼치기"}
                        className="bg-transparent border-0 cursor-pointer text-[16px] text-rk-info hover:text-rk-navy font-bold"
                      >
                        {isOpen ? "▾" : "▸"}
                      </button>
                    </td>
                    <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num text-[12px] text-rk-muted">
                      {it.leadCreatedAt.slice(5, 16).replace("T", " ")}
                    </td>
                    <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                      <b className="block text-rk-ink">{it.customerName}</b>
                      <small className="text-rk-faint font-mono text-[12px]">{it.phone}</small>
                    </td>
                    {scope === "hq" && (
                      <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                        <span className="text-rk-ink text-[13px]">{it.partnerName ?? "—"}</span>
                        {it.sellerName && <small className="block text-[12px] text-rk-info">{it.sellerName}</small>}
                      </td>
                    )}
                    {scope === "partner" && (
                      <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                        {it.sellerName
                          ? <><b className="text-rk-info text-[13px]">{it.sellerName}</b><small className="block text-[12px] text-rk-muted font-mono">{it.sellerCode}</small></>
                          : <span className="text-rk-muted">—</span>}
                      </td>
                    )}
                    <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                      <span className="text-rk-ink">{it.productName}</span>
                      <small className="block text-rk-faint font-mono text-[12px]">{it.productCode}</small>
                      <div className="mt-0.5 flex gap-1 flex-wrap">
                        {it.managementMode && <span className="text-[12px] px-1 py-px rounded bg-rk-tint-blue text-rk-info">{it.managementMode}</span>}
                        <span className="text-[12px] px-1 py-px rounded bg-rk-soft-2 text-rk-muted">{it.contractPeriod}개월</span>
                        {it.isRivalCompensation && <span className="text-[12px] px-1 py-px rounded bg-rk-tint-orange text-rk-orange-deep">🔄 타사보상</span>}
                        {it.selectedColor && <span className="text-[12px] px-1 py-px rounded bg-rk-soft-2 text-rk-ink">🎨 {it.selectedColor}</span>}
                      </div>
                    </td>
                    <td className="px-1.5 py-2.5 border-b border-rk-line-2 rk-num">
                      <b>₩{fmt(it.monthlyPrice)}</b>
                    </td>
                    <td className="px-1.5 py-2.5 border-b border-rk-line-2 text-[13px]">
                      {PAYMENT_DAY_LABEL[it.paymentDayType] ?? it.paymentDayType}
                      {it.paymentDayValue && <small className="block text-[12px] text-rk-muted">{it.paymentDayValue}</small>}
                    </td>
                    <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                      <span className={"text-[12px] px-1.5 py-px rounded font-medium " + (STATUS_PILL[it.leadStatus as LeadStatus] ?? "")}>
                        {STATUS_LABEL[it.leadStatus as LeadStatus] ?? it.leadStatusLabel}
                      </span>
                      {it.lockedAt && <small className="block text-[12px] text-rk-orange-deep mt-px">🔒 잠금</small>}
                    </td>
                    <td className="px-1.5 py-2.5 border-b border-rk-line-2">
                      <Link
                        href={
                          scope === "hq"
                            ? `/admin/super/verify?leadId=${it.leadId}`
                            : scope === "partner"
                              ? `/admin/franchise/leads?focus=${it.leadId}`
                              : `/admin/seller/leads?focus=${it.leadId}`
                        }
                        onClick={e => e.stopPropagation()}
                        className="text-rk-info text-[13px] no-underline hover:underline"
                      >
                        진입 →
                      </Link>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={scope === "seller" ? 8 : 9} className="bg-rk-soft-2 border-b border-rk-line-2 px-4 py-3">
                        <DetailPanel item={it} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

type HistoryItem = {
  id: string;
  changedAt: string;
  changedById: string | null;
  changedByRole: string;
  reason: string | null;
  changeSource: string;
  changes: Record<string, { from: unknown; to: unknown }>;
};

const SOURCE_LABEL: Record<string, string> = {
  initial_create: "최초 작성",
  customer_request: "고객 요청",
  internal_correction: "내부 보완",
  hq_revision_response: "본사 수정요청 회신",
  system: "시스템 자동",
};

const FIELD_LABEL: Record<string, string> = {
  customerName: "고객명", residentRegNumber: "주민번호", email: "이메일", phone: "연락처",
  address: "주소", addressDetail: "상세주소",
  productCode: "상품코드", productName: "상품명", managementMode: "관리방식",
  contractPeriod: "약정개월", visitInterval: "방문주기",
  monthlyPrice: "월요금", isRivalCompensation: "타사보상", isHalfPriceMonths: "반값할인개월",
  selectedColor: "색상", giftAmount: "사은품금액", giftLabel: "사은품라벨",
  paymentDayType: "결제일타입", paymentDayValue: "결제일값",
  installSchedule: "설치일정메모", installPreferredDate: "설치희망일",
  autoDebitBank: "자동이체은행", autoDebitAccount: "자동이체계좌", autoDebitHolder: "자동이체예금주",
  giftBank: "사은은행", giftAccount: "사은계좌", giftHolder: "사은예금주",
  memo: "기타비고",
};

function HistoryTimeline({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${leadId}/enrollment/history`)
      .then(r => r.json())
      .then(j => { if (!cancelled) setItems(j.items ?? []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [leadId]);

  if (loading) return <div className="text-rk-muted text-[12px]">변경 이력 로드 중…</div>;
  if (!items || items.length === 0) return <div className="text-rk-faint text-[12px]">변경 이력 없음</div>;

  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-2">
      {items.map(h => {
        const changedFields = Object.keys(h.changes ?? {});
        const isCreate = h.changeSource === "initial_create";
        return (
          <li key={h.id} className="bg-white border border-rk-line rounded px-2.5 py-1.5 text-[12px]">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-rk-muted rk-num">{h.changedAt.slice(0, 16).replace("T", " ")}</span>
              <span className={
                "px-1.5 py-px rounded text-[11px] font-medium " +
                (h.changeSource === "customer_request" ? "bg-rk-tint-orange text-rk-orange-deep" :
                 h.changeSource === "hq_revision_response" ? "bg-rk-tint-blue text-rk-info" :
                 isCreate ? "bg-rk-tint-green text-rk-success" :
                 "bg-rk-soft-2 text-rk-muted")
              }>{SOURCE_LABEL[h.changeSource] ?? h.changeSource}</span>
              <span className="text-rk-faint">· {h.changedByRole}</span>
              {h.reason && <span className="text-rk-text">— {h.reason}</span>}
            </div>
            {!isCreate && changedFields.length > 0 && (
              <ul className="m-0 mt-1 pl-3 list-disc text-[11.5px] text-rk-text leading-[1.55]">
                {changedFields.map(f => {
                  const c = h.changes[f];
                  const from = c.from == null || c.from === "" ? "—" : String(c.from);
                  const to = c.to == null || c.to === "" ? "—" : String(c.to);
                  return (
                    <li key={f}>
                      <b className="text-rk-muted">{FIELD_LABEL[f] ?? f}</b>:{" "}
                      <span className="text-rk-faint line-through">{from}</span>
                      {" → "}
                      <span className="text-rk-ink font-medium">{to}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DetailPanel({ item }: { item: EnrollmentItem }) {
  return (
    <div className="grid grid-cols-3 gap-4 text-[13px]">
      <div>
        <h4 className="text-[12px] uppercase tracking-[.06em] text-rk-muted font-semibold mb-1">고객 정보</h4>
        <dl className="grid grid-cols-[80px_1fr] gap-y-0.5">
          <dt className="text-rk-muted">주민번호</dt><dd className="font-mono text-rk-ink">{item.residentRegNumber}</dd>
          <dt className="text-rk-muted">연락처</dt><dd className="font-mono text-rk-ink">{item.phone}</dd>
          <dt className="text-rk-muted">주소</dt><dd className="text-rk-ink">{item.address}</dd>
        </dl>
      </div>
      <div>
        <h4 className="text-[12px] uppercase tracking-[.06em] text-rk-muted font-semibold mb-1">자동이체</h4>
        <dl className="grid grid-cols-[80px_1fr] gap-y-0.5">
          <dt className="text-rk-muted">은행</dt><dd className="text-rk-ink">{item.autoDebitBank}</dd>
          <dt className="text-rk-muted">계좌번호</dt><dd className="font-mono text-rk-ink">{item.autoDebitAccount}</dd>
          <dt className="text-rk-muted">예금주</dt><dd className="text-rk-ink">{item.autoDebitHolder}</dd>
        </dl>
      </div>
      <div>
        <h4 className="text-[12px] uppercase tracking-[.06em] text-rk-muted font-semibold mb-1">사은계좌</h4>
        {item.giftBank ? (
          <dl className="grid grid-cols-[80px_1fr] gap-y-0.5">
            <dt className="text-rk-muted">은행</dt><dd className="text-rk-ink">{item.giftBank}</dd>
            <dt className="text-rk-muted">계좌번호</dt><dd className="font-mono text-rk-ink">{item.giftAccount}</dd>
            <dt className="text-rk-muted">예금주</dt><dd className="text-rk-ink">{item.giftHolder}</dd>
          </dl>
        ) : (
          <p className="text-rk-muted">자동이체 계좌와 동일</p>
        )}
      </div>
      {(item.installSchedule || item.installPreferredDate || item.memo) && (
        <div className="col-span-3 pt-2 border-t border-rk-line-2 text-[13px] flex flex-col gap-1.5">
          {item.installPreferredDate && (
            <div>
              <b className="text-rk-muted">설치 희망일:</b>{" "}
              <span className="text-rk-ink">{item.installPreferredDate}</span>
            </div>
          )}
          {item.installSchedule && (
            <div>
              <b className="text-rk-muted">설치 일정 메모:</b>{" "}
              <span className="text-rk-ink">{item.installSchedule}</span>
            </div>
          )}
          {item.memo && (
            <div>
              <b className="text-rk-muted">기타 비고:</b>{" "}
              <span className="text-rk-ink whitespace-pre-wrap">{item.memo}</span>
            </div>
          )}
        </div>
      )}

      <div className="col-span-3 pt-2 mt-1 border-t border-rk-line-2">
        <h4 className="text-[12px] uppercase tracking-[.06em] text-rk-muted font-semibold mb-1.5">변경 이력 (감사 로그)</h4>
        <HistoryTimeline leadId={item.leadId} />
      </div>
    </div>
  );
}
