import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Next.js 16: middleware.ts → proxy.ts. Function name is `proxy`.

// ─── 협력점 customDomain → /p/[partnerCode]/* rewrite 설정 ───
const SYSTEM_HOST_SUFFIXES = ["localhost", "127.0.0.1", "vercel.app"];

function isSystemHost(host: string): boolean {
  const extra = (process.env.SYSTEM_HOSTS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  if (extra.some(h => host === h || host.endsWith(`.${h}`))) return true;
  return SYSTEM_HOST_SUFFIXES.some(suf => host === suf || host.endsWith(`.${suf}`));
}

async function lookupPartnerCode(origin: string, host: string): Promise<string | null> {
  try {
    const r = await fetch(`${origin}/api/partners/by-domain?host=${encodeURIComponent(host)}`, {
      headers: { "x-internal-lookup": "1" },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.partnerCode ?? null;
  } catch {
    return null;
  }
}

export default auth(async (req) => {
  const path = req.nextUrl.pathname;
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();

  // ─── 0) 시스템 호스트(vercel.app 프리뷰 등) 루트 진입 시 hub root partner 로 rewrite ───
  //  Preview 환경에서 라이브(skmagic-shop.com 루트=우성종합통신 페이지)와 동일한 UX 를 원할 때
  //  HUB_ROOT_PARTNER_CODE env 를 설정해두면 루트("/") 접근이 해당 협력점 사이트로 rewrite.
  //  라이브 production 도메인(skmagic-shop.com)은 아래 customDomain rewrite 로 이미 처리되므로 무영향.
  if (host && isSystemHost(host) && path === "/") {
    const hubRoot = process.env.HUB_ROOT_PARTNER_CODE?.trim();
    if (hubRoot) {
      const url = req.nextUrl.clone();
      url.pathname = `/p/${hubRoot}`;
      return NextResponse.rewrite(url);
    }
  }

  // ─── 1) 협력점 customDomain rewrite ───
  if (host && !isSystemHost(host)) {
    // 정적 자산 (public/ 안의 파일들) 은 rewrite 대상 아님 — 그대로 root path 에서 서빙되어야 함.
    // 예: /sk-magic-logo.png, /favicon.ico, /robots.txt 등.
    const isStaticAsset = /\.[a-z0-9]{2,5}$/i.test(path);
    if (isStaticAsset) {
      // 통과
    } else if (
      path.startsWith("/p/") || path === "/p" ||
      path.startsWith("/admin") ||
      path.startsWith("/login") ||
      path.startsWith("/api/auth") ||
      path.startsWith("/apply") ||
      path.startsWith("/legal/") ||
      path.startsWith("/region/")
    ) {
      // 이미 partner namespace 거나 본사 공통 페이지 (분양/약관/지역 SEO) — 그대로 통과
    } else if (path.startsWith("/preview/") || path === "/preview") {
      // customDomain 으로 들어온 컨슈머에게 PC 프리뷰 노출 금지
      return new NextResponse("Not Found", { status: 404 });
    } else {
      const partnerCode = await lookupPartnerCode(req.nextUrl.origin, host);
      if (partnerCode) {
        const url = req.nextUrl.clone();
        url.pathname = `/p/${partnerCode}${path === "/" ? "" : path}`;
        return NextResponse.rewrite(url);
      }
    }
  }

  // ─── 2) 기존 admin 인증 로직 ───
  const isAdmin = path.startsWith("/admin");
  const isLoggedIn = !!req.auth;

  if (isAdmin && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  // 첫 로그인 시 비밀번호 강제 변경 — /admin/profile 외 모든 admin 라우트 차단
  if (isAdmin && isLoggedIn && req.auth?.user?.mustChangePassword) {
    if (path !== "/admin/profile" && !path.startsWith("/admin/profile/")) {
      const url = new URL("/admin/profile", req.nextUrl);
      url.searchParams.set("force", "1");
      return NextResponse.redirect(url);
    }
  }

  // 역할별 home
  const role = req.auth?.user?.role;
  const homeFor = (r: string | undefined) =>
    r === "hq" ? "/admin/super"
    : r === "partner_admin" ? "/admin/franchise"
    : r === "seller" ? "/admin/seller"
    : "/login";

  // 역할 구분 — 자기 영역 외 접근 시 자기 home으로
  if (path.startsWith("/admin/super") && role !== "hq") {
    return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
  }
  // 협력점 콘솔: partner_admin 또는 hq(임시 진입)만 허용 — seller 는 자기 home 으로
  if (path.startsWith("/admin/franchise") && role !== "partner_admin" && role !== "hq") {
    return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
  }
  // 영업자 콘솔: seller 본인 외에 hq / partner_admin 임시 진입(impersonation) 허용.
  // 실제 본인 협력점 소속 여부는 effectiveSeller 가 cookie 기반으로 검증.
  if (path.startsWith("/admin/seller") && role !== "seller" && role !== "hq" && role !== "partner_admin") {
    return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // 도메인 rewrite 가 admin 외 모든 페이지 경로에서도 동작해야 하므로 matcher 확장.
  // api / _next / 정적 파일은 제외 — 무한 루프 + 성능.
  matcher: ["/((?!api|_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml).*)"],
};
