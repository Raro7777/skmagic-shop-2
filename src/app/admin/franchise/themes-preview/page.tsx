import { THEME_PRESETS, type ThemePreset } from "@/lib/themes";

export const dynamic = "force-static";

export default function ThemesPreviewPage() {
  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[18px] font-semibold text-rk-ink mb-1">사이트 디자인 시안 (Phase 1)</h1>
        <p className="text-[13px] text-rk-muted m-0">
          협력점 사이트 외형 프리셋 6종 시안입니다. 컬러만 변경되며 레이아웃·기능은 모두 동일합니다.
          각 카드 안의 상단 헤더 / 사은품 배지 / 가격 / CTA 버튼 / 하단 카톡바를 비교해보세요.
          (이 페이지는 시안 검토용 임시 라우트이며, 정식 어드민은 Phase 1 본 구현 시 추가됩니다.)
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {THEME_PRESETS.map(t => (
          <ThemeCard key={t.id} preset={t} />
        ))}
      </div>

      <section className="mt-8 bg-white border border-rk-line rounded-lg p-4 text-[13px] text-rk-text leading-[1.65]">
        <h3 className="text-[14px] font-semibold text-rk-ink mb-2">검토 포인트</h3>
        <ul className="m-0 pl-4 list-disc">
          <li>SK 로고 배지(헤더 좌측 24×24)는 모든 테마에서 SK매직 오렌지 <code className="font-mono text-[12px] bg-rk-soft px-1 rounded">#F26A1F</code> 로 고정 — 본사 정체성 보호</li>
          <li>가격 빨강 <code className="font-mono text-[12px] bg-rk-soft px-1 rounded">--color-rk-sale</code> 도 고정 — 가격 신뢰성 직결</li>
          <li>카톡 노란색 <code className="font-mono text-[12px] bg-rk-soft px-1 rounded">#FEE500</code> 도 카카오 가이드라인상 고정</li>
          <li>본문 텍스트 색 / 라인 색은 모든 테마에서 동일 — 가독성 보장</li>
          <li>가변 토큰: primary(orange 슬롯) / dark(navy 슬롯) / tint / soft-2</li>
        </ul>
      </section>
    </div>
  );
}

function ThemeCard({ preset }: { preset: ThemePreset }) {
  return (
    <article className="bg-rk-soft-2 border border-rk-line rounded-lg p-4">
      <div className="mb-3">
        <h3 className="text-[15px] font-semibold text-rk-ink mb-0.5">{preset.label}</h3>
        <p className="text-[12px] text-rk-muted m-0">{preset.tagline}</p>
        <div className="flex gap-1.5 mt-2">
          {preset.chips.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className="w-7 h-7 rounded border border-rk-line"
                style={{ background: c }}
                title={c}
              />
              <span className="font-mono text-[10px] text-rk-faint">{c}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-rk-faint mt-1.5 m-0 font-mono">
          id: <code>{preset.id}</code>
        </p>
      </div>

      {/* 미니 모바일 프레임 — 실제 컨슈머 사이트 핵심 UI 추출 */}
      <div data-theme={preset.id} className="bg-white border border-rk-line rounded-[18px] overflow-hidden shadow-sm">
        {/* 헤더 */}
        <header className="bg-white border-b border-rk-line px-3 py-2.5 flex items-center gap-2">
          <span className="w-6 h-6 rounded grid place-items-center text-white text-[10px] font-bold shrink-0" style={{ background: "#F26A1F" }}>SK</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-rk-ink leading-tight truncate">홍길동렌탈</div>
            <div className="text-[10px] text-rk-muted truncate">SK매직 인증판매점</div>
          </div>
          <span className="text-[14px] text-rk-ink">🛒</span>
        </header>

        {/* 헤로: 사은품 배지 + 상품명 + 가격 + CTA */}
        <div className="bg-rk-navy text-white px-3 py-3.5">
          <span className="inline-block bg-rk-orange text-white text-[10px] font-semibold px-1.5 py-0.5 rounded mb-1.5">
            오늘 단독 사은품 30만원
          </span>
          <div className="text-[14px] font-semibold leading-tight mb-0.5">SK매직 직수형 정수기</div>
          <div className="text-[10px] opacity-80 mb-2">3년 약정 · 등록비 무료</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] line-through opacity-60 rk-num">39,900원</span>
            <span className="text-[18px] font-bold rk-num">29,900<span className="text-[11px] font-normal">원/월</span></span>
          </div>
        </div>

        {/* 카드 그리드 (2x1) — primary 배지 노출 */}
        <div className="bg-rk-soft-2 px-3 py-3">
          <div className="text-[11px] font-semibold text-rk-ink mb-2">이 협력점 추천</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "공기청정기", price: "32,900", gift: "사은품 20만" },
              { name: "비데",       price: "19,900", gift: "설치비 무료" },
            ].map((p, i) => (
              <div key={i} className="bg-white border border-rk-line rounded-md p-2">
                <div className="bg-rk-tint-orange text-rk-orange-deep text-[9px] font-semibold px-1 py-0.5 rounded inline-block mb-1">
                  {p.gift}
                </div>
                <div className="text-[11px] font-semibold text-rk-ink leading-tight">{p.name}</div>
                <div className="rk-num text-[12px] font-bold text-rk-ink mt-0.5">{p.price}<span className="text-[9px] font-normal text-rk-muted">원/월</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 일부 */}
        <div className="bg-rk-soft px-3 py-2 text-[10px] text-rk-muted border-t border-rk-line">
          고객센터 <span className="rk-num text-rk-ink font-semibold">1600-2434</span> · 평일 09–22시
        </div>

        {/* sticky CTA 흉내 */}
        <div className="bg-white border-t border-rk-line px-2 py-2 flex gap-1.5">
          <button className="flex-1 py-2 rounded-md font-semibold text-[12px] text-rk-ink" style={{ background: "#FEE500" }}>
            💬 카톡상담
          </button>
          <button className="flex-1 py-2 rounded-md font-semibold text-[12px] text-white bg-rk-orange">
            ✍ 상담신청
          </button>
        </div>
      </div>
    </article>
  );
}
