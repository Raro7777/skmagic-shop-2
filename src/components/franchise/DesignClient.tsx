"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { THEME_PRESETS, getThemePreset } from "@/lib/themes";
import ThemePresetCard from "./ThemePresetCard";

export default function DesignClient({
  initialTheme,
  initialCanRollback,
  initialPreviousTheme,
  initialRollbackExpiresAt,
}: {
  initialTheme: string;
  initialCanRollback: boolean;
  initialPreviousTheme: string | null;
  initialRollbackExpiresAt: string | null;
}) {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState(initialTheme);
  const [selected, setSelected] = useState(initialTheme);
  const [previousTheme, setPreviousTheme] = useState(initialPreviousTheme);
  const [canRollback, setCanRollback] = useState(initialCanRollback);
  const [rollbackExpiresAt, setRollbackExpiresAt] = useState(initialRollbackExpiresAt);
  const [busy, setBusy] = useState<"apply" | "rollback" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const hasUnsavedChange = selected !== currentTheme;
  const selectedPreset = getThemePreset(selected);

  const apply = async () => {
    setBusy("apply");
    setError(null);
    try {
      const res = await fetch("/api/franchise/design", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "적용 실패");
        return;
      }
      setPreviousTheme(currentTheme);
      setCurrentTheme(data.theme);
      setCanRollback(true);
      setRollbackExpiresAt(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      setSavedAt(new Date());
      router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally {
      setBusy(null);
    }
  };

  const rollback = async () => {
    if (!previousTheme) return;
    if (!confirm(`이전 테마 "${getThemePreset(previousTheme).label}" 로 되돌립니다. 진행할까요?`)) return;
    setBusy("rollback");
    setError(null);
    try {
      const res = await fetch("/api/franchise/design", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rollback" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "롤백 실패");
        return;
      }
      setCurrentTheme(data.theme);
      setSelected(data.theme);
      setPreviousTheme(null);
      setCanRollback(false);
      setRollbackExpiresAt(null);
      setSavedAt(new Date());
      router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-semibold text-rk-ink mb-1">🎨 사이트 디자인</h1>
          <p className="text-[13px] text-rk-muted m-0">
            협력점 사이트의 외형 톤을 골라보세요. 카드를 클릭하면 미리보기가 강조되고, 하단 <b>적용</b> 을 눌러야 실제 사이트(<code className="font-mono text-[12px] bg-rk-soft px-1 rounded">/p/...</code>)에 반영됩니다.
            적용 후 24시간 내 1클릭 롤백이 가능합니다.
          </p>
        </div>
      </header>

      {/* 액션 바 (sticky 느낌) */}
      <div className="bg-white border border-rk-line rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="text-[12px] text-rk-muted">현재 적용</div>
          <div className="text-[14px] font-semibold text-rk-ink">{getThemePreset(currentTheme).label}</div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-[12px] text-rk-muted">선택한 테마</div>
          <div className={"text-[14px] font-semibold " + (hasUnsavedChange ? "text-rk-info" : "text-rk-ink")}>
            {selectedPreset.label}
            {hasUnsavedChange && <span className="ml-1.5 text-[11px] font-normal text-rk-info">· 적용 전 미리보기</span>}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {canRollback && previousTheme && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={rollback}
              className="bg-rk-soft hover:bg-rk-line text-rk-text border border-rk-line px-3 py-2 rounded text-[13px] cursor-pointer disabled:opacity-50"
              title={rollbackExpiresAt ? `${new Date(rollbackExpiresAt).toLocaleString("ko-KR")} 까지 가능` : ""}
            >
              {busy === "rollback" ? "되돌리는 중…" : `↩ 이전 테마로 (${getThemePreset(previousTheme).label})`}
            </button>
          )}
          <button
            type="button"
            disabled={!hasUnsavedChange || busy !== null}
            onClick={apply}
            className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-4 py-2 rounded text-[13px] cursor-pointer font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === "apply" ? "적용 중…" : "적용"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rk-tint-red text-rk-sale text-[13px] px-3 py-2 rounded mb-3">⚠ {error}</div>
      )}
      {savedAt && !error && (
        <div className="bg-rk-tint-green text-rk-success text-[13px] px-3 py-2 rounded mb-3">
          ✓ {savedAt.toLocaleTimeString("ko-KR")} 적용 완료. 컨슈머 사이트에 반영되었습니다.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {THEME_PRESETS.map(t => (
          <ThemePresetCard
            key={t.id}
            preset={t}
            isCurrent={t.id === currentTheme}
            isSelected={t.id === selected}
            onSelect={() => setSelected(t.id)}
          />
        ))}
      </div>

      <section className="mt-6 bg-white border border-rk-line rounded-lg p-4 text-[13px] text-rk-text leading-[1.65]">
        <h3 className="text-[14px] font-semibold text-rk-ink mb-2">참고</h3>
        <ul className="m-0 pl-4 list-disc text-rk-muted">
          <li>SK 로고 배지 / 카톡 노란색 / 가격 빨강은 모든 테마에서 동일하게 유지됩니다 (브랜드·가독성 보호).</li>
          <li>본문 텍스트 색, 라인 색도 고정 — 가독성 보장.</li>
          <li>적용 후 컨슈머 사이트는 즉시 새 톤으로 표시됩니다 (캐시 자동 무효화).</li>
          <li>이전 테마로 되돌리기는 적용 후 24시간 내 1회만 가능합니다.</li>
        </ul>
      </section>
    </div>
  );
}
