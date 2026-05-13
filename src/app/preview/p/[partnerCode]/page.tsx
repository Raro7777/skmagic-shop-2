import { notFound } from "next/navigation";
import { getPartnerSite, type ConsumerProduct } from "@/lib/partnerSite";
import { getPartnerHero, type HeroSlideProduct } from "@/lib/partnerHero";
import ConsultFormClient from "@/components/preview/ConsultFormClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ partnerCode: string }> }) {
  const { partnerCode } = await params;
  const data = await getPartnerSite(partnerCode);
  if (!data) return { title: "Not Found" };
  return { title: `${data.partner.partnerName} · ${data.partner.brandLabel} (PC)` };
}

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default async function PartnerSitePCPreview({
  params,
  searchParams,
}: {
  params: Promise<{ partnerCode: string }>;
  searchParams: Promise<{ hero?: string }>;
}) {
  const { partnerCode } = await params;
  const sp = await searchParams;
  const heroVariant: "default" | "a" | "c" = sp.hero === "a" ? "a" : sp.hero === "c" ? "c" : "default";
  const [data, heroData] = await Promise.all([
    getPartnerSite(partnerCode),
    getPartnerHero(partnerCode),
  ]);
  if (!data) notFound();

  const { partner, picks, rankingsByCategory, categories } = data;
  const { slides, kpi } = heroData;

  // 캠페인 D-N
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysLeft = Math.max(0, Math.ceil((monthEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  // 메인 hero 슬라이드 (첫 신모델 또는 첫 슬라이드)
  const mainSlide = slides.find(s => s.badge === "5월 신모델") ?? slides[0] ?? null;
  const newSlides = slides.filter(s => s.badge === "5월 신모델");
  const giftSlide = slides.find(s => s.badge === "단독 사은품");
  const rivalSlide = slides.find(s => s.badge === "타사보상 강추");
  const rivalSavings = rivalSlide ? rivalSlide.rentalPrice - (rivalSlide.rivalCompensationPrice ?? rivalSlide.rentalPrice) : 0;

  const water = rankingsByCategory["water"] ?? [];
  const air = rankingsByCategory["air"] ?? [];
  const bidet = rankingsByCategory["bidet"] ?? [];

  // 카테고리 카운트 정리 (디자인 기준 4종)
  const catLabels: Array<{ id: string; ic: string; t: string; n: number; type: string }> = [
    { id: "water",    ic: "💧", t: "정수기",     n: categories.find(c => c.slug === "water")?.count ?? 0,    type: "water" },
    { id: "air",      ic: "💨", t: "공기청정기", n: categories.find(c => c.slug === "air")?.count ?? 0,      type: "air" },
    { id: "bidet",    ic: "🚿", t: "비데",       n: categories.find(c => c.slug === "bidet")?.count ?? 0,    type: "bidet" },
    { id: "mat",      ic: "🛏", t: "매트리스",   n: categories.find(c => c.slug === "mattress")?.count ?? 0, type: "mattress" },
  ];

  return (
    <>
      <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{CSS}</style>

      <div className="rk-design page">
        {/* AnnouncementBar */}
        <div className="annbar">
          <div className="container annbar-inner">
            <div>
              <span className="pill">PREVIEW</span>
              전국 무료 설치 · <b style={{ color: "#fff" }}>이번 달 마감 D-{daysLeft}</b>까지 가입 시 추가 사은품
              <span className="dot" />
              매월 SK매직 본사 정책 자동 반영
            </div>
            <div>
              <a href={`tel:${partner.hotlineNumber}`}>📞 {partner.hotlineNumber} · 평일 09:00–18:00</a>
            </div>
          </div>
        </div>

        {/* Header */}
        <header className="header">
          <div className="container header-inner">
            <a href={`/preview/p/${partnerCode}`} className="brand" style={{ textDecoration: "none" }}>
              <div className="brand-mark"><span>SK</span></div>
              <div className="brand-name">
                <b>{partner.partnerName}</b>
                <small>{partner.brandLabel}</small>
              </div>
            </a>
            <nav className="nav">
              {catLabels.map(n => (
                <a key={n.id} href={`#${n.id}`}>
                  <span className="nav-icon">{n.ic}</span>{n.t}
                </a>
              ))}
            </nav>
            <div className="header-cta">
              <a className="icon-btn" href={`/preview/p/${partnerCode}/search`} aria-label="검색">
                <svg className="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              </a>
              <a className="phone-btn" href={`tel:${partner.hotlineNumber}`}>
                <svg className="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>
                {partner.hotlineNumber}
              </a>
            </div>
          </div>
        </header>

        {/* Hero — A: 풀블리드 라이프스타일 */}
        {mainSlide && heroVariant === "a" && (
          <section className="hero-bleed">
            <div className="hero-bleed-bg">
              {mainSlide.heroImage && (
                <img src={mainSlide.heroImage} alt={mainSlide.name} className="bleed-product" />
              )}
            </div>
            <div className="hero-bleed-overlay">
              <div className="container">
                <div className="bleed-eyebrow">
                  <span className="tag">★ NEW</span>
                  <span>5월 신모델 · 마감 D-{daysLeft}</span>
                </div>
                <h1 className="bleed-title">
                  <em>{mainSlide.name.split(" ").slice(0, 2).join(" ")}</em><br />
                  5월 신모델 출시
                </h1>
                <p className="bleed-desc">
                  {partner.partnerName} · SK매직 본사 5월 정책가 그대로 · {partner.region ?? ""} 전국 무료 설치
                </p>
                <div className="bleed-bar">
                  <div className="bleed-price">
                    <div className="l">월 렌탈가</div>
                    <div className="v">₩{fmt(mainSlide.cardDiscountPrice ?? mainSlide.rentalPrice)}<span className="u">/월</span></div>
                  </div>
                  {mainSlide.rivalCompensationPrice != null && (
                    <div className="bleed-price">
                      <div className="l">타사보상가</div>
                      <div className="v alt">₩{fmt(mainSlide.rivalCompensationPrice)}<span className="u">/월</span></div>
                    </div>
                  )}
                  <div className="bleed-ctas">
                    <a className="btn btn-accent" href={`tel:${partner.hotlineNumber}`}>📞 {partner.hotlineNumber}</a>
                    <a className="btn btn-primary" href={`/preview/p/${partnerCode}/products/${mainSlide.productCode}`}>자세히 보기 →</a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Hero — C: 포스터형 합성 디자인 */}
        {mainSlide && heroVariant === "c" && (
          <section className="hero-poster">
            <div className="poster-frame">
              <div className="poster-meta-tl">
                SK MAGIC · ISSUE 05<br />
                <span className="mono">D-{daysLeft} · {partner.region ?? "KOREA"}</span>
              </div>
              <div className="poster-meta-tr">
                <span className="mono">{mainSlide.productCode}</span><br />
                NEW · 2026.05
              </div>
              {mainSlide.heroImage && (
                <img src={mainSlide.heroImage} alt={mainSlide.name} className="poster-product" />
              )}
              <div className="poster-title-wrap">
                <div className="poster-tag">NEW · 5월호</div>
                <h1 className="poster-title">{mainSlide.name.split(" ")[0]}<br /><em>{mainSlide.name.split(" ").slice(1).join(" ") || "신모델"}</em></h1>
                <div className="poster-sub">{partner.partnerName} · SK매직 본사 5월 정책 자동 반영</div>
              </div>
              <div className="poster-sticker sticker-1">
                <div className="l">월 렌탈가</div>
                <div className="v">₩{fmt(mainSlide.cardDiscountPrice ?? mainSlide.rentalPrice)}</div>
              </div>
              {mainSlide.rivalCompensationPrice != null && (
                <div className="poster-sticker sticker-2">
                  <div className="l">타사보상</div>
                  <div className="v">₩{fmt(mainSlide.rivalCompensationPrice)}</div>
                </div>
              )}
              <div className="poster-cta-row">
                <a className="btn btn-accent" href={`tel:${partner.hotlineNumber}`}>📞 {partner.hotlineNumber}</a>
                <a className="btn btn-primary" href={`/preview/p/${partnerCode}/products/${mainSlide.productCode}`}>자세히 보기 →</a>
              </div>
            </div>
          </section>
        )}

        {/* Hero — Default: 카드형 스포트라이트 */}
        {mainSlide && heroVariant === "default" && (
          <section className="hero">
            <div className="container hero-grid">
              <div className="hero-main">
                <div className="hero-eyebrow">
                  <span className="tag">★ NEW</span>
                  <span>5월 신모델</span>
                  <span className="sep" />
                  <span className="countdown">5월 운영 마감 <b>D-{daysLeft}</b></span>
                  <span className="sep" />
                  <span className="meta">매월 SK매직 본사 정책 자동 반영</span>
                </div>
                <h1 className="hero-title">
                  {mainSlide.name}<br />
                  <em>5월 신모델</em> 출시
                </h1>
                <p className="hero-desc">
                  SK매직 본사가 이번 달 출시한 최신 모델. 5월 신정책 가격이 그대로 적용되며,
                  첫 가입자에게는 {partner.partnerName} 단독 사은품도 함께 발송됩니다.
                </p>

                <div className="price-row">
                  <div className="price-card primary">
                    <div className="label">
                      월 렌탈가
                      {mainSlide.cardDiscountPrice != null && (
                        <span className="badge">카드할인 −₩{fmt(mainSlide.rentalPrice - mainSlide.cardDiscountPrice)}</span>
                      )}
                    </div>
                    <div className="value">
                      <span className="won">₩</span>{fmt(mainSlide.cardDiscountPrice ?? mainSlide.rentalPrice)}
                      <span className="unit">/월</span>
                    </div>
                    <div className="note">36개월 무이자 · 카드 할인 적용가</div>
                  </div>
                  {mainSlide.rivalCompensationPrice != null && (
                    <div className="price-card">
                      <div className="label">타사보상가 <span className="badge">월 차액 즉시 할인</span></div>
                      <div className="value" style={{ color: "var(--accent)" }}>
                        <span className="won">₩</span>{fmt(mainSlide.rivalCompensationPrice)}<span className="unit">/월</span>
                      </div>
                      <div className="note">타사 영수증 1장이면 가입 즉시 적용</div>
                    </div>
                  )}
                </div>

                <div className="hero-features">
                  <span className="feature-chip">🚚 전국 무료 설치</span>
                  <span className="feature-chip">💳 36개월 무이자</span>
                  <span className="feature-chip">📄 7일 청약 철회</span>
                  <span className="feature-chip">🛡 SK매직 본사 인증</span>
                  {kpi.rating != null && (
                    <span className="feature-chip star">⭐ {kpi.rating.toFixed(1)} · 리뷰 {kpi.reviewCount}건</span>
                  )}
                </div>

                <div className="hero-ctas">
                  <a className="btn btn-primary" href={`/preview/p/${partnerCode}/products/${mainSlide.productCode}`}>
                    상품 자세히 보기 <span className="arr">→</span>
                  </a>
                  <a className="btn btn-accent" href={`tel:${partner.hotlineNumber}`}>📞 {partner.hotlineNumber} 즉시 상담</a>
                  <a className="btn btn-secondary" href="#consult">상담 신청 폼</a>
                </div>
              </div>

              <aside className="hero-side">
                <div className="product-spotlight">
                  <div className="spotlight-eyebrow"><span className="live" />LIVE · 이번 달 마감 D-{daysLeft}</div>
                  <div className="product-mock">
                    {mainSlide.heroImage ? (
                      <img src={mainSlide.heroImage} alt={mainSlide.name} style={{ maxHeight: 240, maxWidth: "100%", objectFit: "contain" }} />
                    ) : (
                      <div className="water-machine">
                        <span className="badge-new">NEW</span>
                        <div className="body" />
                        <div className="panel">
                          <div className="scr">{mainSlide.name.slice(0, 12)}</div>
                          <div className="scr" style={{ marginTop: 2, opacity: 0.7 }}>5°C ● ICE</div>
                          <div className="dot-row"><span /><span /><span /><span /><span /></div>
                        </div>
                        <div className="nozzle" />
                        <div className="tray" />
                      </div>
                    )}
                  </div>
                  <div className="spotlight-meta">
                    <span className="label">MODEL</span>
                    <span className="name">{mainSlide.name} · {mainSlide.productCode}</span>
                  </div>
                  <div className="spotlight-prices">
                    <div><div className="l">월 렌탈</div><div className="v">₩{fmt(mainSlide.cardDiscountPrice ?? mainSlide.rentalPrice)}</div></div>
                    {mainSlide.rivalCompensationPrice != null ? (
                      <div><div className="l">타사보상</div><div className="v" style={{ color: "#FF8B7A" }}>₩{fmt(mainSlide.rivalCompensationPrice)}</div></div>
                    ) : mainSlide.giftAmount > 0 ? (
                      <div><div className="l">사은품</div><div className="v" style={{ color: "#FF8B7A" }}>₩{fmt(mainSlide.giftAmount)}</div></div>
                    ) : (
                      <div><div className="l">의무 60개월</div><div className="v" style={{ color: "#6EE0FF" }}>−5,000</div></div>
                    )}
                  </div>
                </div>
                <div className="cert-card">
                  <div className="shield">🛡</div>
                  <div className="t">
                    <b>SK매직 본사 공식 인증판매점</b>
                    <span>정책·수수료 본사 검증 완료 · 본 매장에서 가입 시 본사가 직접 인증</span>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}

        {/* Stats */}
        <section className="stats">
          <div className="container">
            <div className="stats-grid">
              <StatBox ic="📅" label="운영 일수"   value={String(kpi.daysOperated)} unit="일" note="본사 인증 후 누적" />
              <StatBox ic="📞" label="이번 달 상담" value={String(kpi.leadsThisMonth)} unit="건" note="이번 달 신규 lead" />
              <StatBox ic="⏱"  label="평균 응답"   value={kpi.avgResponseMinutes != null ? String(kpi.avgResponseMinutes) : "—"} unit="분" note="신규 → 상담 시작" />
              <StatBox ic="⭐" label="고객 별점"   value={kpi.rating != null ? kpi.rating.toFixed(1) : "—"} unit="/ 5" note={kpi.reviewCount > 0 ? `리뷰 ${kpi.reviewCount}건` : "리뷰 모집 중"} />
            </div>
          </div>
        </section>

        {/* New Models */}
        {newSlides.length > 0 && (
          <section className="section alt">
            <div className="container">
              <div className="section-head">
                <div>
                  <div className="section-eyebrow"><span className="l" />NEW</div>
                  <h2 className="section-title">이번 달 <em>신모델 {newSlides.length}종</em></h2>
                  <div className="section-sub">SK매직 본사 5월 출시 · 본사 정책가 그대로 적용</div>
                </div>
                <a className="section-more" href={`/preview/p/${partnerCode}/products`}>전체 신모델 보기 →</a>
              </div>
              <div className="new-grid">
                {newSlides.slice(0, 2).map((p, i) => (
                  <a key={p.productCode} className="new-card" href={`/preview/p/${partnerCode}/products/${p.productCode}`}>
                    <div className={"visual " + (i === 0 ? "dark" : "")}>
                      <span className="tag-new">NEW</span>
                      {p.heroImage ? (
                        <img src={p.heroImage} alt={p.name} style={{ width: "85%", maxHeight: "85%", objectFit: "contain" }} />
                      ) : (
                        <div className="pv-water" style={i === 0 ? { transform: "scale(1.15)" } : {}} />
                      )}
                    </div>
                    <div className="info">
                      <div className="cat">NEW · 5월 신출시</div>
                      <h3>{p.name}</h3>
                      <div className="sku">{p.productCode}</div>
                      <div className="prices">
                        <div className="p"><div className="l">월 렌탈가</div><div className="v">₩{fmt(p.cardDiscountPrice ?? p.rentalPrice)}</div></div>
                        {p.rivalCompensationPrice != null && (
                          <div className="p alt"><div className="l">타사보상가</div><div className="v">₩{fmt(p.rivalCompensationPrice)}</div></div>
                        )}
                      </div>
                      <div className="more">상품 자세히 보기 →</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Campaigns */}
        {(rivalSlide || giftSlide) && (
          <section className="section tight">
            <div className="container">
              <div className="camp-grid">
                {rivalSlide && (
                  <div className="camp boomerang">
                    <span className="deadline">이번 달 마감 <b>D-{daysLeft}</b></span>
                    <div className="icbig">🔄</div>
                    <div className="eye">5월 타사보상 캠페인</div>
                    <h3>기존 가전 쓰시던 분, 월 최대 <b>₩{fmt(rivalSavings)}</b> 추가 할인</h3>
                    <p>타사 정수기·공청·비데 영수증 1장이면 가입 즉시 적용. 카드할인은 별개로 추가. 대상 모델 다수.</p>
                    <a href={`/preview/p/${partnerCode}/products`} className="a">타사보상 대상 보기 →</a>
                  </div>
                )}
                {giftSlide && (
                  <div className="camp gift">
                    <div className="icbig">🎁</div>
                    <div className="eye">{partner.partnerName} 단독</div>
                    <h3>{giftSlide.giftLabel ?? "사은품"} — <b>₩{fmt(giftSlide.giftAmount)} 상당 무료</b></h3>
                    <p>가입 후 5일 내 발송 · 가구당 1개 한정 · 본사 표준 상품 외 협력점 자체 부담.</p>
                    <a href={`/preview/p/${partnerCode}/products/${giftSlide.productCode}`} className="a">사은품 안내 →</a>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Categories */}
        <section className="section tight" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="cat-grid">
              {catLabels.map(c => (
                <a key={c.id} href={`/preview/p/${partnerCode}/products?category=${c.id === "mat" ? "mattress" : c.id}`} className="cat-card">
                  <div className="ic">{c.ic}</div>
                  <div className="t"><b>{c.t}</b><span>{c.n}개 상품</span></div>
                  <span className="arr">→</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Product Rows */}
        {water.length > 0 && (
          <ProductRow id="water" ic="💧" title="정수기 추천" sub="이번 달 본사 5월 신정책 적용" more="전체 정수기" items={water.slice(0, 4)} type="water" partnerCode={partnerCode} />
        )}
        {air.length > 0 && (
          <ProductRow id="air" ic="💨" title="공기청정기 추천" sub="6개월 반값할인 운영 중" more="전체 공기청정기" items={air.slice(0, 4)} type="air" partnerCode={partnerCode} />
        )}
        {bidet.length > 0 && (
          <ProductRow id="bidet" ic="🚿" title="비데 추천" sub="신모델 올클린케어 6개월 반값" more="전체 비데" items={bidet.slice(0, 4)} type="bidet" partnerCode={partnerCode} />
        )}

        {/* Store recommendations (picks) */}
        {picks.length > 0 && (
          <section className="section" style={{ paddingTop: 56, paddingBottom: 56 }}>
            <div className="container">
              <div className="section-head">
                <div>
                  <div className="section-eyebrow"><span className="l" />{partner.partnerName} 단독</div>
                  <h2 className="section-title">⭐ {partner.partnerName} <em>추천</em></h2>
                  <div className="section-sub">단독 사은품 강화 상품</div>
                </div>
                <a className="section-more" href={`/preview/p/${partnerCode}/products`}>전체 상품 →</a>
              </div>
              <div className="prod-grid">
                {picks.slice(0, 4).map(p => (
                  <ProductCard key={p.productCode} p={p} type={categoryToVisualType(p.category)} pick partnerCode={partnerCode} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Trust */}
        <section className="section alt" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div className="container">
            <div className="trust-grid">
              <div className="trust-card a">
                <div className="ic">🏢</div>
                <h3>SK매직 인증판매점</h3>
                <p>{partner.partnerName}은 SK매직 본사 공식 인증을 받은 분양점입니다. 본사 정책·수수료가 모든 모델에 일관되게 적용됩니다.</p>
              </div>
              <div className="trust-card b">
                <div className="ic">🚚</div>
                <h3>전국 무료 설치</h3>
                <p>전국 어디든 본사 인증 설치 기사가 직접 방문. 설치비 별도 부담 없음. 설치 후 7일 청약 철회 가능.</p>
              </div>
              <div className="trust-card c">
                <div className="ic">💰</div>
                <h3>고객 단독 혜택</h3>
                <p>본 매장 가입 시 단독 사은품 + 카드할인 별도 적용. 타사보상 시 추가 가격 혜택.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Consult */}
        <section className="consult-band" id="consult">
          <div className="container consult-grid">
            <div>
              <h2>상담 신청 <em>1초</em> 만에</h2>
              <p>이름과 전화번호만 남겨도 본사 인증 상담사가 30분 안에 연락드립니다. 상품·가격·설치 일정 모두 한 번에 안내.</p>
              <div className="consult-meta">
                <div className="m">
                  <div className="l">평균 응답</div>
                  <div className="v">{kpi.avgResponseMinutes != null ? `${kpi.avgResponseMinutes}분` : "—"}</div>
                </div>
                <div className="m">
                  <div className="l">이번 달 상담</div>
                  <div className="v">{kpi.leadsThisMonth}건</div>
                </div>
                <div className="m">
                  <div className="l">고객 별점</div>
                  <div className="v">{kpi.rating != null ? `${kpi.rating.toFixed(1)} / 5` : "—"}</div>
                </div>
              </div>
            </div>
            <ConsultFormClient partnerCode={partnerCode} partnerName={partner.partnerName} />
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <div className="container">
            <div className="footer-grid">
              <div className="footer-brand">
                <b>{partner.partnerName}</b>
                <p>
                  {partner.brandLabel}<br />
                  {partner.region}<br />
                  {partner.address}<br /><br />
                  본사 정책가 자동 반영 · 본사 인증 설치 · 본사 검증 수수료
                </p>
              </div>
              <div>
                <h4>고객센터</h4>
                <ul>
                  <li>📞 <a href={`tel:${partner.hotlineNumber}`}>{partner.hotlineNumber}</a></li>
                  <li>평일 09:00 - 18:00</li>
                  <li>점심시간 12:00 - 13:00</li>
                  <li>주말·공휴일 휴무</li>
                </ul>
              </div>
              <div>
                <h4>사업자 정보</h4>
                <ul>
                  <li>대표: {partner.ownerName ?? "—"}</li>
                  <li>사업자: {partner.businessNumber ?? "—"}</li>
                  <li>통신판매: {partner.commerceNumber ?? "—"}</li>
                </ul>
              </div>
              <div>
                <h4>바로가기</h4>
                <ul>
                  <li><a href={`/preview/p/${partnerCode}/products`}>전체 상품</a></li>
                  <li><a href={`/preview/p/${partnerCode}/reviews`}>고객 리뷰</a></li>
                  <li><a href={`/preview/p/${partnerCode}/search`}>상품 검색</a></li>
                  <li><a href="#consult">상담 신청</a></li>
                </ul>
              </div>
            </div>
            <div className="footer-bottom">
              <div>© 2026 {partner.partnerName} · SK매직 인증판매점</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>/preview/p/{partnerCode}</div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

function StatBox({ ic, label, value, unit, note }: { ic: string; label: string; value: string; unit: string; note: string }) {
  return (
    <div className="stat">
      <div className="ic-wrap">{ic}</div>
      <div className="label">{label}</div>
      <div className="value">{value}<span className="u">{unit}</span></div>
      <div className="note">{note}</div>
    </div>
  );
}

const fmt2 = (n: number) => n.toLocaleString("ko-KR");

function ProductCard({
  p, type, pick, partnerCode,
}: { p: ConsumerProduct; type: string; pick?: boolean; partnerCode: string }) {
  const card = p.cardDiscountPrice != null ? p.rentalPrice - p.cardDiscountPrice : 0;
  return (
    <a className="prod-card" href={`/preview/p/${partnerCode}/products/${p.productCode}`}>
      <div className={"visual " + type}>
        <div className="badges">
          {(pick || p.isFeatured) && <span className="badge-pick">⭐ 본 매장 추천</span>}
          {p.giftLabel && p.giftAmount > 0 && <span className="badge-gift">🎁 {p.giftLabel}</span>}
        </div>
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.name} style={{ width: "60%", maxHeight: "65%", objectFit: "contain" }} />
        ) : (
          <div className={"pv-" + (type === "water" ? "water" : type === "air" ? "air" : type === "bidet" ? "bidet" : "mat")} />
        )}
      </div>
      <div className="info">
        <h4>{p.name}</h4>
        <div className="sku">{p.productCode}</div>
        <div className="price">월 렌탈가 <b>₩{fmt2(p.cardDiscountPrice ?? p.rentalPrice)}</b></div>
        {card > 0 && <div className="discount">카드 −{fmt2(card)}원/월</div>}
      </div>
    </a>
  );
}

function ProductRow({
  id, ic, title, sub, more, items, type, partnerCode,
}: { id: string; ic: string; title: string; sub: string; more: string; items: ConsumerProduct[]; type: string; partnerCode: string }) {
  return (
    <section className="section" id={id} style={{ paddingTop: 56, paddingBottom: 24 }}>
      <div className="container">
        <div className="section-head">
          <div>
            <h2 className="section-title">{ic} {title}</h2>
            {sub && <div className="section-sub">{sub}</div>}
          </div>
          <a className="section-more" href={`/preview/p/${partnerCode}/products?category=${id}`}>{more} →</a>
        </div>
        <div className="prod-grid">
          {items.map(p => <ProductCard key={p.productCode} p={p} type={type} partnerCode={partnerCode} />)}
        </div>
      </div>
    </section>
  );
}

function categoryToVisualType(cat: string): string {
  if (cat === "water") return "water";
  if (cat === "air") return "air";
  if (cat === "bidet") return "bidet";
  if (cat === "mattress") return "mattress";
  return "water";
}

const CSS = `
.rk-design {
  --bg: #F6F4EE; --paper: #FFFFFF; --ink: #15171C; --ink-2: #2E323C; --muted: #6B6F7B;
  --line: #E6E2D6; --line-strong: #D6D1C0;
  --primary: #E5341F; --primary-deep: #B6230F; --primary-soft: #FCE9E4;
  --accent: #0F3D2E; --accent-soft: #E4EEE7;
  --gold: #B68A2E; --gold-soft: #F4ECD3;
  --shadow-sm: 0 1px 0 rgba(20,20,20,0.04), 0 1px 2px rgba(20,20,20,0.04);
  --shadow-md: 0 1px 0 rgba(20,20,20,0.04), 0 8px 24px -8px rgba(20,20,20,0.10);
  --shadow-lg: 0 1px 0 rgba(20,20,20,0.04), 0 24px 48px -16px rgba(20,20,20,0.18);
  --radius-sm: 6px; --radius: 12px; --radius-lg: 18px;
  font-family: 'Pretendard', system-ui, -apple-system, sans-serif;
  background: var(--bg); color: var(--ink);
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'ss03', 'tnum';
  letter-spacing: -0.01em;
}
.rk-design *, .rk-design *::before, .rk-design *::after { box-sizing: border-box; }
.rk-design img { display: block; max-width: 100%; }
.rk-design a { color: inherit; text-decoration: none; }
.rk-design button { font-family: inherit; cursor: pointer; }
.rk-design ::selection { background: var(--primary); color: #fff; }
.rk-design .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
.rk-design.page { width: 100%; min-width: 1280px; }
.rk-design .container { max-width: 1320px; margin: 0 auto; padding: 0 32px; }

.rk-design .annbar { background: var(--ink); color: #EBE7DA; font-size: 12.5px; letter-spacing: 0.02em; }
.rk-design .annbar-inner { display: flex; align-items: center; justify-content: space-between; height: 36px; }
.rk-design .annbar .pill { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); padding: 3px 8px; border-radius: 999px; font-size: 10.5px; margin-right: 12px; font-weight: 600; color: #F6F4EE; }
.rk-design .annbar .dot { width: 5px; height: 5px; border-radius: 50%; background: #E5341F; display: inline-block; margin: 0 10px; vertical-align: middle; box-shadow: 0 0 0 4px rgba(229,52,31,0.18); }
.rk-design .annbar a { color: #FFE7DC; font-weight: 600; }

.rk-design .header { background: var(--paper); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 50; }
.rk-design .header-inner { display: grid; grid-template-columns: auto 1fr auto; align-items: center; height: 76px; gap: 40px; }
.rk-design .brand { display: flex; align-items: center; gap: 14px; }
.rk-design .brand-mark { width: 44px; height: 44px; background: var(--ink); color: #fff; border-radius: 10px; display: grid; place-items: center; font-weight: 800; font-size: 18px; letter-spacing: -0.02em; position: relative; overflow: hidden; }
.rk-design .brand-mark::after { content: ''; position: absolute; inset: auto -4px -10px auto; width: 22px; height: 22px; background: var(--primary); border-radius: 50%; }
.rk-design .brand-mark span { position: relative; z-index: 1; }
.rk-design .brand-name { display: flex; flex-direction: column; line-height: 1.1; }
.rk-design .brand-name b { font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
.rk-design .brand-name small { font-size: 11.5px; color: var(--muted); margin-top: 3px; }
.rk-design .nav { display: flex; gap: 4px; align-items: center; }
.rk-design .nav a { padding: 10px 16px; border-radius: 8px; font-size: 15px; font-weight: 600; color: var(--ink-2); display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; transition: background .15s; }
.rk-design .nav a:hover { background: var(--bg); }
.rk-design .nav-icon { font-size: 17px; }
.rk-design .header-cta { display: flex; align-items: center; gap: 10px; }
.rk-design .icon-btn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--line); background: var(--paper); display: grid; place-items: center; color: var(--ink-2); }
.rk-design .icon-btn:hover { background: var(--bg); }
.rk-design .phone-btn { display: inline-flex; align-items: center; gap: 10px; height: 40px; padding: 0 16px 0 14px; background: var(--primary); color: #fff; border: 0; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 8px 16px -6px rgba(229,52,31,0.45); }
.rk-design .phone-btn:hover { background: var(--primary-deep); }

.rk-design .hero { background: radial-gradient(900px 380px at 88% -8%, rgba(229,52,31,0.10), transparent 60%), radial-gradient(680px 280px at 6% 110%, rgba(15,61,46,0.08), transparent 60%), var(--bg); border-bottom: 1px solid var(--line); padding: 40px 0 56px; }
.rk-design .hero-grid { display: grid; grid-template-columns: 1.55fr 1fr; gap: 28px; align-items: stretch; }
.rk-design .hero-main { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 36px 40px 32px; box-shadow: var(--shadow-md); display: flex; flex-direction: column; position: relative; overflow: hidden; }
.rk-design .hero-main::before { content: ''; position: absolute; right: -120px; top: -120px; width: 360px; height: 360px; border-radius: 50%; background: radial-gradient(circle, rgba(229,52,31,0.06), transparent 70%); }
.rk-design .hero-eyebrow { display: flex; gap: 10px; align-items: center; flex-wrap: nowrap; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--primary); margin-bottom: 18px; white-space: nowrap; }
.rk-design .hero-eyebrow > * { white-space: nowrap; flex-shrink: 0; }
.rk-design .hero-eyebrow .tag { background: var(--primary); color: #fff; padding: 4px 9px; border-radius: 4px; font-size: 11px; letter-spacing: 0.08em; }
.rk-design .hero-eyebrow .sep { width: 1px; height: 12px; background: var(--line-strong); }
.rk-design .hero-eyebrow .countdown { color: var(--ink); font-weight: 700; letter-spacing: 0.02em; text-transform: none; }
.rk-design .hero-eyebrow .countdown b { color: var(--primary); }
.rk-design .hero-eyebrow .meta { color: var(--muted); font-weight: 500; letter-spacing: 0.02em; text-transform: none; }

.rk-design .hero-title { font-size: 56px; line-height: 1.05; letter-spacing: -0.035em; font-weight: 800; margin: 0 0 18px; color: var(--ink); }
.rk-design .hero-title em { font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400; color: var(--primary); letter-spacing: -0.02em; }
.rk-design .hero-desc { font-size: 16px; line-height: 1.6; color: var(--ink-2); max-width: 560px; margin: 0 0 28px; }

.rk-design .price-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.rk-design .price-card { border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; background: #FBFAF5; }
.rk-design .price-card .label { font-size: 12px; color: var(--muted); font-weight: 600; letter-spacing: 0.02em; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; white-space: nowrap; }
.rk-design .price-card .label .badge { background: var(--accent-soft); color: var(--accent); padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
.rk-design .price-card .value { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; display: flex; align-items: baseline; gap: 6px; }
.rk-design .price-card .value .won { font-size: 18px; font-weight: 700; }
.rk-design .price-card .value .unit { font-size: 13px; color: var(--muted); font-weight: 500; letter-spacing: 0; margin-left: 4px; }
.rk-design .price-card.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
.rk-design .price-card.primary .label { color: rgba(255,255,255,0.6); }
.rk-design .price-card.primary .label .badge { background: var(--primary); color: #fff; }
.rk-design .price-card .note { font-size: 12px; color: var(--muted); margin-top: 4px; }
.rk-design .price-card.primary .note { color: rgba(255,255,255,0.55); }

.rk-design .hero-features { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 28px; }
.rk-design .feature-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--bg); border: 1px solid var(--line); padding: 7px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); white-space: nowrap; }
.rk-design .feature-chip.star { background: #FFF8E5; border-color: #F4E4B0; color: #5C4914; }

.rk-design .hero-ctas { display: flex; gap: 10px; align-items: center; margin-top: auto; flex-wrap: wrap; }
.rk-design .btn { height: 56px; padding: 0 22px; border-radius: 12px; font-size: 14.5px; font-weight: 700; border: 0; display: inline-flex; align-items: center; gap: 10px; white-space: nowrap; flex-shrink: 0; transition: transform .1s, background .15s; }
.rk-design .btn:active { transform: translateY(1px); }
.rk-design .btn-primary { background: var(--ink); color: #fff; box-shadow: 0 8px 24px -10px rgba(0,0,0,.45); }
.rk-design .btn-primary:hover { background: #000; }
.rk-design .btn-secondary { background: var(--paper); color: var(--ink); border: 1px solid var(--line-strong); }
.rk-design .btn-secondary:hover { background: var(--bg); }
.rk-design .btn-accent { background: var(--primary); color: #fff; box-shadow: 0 8px 24px -10px rgba(229,52,31,.55); }
.rk-design .btn-accent:hover { background: var(--primary-deep); }
.rk-design .btn .arr { font-size: 18px; margin-left: 2px; }

.rk-design .hero-side { display: flex; flex-direction: column; gap: 16px; }
.rk-design .product-spotlight { background: linear-gradient(180deg, #1a1d24 0%, #0c0d11 100%); color: #fff; border-radius: var(--radius-lg); padding: 28px; position: relative; overflow: hidden; flex: 1; display: flex; flex-direction: column; min-height: 360px; }
.rk-design .product-spotlight::after { content: ''; position: absolute; right: -60px; bottom: -60px; width: 260px; height: 260px; border-radius: 50%; background: radial-gradient(circle, rgba(229,52,31,0.30), transparent 65%); pointer-events: none; }
.rk-design .spotlight-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.55); margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
.rk-design .spotlight-eyebrow .live { width: 6px; height: 6px; border-radius: 50%; background: #58D08C; box-shadow: 0 0 0 4px rgba(88,208,140,0.20); }
.rk-design .product-mock { flex: 1; display: grid; place-items: center; position: relative; margin: 6px 0 18px; }
.rk-design .water-machine { width: 130px; height: 200px; position: relative; }
.rk-design .water-machine .body { position: absolute; inset: 0; background: linear-gradient(180deg, #E8E5DC 0%, #C9C4B4 100%); border-radius: 14px 14px 18px 18px; box-shadow: inset 0 -8px 0 rgba(0,0,0,0.06), 0 20px 40px -20px rgba(0,0,0,0.5); }
.rk-design .water-machine .panel { position: absolute; top: 16px; left: 14px; right: 14px; height: 70px; background: linear-gradient(180deg, #15171C 0%, #2A2D36 100%); border-radius: 8px; display: flex; flex-direction: column; padding: 8px 10px; }
.rk-design .water-machine .panel .dot-row { display: flex; gap: 5px; margin-top: 6px; }
.rk-design .water-machine .panel .dot-row span { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.18); }
.rk-design .water-machine .panel .dot-row span:first-child { background: var(--primary); box-shadow: 0 0 6px var(--primary); }
.rk-design .water-machine .panel .scr { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #6EE0FF; letter-spacing: 0.04em; }
.rk-design .water-machine .nozzle { position: absolute; left: 50%; top: 100px; transform: translateX(-50%); width: 30px; height: 12px; background: #5B5346; border-radius: 0 0 6px 6px; }
.rk-design .water-machine .nozzle::after { content: ''; position: absolute; left: 50%; top: 12px; transform: translateX(-50%); width: 4px; height: 20px; background: linear-gradient(180deg, rgba(110,224,255,0.8), rgba(110,224,255,0)); border-radius: 4px; }
.rk-design .water-machine .tray { position: absolute; left: 14px; right: 14px; bottom: 12px; height: 40px; background: linear-gradient(180deg, #2A2D36 0%, #15171C 100%); border-radius: 6px; }
.rk-design .water-machine .badge-new { position: absolute; top: -6px; right: -10px; background: var(--primary); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; padding: 4px 8px; border-radius: 4px; transform: rotate(8deg); box-shadow: 0 4px 12px rgba(229,52,31,0.5); }
.rk-design .spotlight-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; position: relative; z-index: 1; }
.rk-design .spotlight-meta .label { font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 600; letter-spacing: 0.04em; }
.rk-design .spotlight-meta .name { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk-design .spotlight-prices { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.10); border-radius: 8px; overflow: hidden; position: relative; z-index: 1; }
.rk-design .spotlight-prices > div { background: #1a1d24; padding: 10px 14px; }
.rk-design .spotlight-prices .l { font-size: 10.5px; color: rgba(255,255,255,0.5); letter-spacing: 0.04em; }
.rk-design .spotlight-prices .v { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; margin-top: 2px; }

.rk-design .cert-card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px 20px; display: flex; gap: 14px; align-items: center; box-shadow: var(--shadow-sm); }
.rk-design .cert-card .shield { width: 44px; height: 44px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; font-size: 22px; flex-shrink: 0; }
.rk-design .cert-card .t b { font-size: 14px; font-weight: 800; letter-spacing: -0.01em; display: block; }
.rk-design .cert-card .t span { font-size: 12px; color: var(--muted); margin-top: 3px; display: block; line-height: 1.5; }

.rk-design .stats { padding: 28px 0; border-bottom: 1px solid var(--line); background: var(--paper); }
.rk-design .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.rk-design .stat { background: var(--paper); padding: 22px 26px; display: flex; flex-direction: column; gap: 6px; }
.rk-design .stat .ic-wrap { width: 36px; height: 36px; border-radius: 10px; background: var(--bg); display: grid; place-items: center; font-size: 18px; margin-bottom: 6px; }
.rk-design .stat .label { font-size: 12px; color: var(--muted); font-weight: 600; letter-spacing: 0.02em; }
.rk-design .stat .value { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; display: flex; align-items: baseline; gap: 4px; }
.rk-design .stat .value .u { font-size: 14px; color: var(--muted); font-weight: 600; letter-spacing: 0; }
.rk-design .stat .note { font-size: 11.5px; color: var(--muted); margin-top: 2px; }

.rk-design .section { padding: 80px 0; }
.rk-design .section.tight { padding: 56px 0; }
.rk-design .section.alt { background: var(--paper); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.rk-design .section-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; gap: 24px; }
.rk-design .section-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--primary); margin-bottom: 12px; display: inline-flex; align-items: center; gap: 8px; }
.rk-design .section-eyebrow .l { width: 28px; height: 1px; background: var(--primary); }
.rk-design .section-title { font-size: 36px; font-weight: 800; letter-spacing: -0.03em; margin: 0; line-height: 1.15; }
.rk-design .section-title em { font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400; color: var(--primary); }
.rk-design .section-sub { font-size: 15px; color: var(--muted); margin-top: 10px; }
.rk-design .section-more { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: var(--ink-2); padding: 8px 14px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--paper); white-space: nowrap; }
.rk-design .section-more:hover { background: var(--bg); }

.rk-design .new-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.rk-design .new-card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-lg); overflow: hidden; display: grid; grid-template-columns: 1fr 1fr; min-height: 280px; box-shadow: var(--shadow-sm); transition: box-shadow .2s, transform .2s; }
.rk-design .new-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
.rk-design .new-card .visual { background: linear-gradient(160deg, #F1ECE0 0%, #E3DDC9 100%); position: relative; display: grid; place-items: center; overflow: hidden; }
.rk-design .new-card .visual.dark { background: linear-gradient(160deg, #2A2D36 0%, #15171C 100%); }
.rk-design .new-card .visual .tag-new { position: absolute; top: 14px; left: 14px; background: var(--primary); color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; padding: 4px 8px; border-radius: 4px; z-index: 2; }
.rk-design .new-card .info { padding: 24px 26px 22px; display: flex; flex-direction: column; }
.rk-design .new-card .info .cat { font-size: 11.5px; font-weight: 700; color: var(--primary); letter-spacing: 0.04em; }
.rk-design .new-card .info h3 { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; margin: 6px 0 4px; line-height: 1.25; }
.rk-design .new-card .info .sku { font-size: 11.5px; color: var(--muted); font-family: 'JetBrains Mono', monospace; letter-spacing: 0; }
.rk-design .new-card .info .prices { margin-top: auto; padding-top: 18px; display: flex; gap: 16px; }
.rk-design .new-card .info .prices .p .l { font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 2px; }
.rk-design .new-card .info .prices .p .v { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
.rk-design .new-card .info .prices .p.alt .v { color: var(--accent); }
.rk-design .new-card .info .more { margin-top: 14px; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--ink); padding-top: 12px; border-top: 1px solid var(--line); }

.rk-design .camp-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
.rk-design .camp { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 32px 34px; position: relative; overflow: hidden; display: flex; flex-direction: column; min-height: 220px; }
.rk-design .camp .eye { display: inline-flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.rk-design .camp .icbig { font-size: 28px; width: 56px; height: 56px; border-radius: 14px; display: grid; place-items: center; margin-bottom: 14px; }
.rk-design .camp h3 { font-size: 24px; font-weight: 800; letter-spacing: -0.025em; margin: 8px 0 8px; line-height: 1.25; }
.rk-design .camp h3 b { color: var(--primary); }
.rk-design .camp p { font-size: 14px; color: var(--ink-2); line-height: 1.6; margin: 0 0 18px; }
.rk-design .camp .a { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--ink); margin-top: auto; padding-top: 10px; }
.rk-design .camp.boomerang { background: linear-gradient(135deg, #F4ECD3 0%, #F6F4EE 60%); border-color: #E6D9AC; }
.rk-design .camp.boomerang .icbig { background: rgba(182,138,46,0.18); color: var(--gold); }
.rk-design .camp.gift { background: linear-gradient(135deg, #FCE9E4 0%, #FAF5F2 60%); border-color: #F2C9BD; }
.rk-design .camp.gift .icbig { background: rgba(229,52,31,0.14); color: var(--primary); }
.rk-design .camp .deadline { position: absolute; top: 24px; right: 24px; background: rgba(0,0,0,0.06); color: var(--ink); border-radius: 999px; padding: 5px 11px; font-size: 11.5px; font-weight: 700; }
.rk-design .camp .deadline b { color: var(--primary); }

.rk-design .cat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.rk-design .cat-card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius); padding: 22px 24px; display: flex; align-items: center; gap: 16px; transition: border-color .15s, transform .15s, box-shadow .15s; }
.rk-design .cat-card:hover { border-color: var(--ink); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.rk-design .cat-card .ic { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; font-size: 24px; background: var(--bg); flex: 0 0 52px; }
.rk-design .cat-card .t { display: flex; flex-direction: column; }
.rk-design .cat-card .t b { font-size: 16px; font-weight: 800; letter-spacing: -0.01em; }
.rk-design .cat-card .t span { font-size: 12px; color: var(--muted); margin-top: 3px; }
.rk-design .cat-card .arr { margin-left: auto; color: var(--muted); font-size: 18px; }

.rk-design .prod-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.rk-design .prod-card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; transition: transform .15s, box-shadow .15s, border-color .15s; }
.rk-design .prod-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--line-strong); }
.rk-design .prod-card .visual { aspect-ratio: 1.1/1; background: var(--bg); position: relative; display: grid; place-items: center; border-bottom: 1px solid var(--line); overflow: hidden; }
.rk-design .prod-card .visual.water { background: linear-gradient(160deg, #E8EEEE 0%, #D6E3E0 100%); }
.rk-design .prod-card .visual.air { background: linear-gradient(160deg, #E8E8EC 0%, #D6D6E0 100%); }
.rk-design .prod-card .visual.bidet { background: linear-gradient(160deg, #EAE5DE 0%, #D6CCC0 100%); }
.rk-design .prod-card .visual.mattress { background: linear-gradient(160deg, #ECE3D8 0%, #DACBB7 100%); }
.rk-design .prod-card .visual .badges { position: absolute; top: 12px; left: 12px; display: flex; flex-direction: column; gap: 6px; z-index: 2; }
.rk-design .prod-card .visual .badge-pick { background: var(--ink); color: #fff; font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
.rk-design .prod-card .visual .badge-gift { background: var(--gold-soft); color: var(--gold); font-size: 10.5px; font-weight: 700; padding: 4px 8px; border-radius: 4px; }
.rk-design .prod-card .info { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
.rk-design .prod-card .info h4 { font-size: 15.5px; font-weight: 700; letter-spacing: -0.01em; margin: 0; line-height: 1.3; }
.rk-design .prod-card .info .sku { font-size: 10.5px; color: var(--muted); font-family: 'JetBrains Mono', monospace; letter-spacing: 0; }
.rk-design .prod-card .info .price { font-size: 12px; color: var(--muted); margin-top: 10px; font-weight: 600; }
.rk-design .prod-card .info .price b { font-size: 20px; font-weight: 800; color: var(--ink); letter-spacing: -0.02em; }
.rk-design .prod-card .info .discount { font-size: 11.5px; color: var(--primary); font-weight: 700; margin-top: 2px; }

.rk-design .pv-water { width: 70px; height: 110px; background: linear-gradient(180deg, #F8F7F3 0%, #E0DCD0 100%); border-radius: 8px 8px 12px 12px; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2), inset 0 -6px 0 rgba(0,0,0,0.04); position: relative; }
.rk-design .pv-water::before { content: ''; position: absolute; top: 10px; left: 8px; right: 8px; height: 30px; background: linear-gradient(180deg, #2A2D36 0%, #15171C 100%); border-radius: 4px; }
.rk-design .pv-water::after { content: ''; position: absolute; top: 50px; left: 50%; transform: translateX(-50%); width: 16px; height: 6px; background: #5B5346; border-radius: 0 0 4px 4px; }
.rk-design .pv-air { width: 80px; height: 100px; background: linear-gradient(180deg, #FCFCFC 0%, #DADDE2 100%); border-radius: 10px; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.18), inset 0 -6px 0 rgba(0,0,0,0.03); position: relative; }
.rk-design .pv-air::before { content: ''; position: absolute; top: 14px; left: 50%; transform: translateX(-50%); width: 40px; height: 40px; border-radius: 50%; background: conic-gradient(from 0deg, #E5341F, #FCE9E4, #E5341F, #FCE9E4, #E5341F); opacity: 0.7; }
.rk-design .pv-air::after { content: ''; position: absolute; top: 30px; left: 50%; transform: translateX(-50%); width: 8px; height: 8px; border-radius: 50%; background: var(--ink); }
.rk-design .pv-bidet { width: 100px; height: 70px; background: linear-gradient(180deg, #FFFFFF 0%, #E0D9CC 100%); border-radius: 50px 50px 16px 16px; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.18), inset 0 -6px 0 rgba(0,0,0,0.04); position: relative; }
.rk-design .pv-bidet::before { content: ''; position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: 24px; height: 8px; border-radius: 4px; background: #2A2D36; }
.rk-design .pv-mat { width: 110px; height: 60px; background: repeating-linear-gradient(90deg, #D2C4A6 0px, #D2C4A6 8px, #C4B594 8px, #C4B594 9px); border-radius: 6px; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.2); position: relative; }
.rk-design .pv-mat::before { content: ''; position: absolute; top: 4px; left: 4px; right: 4px; height: 8px; background: rgba(0,0,0,0.06); border-radius: 3px; }

.rk-design .trust-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.rk-design .trust-card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 28px 30px; display: flex; flex-direction: column; gap: 14px; }
.rk-design .trust-card .ic { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; font-size: 22px; }
.rk-design .trust-card.a .ic { background: var(--accent-soft); color: var(--accent); }
.rk-design .trust-card.b .ic { background: var(--primary-soft); color: var(--primary); }
.rk-design .trust-card.c .ic { background: var(--gold-soft); color: var(--gold); }
.rk-design .trust-card h3 { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
.rk-design .trust-card p { font-size: 14px; color: var(--ink-2); line-height: 1.6; margin: 0; }

.rk-design .consult-band { background: var(--ink); color: #fff; padding: 80px 0; position: relative; overflow: hidden; }
.rk-design .consult-band::before { content: ''; position: absolute; right: -100px; top: -200px; width: 600px; height: 600px; border-radius: 50%; background: radial-gradient(circle, rgba(229,52,31,0.20), transparent 65%); }
.rk-design .consult-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 80px; align-items: center; position: relative; z-index: 1; }
.rk-design .consult-band h2 { font-size: 44px; font-weight: 800; letter-spacing: -0.035em; line-height: 1.1; margin: 0 0 18px; }
.rk-design .consult-band h2 em { font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400; color: #FF8B7A; }
.rk-design .consult-band p { font-size: 16px; color: rgba(255,255,255,0.65); line-height: 1.65; margin: 0 0 28px; max-width: 460px; }
.rk-design .consult-meta { display: flex; gap: 28px; }
.rk-design .consult-meta .m .l { font-size: 11.5px; color: rgba(255,255,255,0.5); letter-spacing: 0.04em; margin-bottom: 4px; font-weight: 600; }
.rk-design .consult-meta .m .v { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }

.rk-design .consult-form { background: var(--paper); color: var(--ink); border-radius: var(--radius-lg); padding: 32px 34px; box-shadow: var(--shadow-lg); }
.rk-design .consult-form h3 { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 4px; }
.rk-design .consult-form .sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; }
.rk-design .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.rk-design .field label { font-size: 12px; font-weight: 600; color: var(--ink-2); letter-spacing: 0; }
.rk-design .field input, .rk-design .field select, .rk-design .field textarea { height: 46px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); font-family: inherit; font-size: 14px; color: var(--ink); transition: border .15s, background .15s; }
.rk-design .field textarea { height: auto; padding: 12px 14px; resize: vertical; min-height: 76px; }
.rk-design .field input:focus, .rk-design .field select:focus, .rk-design .field textarea:focus { outline: none; border-color: var(--ink); background: var(--paper); }
.rk-design .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.rk-design .chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rk-design .chip { padding: 8px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg); font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; transition: all .12s; }
.rk-design .chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }
.rk-design .submit { width: 100%; margin-top: 14px; height: 54px; background: var(--primary); color: #fff; border: 0; border-radius: 12px; font-size: 15px; font-weight: 800; box-shadow: 0 12px 28px -10px rgba(229,52,31,0.55); }
.rk-design .submit:hover { background: var(--primary-deep); }
.rk-design .consent { font-size: 11.5px; color: var(--muted); margin-top: 10px; line-height: 1.5; text-align: center; }

.rk-design .footer { background: var(--paper); border-top: 1px solid var(--line); padding: 56px 0 28px; }
.rk-design .footer-grid { display: grid; grid-template-columns: 1.4fr repeat(3, 1fr); gap: 40px; margin-bottom: 40px; }
.rk-design .footer h4 { font-size: 13px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 14px; }
.rk-design .footer ul, .rk-design .footer p { margin: 0; padding: 0; list-style: none; }
.rk-design .footer li, .rk-design .footer p { font-size: 13px; color: var(--muted); line-height: 1.8; }
.rk-design .footer a:hover { color: var(--ink); }
.rk-design .footer-bottom { border-top: 1px solid var(--line); padding-top: 24px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--muted); }
.rk-design .footer-brand b { display: block; font-size: 16px; color: var(--ink); margin-bottom: 8px; font-weight: 800; }
.rk-design .ic-svg { width: 14px; height: 14px; flex-shrink: 0; }

/* ─────────── Hero variant A — 풀블리드 라이프스타일 ─────────── */
.rk-design .hero-bleed { position: relative; height: 720px; overflow: hidden; }
.rk-design .hero-bleed-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(900px 600px at 78% 35%, #F8D7C2 0%, transparent 70%),
    radial-gradient(700px 500px at 18% 75%, #E8D4B5 0%, transparent 75%),
    linear-gradient(160deg, #F2EBDD 0%, #D8C9A8 60%, #A87E4A 100%);
}
.rk-design .hero-bleed-bg::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 30% 18%, rgba(255,255,255,0.45), transparent 50%),
              radial-gradient(circle at 85% 80%, rgba(20,14,8,0.18), transparent 55%);
}
.rk-design .hero-bleed-bg::after {
  content: ''; position: absolute; inset: 0;
  background:
    repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, transparent 1px, transparent 4px),
    repeating-linear-gradient(90deg, rgba(0,0,0,0.02) 0px, transparent 1px, transparent 4px);
  mix-blend-mode: overlay; opacity: 0.7;
}
.rk-design .bleed-product {
  position: absolute; right: 8%; top: 50%; transform: translateY(-50%);
  height: 88%; max-height: 620px; width: auto; max-width: 50%;
  object-fit: contain;
  filter: drop-shadow(0 60px 80px rgba(60,30,10,0.40)) drop-shadow(0 20px 40px rgba(60,30,10,0.18));
  z-index: 1;
}
.rk-design .hero-bleed-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; z-index: 2;
}
.rk-design .hero-bleed-overlay .container { width: 100%; }
.rk-design .bleed-eyebrow {
  display: inline-flex; gap: 10px; align-items: center;
  font-size: 12.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: #2A1B0E;
  background: rgba(255,255,255,0.86); backdrop-filter: blur(10px);
  padding: 9px 16px 9px 6px; border-radius: 999px; margin-bottom: 28px;
  border: 1px solid rgba(255,255,255,0.6);
  box-shadow: 0 6px 18px -6px rgba(60,30,10,0.18);
}
.rk-design .bleed-eyebrow .tag {
  background: var(--primary); color: #fff; padding: 4px 10px;
  border-radius: 999px; font-size: 11px; letter-spacing: 0.08em;
}
.rk-design .bleed-title {
  font-size: 92px; line-height: 0.98; letter-spacing: -0.045em; font-weight: 800;
  margin: 0 0 22px; max-width: 760px; color: #1A0E04;
  text-shadow: 0 2px 0 rgba(255,255,255,0.30);
}
.rk-design .bleed-title em {
  font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400;
  color: var(--primary); letter-spacing: -0.025em;
}
.rk-design .bleed-desc {
  font-size: 17px; color: #3A2A1C; max-width: 520px;
  margin: 0 0 40px; line-height: 1.55; font-weight: 500;
}
.rk-design .bleed-bar {
  display: inline-flex; align-items: center; gap: 28px;
  background: rgba(20, 14, 8, 0.90); backdrop-filter: blur(14px);
  padding: 18px 22px; border-radius: 18px; max-width: 820px;
  box-shadow: 0 24px 60px -16px rgba(0,0,0,0.42),
              0 2px 0 rgba(255,255,255,0.06) inset;
  border: 1px solid rgba(255,255,255,0.07);
}
.rk-design .bleed-price { color: #fff; padding-right: 18px; border-right: 1px solid rgba(255,255,255,0.10); }
.rk-design .bleed-price:last-of-type { border-right: 0; }
.rk-design .bleed-price .l { font-size: 11px; color: rgba(255,255,255,0.55); font-weight: 600; letter-spacing: 0.06em; margin-bottom: 4px; text-transform: uppercase; }
.rk-design .bleed-price .v { font-size: 28px; font-weight: 800; letter-spacing: -0.025em; }
.rk-design .bleed-price .v .u { font-size: 13px; color: rgba(255,255,255,0.55); font-weight: 500; margin-left: 4px; }
.rk-design .bleed-price .v.alt { color: #FF8B7A; }
.rk-design .bleed-ctas { margin-left: auto; display: flex; gap: 10px; }
.rk-design .bleed-ctas .btn { height: 50px; }

/* ─────────── Hero variant C — 포스터형 합성 ─────────── */
.rk-design .hero-poster { background: var(--bg); padding: 32px 0; }
.rk-design .poster-frame {
  position: relative; max-width: 1320px; margin: 0 32px; min-height: 720px;
  background: linear-gradient(135deg, #0F3D2E 0%, #08231A 60%, #061C14 100%);
  border-radius: 6px; overflow: hidden;
  box-shadow: 0 50px 100px -24px rgba(15,61,46,0.55),
              0 6px 0 rgba(0,0,0,0.06);
}
@media (min-width: 1400px) { .rk-design .poster-frame { margin: 0 auto; } }
.rk-design .poster-frame::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(680px 460px at 76% 28%, rgba(229,52,31,0.22), transparent 60%),
    radial-gradient(560px 420px at 18% 80%, rgba(244,236,211,0.10), transparent 65%);
}
.rk-design .poster-frame::after {
  content: ''; position: absolute; inset: 22px; pointer-events: none;
  border: 1px solid rgba(255,255,255,0.12); border-radius: 3px;
}
.rk-design .poster-meta-tl, .rk-design .poster-meta-tr {
  position: absolute; top: 56px; color: rgba(255,255,255,0.55);
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.20em; text-transform: uppercase;
  line-height: 1.7; z-index: 3;
}
.rk-design .poster-meta-tl { left: 60px; }
.rk-design .poster-meta-tr { right: 60px; text-align: right; }
.rk-design .poster-meta-tl .mono,
.rk-design .poster-meta-tr .mono {
  font-family: 'JetBrains Mono', monospace; letter-spacing: 0.10em; font-size: 11px;
  color: rgba(255,255,255,0.40); font-weight: 500;
}
.rk-design .poster-product {
  position: absolute; right: 4%; top: 50%; transform: translateY(-50%);
  height: 78%; max-height: 580px; width: auto; max-width: 48%;
  object-fit: contain; z-index: 2;
  filter: drop-shadow(0 50px 70px rgba(0,0,0,0.50));
}
.rk-design .poster-title-wrap {
  position: absolute; left: 60px; bottom: 88px; max-width: 64%; z-index: 3;
}
.rk-design .poster-tag {
  display: inline-block; padding: 7px 14px; background: var(--primary); color: #fff;
  font-size: 11px; font-weight: 800; letter-spacing: 0.12em; border-radius: 2px;
  margin-bottom: 20px; text-transform: uppercase;
  box-shadow: 0 8px 20px -6px rgba(229,52,31,0.5);
}
.rk-design .poster-title {
  font-size: 88px; line-height: 0.95; letter-spacing: -0.04em;
  color: #fff; margin: 0; font-weight: 800;
}
.rk-design .poster-title em {
  font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400;
  font-size: 124px; line-height: 0.92; letter-spacing: -0.035em;
  color: #F4ECD3; display: inline-block; margin-top: 2px;
}
.rk-design .poster-sub {
  margin-top: 22px; font-size: 14px; color: rgba(255,255,255,0.65);
  font-weight: 500; letter-spacing: 0.02em;
  padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.15);
  display: inline-block; padding-right: 60px;
}
.rk-design .poster-sticker {
  position: absolute; padding: 14px 20px; border-radius: 8px;
  z-index: 4; line-height: 1.1;
  box-shadow: 0 16px 36px -10px rgba(0,0,0,0.40),
              0 2px 0 rgba(0,0,0,0.05);
}
.rk-design .poster-sticker .l {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  margin-bottom: 4px;
}
.rk-design .poster-sticker .v {
  font-size: 24px; font-weight: 800; letter-spacing: -0.025em;
}
.rk-design .poster-sticker.sticker-1 {
  top: 110px; left: 58%; transform: rotate(-5deg);
  background: #F4ECD3; color: #2A1B0E;
}
.rk-design .poster-sticker.sticker-1 .l { color: #6E5530; }
.rk-design .poster-sticker.sticker-2 {
  top: 240px; left: 66%; transform: rotate(6deg);
  background: var(--primary); color: #fff;
}
.rk-design .poster-sticker.sticker-2 .l { color: rgba(255,255,255,0.75); }
.rk-design .poster-cta-row {
  position: absolute; right: 60px; bottom: 88px; display: flex; gap: 10px; z-index: 4;
}
.rk-design .poster-cta-row .btn { height: 52px; }
`;
