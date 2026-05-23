"use client";

import { useEffect, useState } from "react";

type Conditions = {
  ageMin?: number | null;
  ageMax?: number | null;
  creditGrade?: string | null;
  paymentMethods?: string | null;
  helpCallNumber?: string | null;
  memo?: string | null;
};

/**
 * 상담 중 SK매직 가입조건을 즉시 확인하는 fact sheet 모달.
 * 본사가 /admin/super/hq-settings 에서 편집, 영업자/협력점은 read-only.
 *
 * 본사 콘솔에 노출하려면 editable=true. 클릭 시 같은 모달이 편집 모드로 열림 (별도 페이지로 보낼 수도 있지만 짧은 정보라 인라인).
 */
export default function JoinConditionsButton({
  className,
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Conditions | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/admin/hq-setting/join-conditions", { credentials: "include" })
      .then(r => r.json())
      .then(j => {
        setData(j.joinConditions ?? null);
        setUpdatedAt(j.updatedAt ?? null);
      })
      .catch(() => { /* noop */ })
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "text-[13px] bg-white border border-rk-line text-rk-ink hover:bg-rk-soft px-2.5 py-1 rounded cursor-pointer"
        }
        title="SK매직 가입조건 확인"
      >
        📋 가입조건
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-5 w-full max-w-[480px] shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-3">
              <h4 className="text-[15px] font-semibold m-0">📋 SK매직 가입조건</h4>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-rk-muted hover:text-rk-ink text-[18px] leading-none bg-transparent border-0 cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {loading ? (
              <div className="py-6 text-center text-[13px] text-rk-muted">불러오는 중…</div>
            ) : !data ? (
              <div className="py-6 text-center text-[13px] text-rk-muted">
                본사가 아직 가입조건을 등록하지 않았습니다.
              </div>
            ) : (
              <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
                {(data.ageMin != null || data.ageMax != null) && (
                  <>
                    <dt className="text-rk-muted">연령</dt>
                    <dd className="text-rk-ink m-0">
                      만 {data.ageMin ?? "—"}세 ~ {data.ageMax != null ? `만 ${data.ageMax}세` : "제한 없음"}
                    </dd>
                  </>
                )}
                {data.creditGrade && (
                  <>
                    <dt className="text-rk-muted">신용등급</dt>
                    <dd className="text-rk-ink m-0">{data.creditGrade}</dd>
                  </>
                )}
                {data.paymentMethods && (
                  <>
                    <dt className="text-rk-muted">결제수단</dt>
                    <dd className="text-rk-ink m-0 whitespace-pre-wrap">{data.paymentMethods}</dd>
                  </>
                )}
                {data.helpCallNumber && (
                  <>
                    <dt className="text-rk-muted">헬프콜</dt>
                    <dd className="text-rk-ink m-0 rk-num font-mono">{data.helpCallNumber}</dd>
                  </>
                )}
                {data.memo && (
                  <>
                    <dt className="text-rk-muted">메모</dt>
                    <dd className="text-rk-ink m-0 whitespace-pre-wrap leading-[1.5]">{data.memo}</dd>
                  </>
                )}
              </dl>
            )}

            {updatedAt && (
              <div className="mt-3 text-[11px] text-rk-faint text-right">
                마지막 갱신: {new Date(updatedAt).toLocaleString("ko-KR")}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
