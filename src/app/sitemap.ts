import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { listAllRegionSlugs } from "@/lib/regionSeo";
import { SITE_URL as SITE } from "@/lib/constants/site";

export const revalidate = 3600; // 1시간

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [partners, products, regions] = await Promise.all([
    prisma.partner.findMany({
      where: { status: "active" },
      select: { partnerCode: true, updatedAt: true },
    }),
    prisma.product.findMany({
      where: { status: "active" },
      select: { productCode: true, updatedAt: true },
    }),
    listAllRegionSlugs(),
  ]);

  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE}/apply`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE}/legal/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // 협력점 사이트
  for (const p of partners) {
    entries.push({
      url: `${SITE}/p/${p.partnerCode}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily",
      priority: 0.9,
    });
    entries.push({
      url: `${SITE}/p/${p.partnerCode}/products`,
      lastModified: p.updatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    });
    entries.push({
      url: `${SITE}/p/${p.partnerCode}/reviews`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.5,
    });
    entries.push({
      url: `${SITE}/p/${p.partnerCode}/events`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }

  // 협력점 × 상품 상세 (대표 협력점 = 첫 번째 — 모든 조합은 너무 많음)
  if (partners[0]) {
    for (const prod of products) {
      entries.push({
        url: `${SITE}/p/${partners[0].partnerCode}/products/${prod.productCode}`,
        lastModified: prod.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  // 지역 SEO
  for (const region of regions) {
    entries.push({
      url: `${SITE}/region/${region.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
    // 지역 + 카테고리
    for (const cat of ["water", "air", "bidet"]) {
      entries.push({
        url: `${SITE}/region/${region.slug}?cat=${cat}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
