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

  // ─── 1) 협력점 customDomain rewrite ───
  if (host && !isSystemHost(host)) {
    if (path.startsWith("/p/") || path === "/p" || path.startsWith("/admin") || path.startsWith("/login") || path.startsWith("/api/auth")) {
      // 이미 partner namespace 거나 admin/login (인증 게이트가 알아서 처리) — 그대로 통과
    } else if (path.startsWith("/preview/")) {
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
  if (path.startsWith("/admin/seller") && role !== "seller" && role !== "hq") {
    return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // 도메인 rewrite 가 admin 외 모든 페이지 경로에서도 동작해야 하므로 matcher 확장.
  // api / _next / 정적 파일은 제외 — 무한 루프 + 성능.
  matcher: ["/((?!api|_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml).*)"],
};
