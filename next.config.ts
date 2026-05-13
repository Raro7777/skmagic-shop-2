import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking 방지 (관리자 콘솔 iframe 삽입 차단)
          { key: "X-Frame-Options", value: "DENY" },
          // MIME sniffing 차단
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer 정책 — UTM 보존하면서 외부 도메인엔 origin만 노출
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions Policy — 사용 안 하는 강력 권한 모두 차단
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
