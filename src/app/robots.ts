import type { MetadataRoute } from "next";
import { SITE_URL as SITE } from "@/lib/constants/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        // 인증 영역 + API는 크롤러 차단
        disallow: [
          "/admin/",
          "/api/",
          "/login",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
