import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { CrawlAdapter, CrawledProductPayload } from "./types";
import { skmagicAdapter } from "./skmagic";

const ADAPTERS: Record<string, CrawlAdapter> = {
  skmagic: skmagicAdapter,
};

/**
 * 크롤링한 항목을 기존 Product와 비교해 changeType과 previousData(diff snapshot)를 산출한다.
 * Returns null when no comparable Product exists yet (→ "new").
 */
function diffAgainstProduct(
  payload: CrawledProductPayload,
  existing: {
    name: string;
    modelName: string;
    rentalPrice: number;
    cardDiscountPrice: number | null;
    contractPeriod: number;
    managementType: string;
    category: string;
    description: string | null;
  } | null,
): { changeType: "new" | "updated" | "unchanged"; previousData: Record<string, unknown> | null } {
  if (!existing) return { changeType: "new", previousData: null };

  // 가격 필드 (rentalPrice / cardDiscountPrice) 는 본사 정책표(xlsx) 가 단독 출처.
  // SK매직 매직몰의 소매가는 B2C 채널 가격이라 협력점 정책가와 다르므로 비교에서 제외.
  const changes: Record<string, unknown> = {};
  if (existing.name !== payload.name) changes.name = existing.name;
  if (existing.modelName !== payload.modelName) changes.modelName = existing.modelName;
  if (existing.contractPeriod !== payload.contractPeriod) changes.contractPeriod = existing.contractPeriod;
  if (existing.managementType !== payload.managementType) changes.managementType = existing.managementType;
  if (existing.category !== payload.category) changes.category = existing.category;
  if ((existing.description ?? null) !== (payload.description ?? null)) {
    changes.description = existing.description;
  }

  if (Object.keys(changes).length === 0) {
    return { changeType: "unchanged", previousData: null };
  }
  return { changeType: "updated", previousData: changes };
}

export type RunCrawlResult = {
  runId: string;
  itemCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  warnings: string[];
};

/**
 * 한 번의 크롤 실행:
 * 1) source 조회 + adapter 결정
 * 2) CrawlRun(running) 생성
 * 3) adapter.fetch() 호출
 * 4) 각 item을 existing Product와 diff
 *    - unchanged → 큐에 넣지 않고 카운트만 증가
 *    - new/updated → CrawledProduct(approvalStatus=pending) 적재
 * 5) CrawlRun status=success/failed로 마감
 *
 * 주의: rulebook 19.5 — 직접 Product를 수정하지 않는다. 본사 검토 큐(crawled_products)에만 쌓는다.
 */
export async function runCrawl(opts: {
  sourceSlug: string;
  triggeredById?: string | null;
}): Promise<RunCrawlResult> {
  const source = await prisma.crawlSource.findUnique({ where: { slug: opts.sourceSlug } });
  if (!source) throw new Error(`unknown source: ${opts.sourceSlug}`);
  if (source.status !== "active") throw new Error(`source paused: ${opts.sourceSlug}`);

  const adapter = ADAPTERS[opts.sourceSlug];
  if (!adapter) throw new Error(`no adapter registered for: ${opts.sourceSlug}`);

  const run = await prisma.crawlRun.create({
    data: {
      sourceId: source.id,
      status: "running",
      triggeredById: opts.triggeredById ?? null,
    },
  });

  try {
    const { items, warnings = [] } = await adapter.fetch();

    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    for (const payload of items) {
      const existing = await prisma.product.findUnique({
        where: { productCode: payload.productCode },
        select: {
          name: true,
          modelName: true,
          rentalPrice: true,
          cardDiscountPrice: true,
          contractPeriod: true,
          managementType: true,
          category: true,
          description: true,
        },
      });

      const { changeType, previousData } = diffAgainstProduct(payload, existing);

      if (changeType === "unchanged") {
        unchangedCount++;
        continue;
      }
      if (changeType === "new") newCount++;
      else updatedCount++;

      // imageUrls / keyFeatures / specs / warrantyMonths는 schema 컬럼이 없으므로
      // rawData JSON에 함께 저장 → 승인 시 Product에 매핑.
      const enriched = {
        ...(payload.rawData ?? {}),
        imageUrls: payload.imageUrls ?? [],
        keyFeatures: payload.keyFeatures ?? [],
        specs: payload.specs ?? {},
        warrantyMonths: payload.warrantyMonths ?? null,
      };

      await prisma.crawledProduct.create({
        data: {
          sourceId: source.id,
          runId: run.id,
          sourceUrl: payload.sourceUrl,
          productCode: payload.productCode,
          category: payload.category,
          name: payload.name,
          modelName: payload.modelName,
          imageUrl: payload.imageUrl ?? null,
          rentalPrice: payload.rentalPrice,
          cardDiscountPrice: payload.cardDiscountPrice ?? null,
          contractPeriod: payload.contractPeriod,
          managementType: payload.managementType,
          description: payload.description ?? null,
          rawData: enriched as Prisma.InputJsonValue,
          previousData: (previousData ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
          changeType,
          approvalStatus: "pending",
        },
      });
    }

    await prisma.crawlRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "success",
        itemCount: items.length,
        newCount,
        updatedCount,
        unchangedCount,
      },
    });
    await prisma.crawlSource.update({
      where: { id: source.id },
      data: { lastCrawledAt: new Date() },
    });

    return {
      runId: run.id,
      itemCount: items.length,
      newCount,
      updatedCount,
      unchangedCount,
      warnings,
    };
  } catch (err) {
    await prisma.crawlRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

/**
 * 큐에 쌓인 한 건을 승인한다.
 * - new: Product 신규 생성
 * - updated: 기존 Product 필드 업데이트 + ProductChangeLog 기록
 * - 처리 후 CrawledProduct.approvalStatus = "approved"
 */
/**
 * 같은 product 의 모든 active ContentImage width median 계산 → ±15% 밖이면
 * status="anomalous_size" 로 마킹. 매장 사이트는 active 만 노출하므로 자동으로 가려짐.
 * 적은 표본(< 3장) 일 땐 마킹 안 함.
 */
export async function flagAnomalousContentImages(productId: string): Promise<{ flagged: number }> {
  // 이미 anomalous 마킹된 것도 다시 active 후보로 본 후 다시 판정 (재크롤로 분포가 바뀌면 복구 가능)
  await prisma.productContentImage.updateMany({
    where: { productId, status: "anomalous_size" },
    data: { status: "active" },
  });

  const rows = await prisma.productContentImage.findMany({
    where: { productId, status: "active", width: { not: null } },
    select: { id: true, width: true },
  });
  if (rows.length < 3) return { flagged: 0 };

  const widths = rows.map(r => r.width!).sort((a, b) => a - b);
  const median = widths[Math.floor(widths.length / 2)];
  const low = median * 0.85;
  const high = median * 1.15;
  const outliers = rows.filter(r => r.width! < low || r.width! > high).map(r => r.id);

  if (outliers.length > 0) {
    await prisma.productContentImage.updateMany({
      where: { id: { in: outliers } },
      data: { status: "anomalous_size" },
    });
  }
  return { flagged: outliers.length };
}

export async function approveCrawledProduct(opts: {
  crawledId: string;
  reviewerId?: string | null;
  note?: string | null;
}): Promise<{ contentImagesAttempted: number; contentImagesStored: number; contentImagesFailed: number }> {
  const crawled = await prisma.crawledProduct.findUnique({ where: { id: opts.crawledId } });
  if (!crawled) throw new Error("crawled product not found");
  if (crawled.approvalStatus !== "pending") throw new Error("already reviewed");
  if (!crawled.productCode) throw new Error("missing productCode");

  // rawData에 저장된 풍부한 필드(imageUrls/keyFeatures/specs/warrantyMonths) 추출
  const raw = (crawled.rawData ?? {}) as Record<string, unknown>;
  const enrichedImageUrls = Array.isArray(raw.imageUrls) ? raw.imageUrls.filter((x): x is string => typeof x === "string") : [];
  const enrichedKeyFeatures = Array.isArray(raw.keyFeatures) ? raw.keyFeatures.filter((x): x is string => typeof x === "string") : [];
  const enrichedSpecs = (raw.specs && typeof raw.specs === "object" && !Array.isArray(raw.specs))
    ? (raw.specs as Record<string, string>)
    : {};
  const enrichedWarranty = typeof raw.warrantyMonths === "number" ? raw.warrantyMonths : null;
  const contentImageUrls = Array.isArray(raw.contentImageUrls)
    ? raw.contentImageUrls.filter((x): x is string => typeof x === "string")
    : [];

  await prisma.$transaction(async tx => {
    if (crawled.changeType === "new") {
      // 신규 상품 — 가격은 크롤가로 임시 채우고 status=discontinued 로 비공개.
      // 본사 정책표(xlsx) import 후 가격 정확값이 들어왔을 때 관리자가 status=active 로 전환.
      await tx.product.create({
        data: {
          productCode: crawled.productCode!,
          category: crawled.category ?? "etc",
          name: crawled.name,
          modelName: crawled.modelName ?? crawled.productCode!,
          imageUrl: crawled.imageUrl ?? null,
          imageUrls: enrichedImageUrls,
          rentalPrice: crawled.rentalPrice ?? 0,
          cardDiscountPrice: crawled.cardDiscountPrice ?? null,
          contractPeriod: crawled.contractPeriod ?? 60,
          managementType: crawled.managementType ?? "자가관리",
          description: crawled.description ?? null,
          keyFeatures: enrichedKeyFeatures.length > 0 ? (enrichedKeyFeatures as Prisma.InputJsonValue) : undefined,
          specs: Object.keys(enrichedSpecs).length > 0 ? (enrichedSpecs as Prisma.InputJsonValue) : undefined,
          warrantyMonths: enrichedWarranty ?? 60,
          status: "discontinued", // 정책표 적용 전까지 소비자 노출 차단
        },
      });
    } else if (crawled.changeType === "updated") {
      const existing = await tx.product.findUnique({ where: { productCode: crawled.productCode! } });
      if (!existing) throw new Error("target product disappeared");

      const updates: Record<string, unknown> = {};
      const logs: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = [];

      const compare = (
        field: string,
        oldV: string | number | null | undefined,
        newV: string | number | null | undefined,
      ) => {
        if ((oldV ?? null) !== (newV ?? null)) {
          updates[field] = newV;
          logs.push({
            fieldName: field,
            oldValue: oldV == null ? null : String(oldV),
            newValue: newV == null ? null : String(newV),
          });
        }
      };

      compare("name", existing.name, crawled.name);
      compare("modelName", existing.modelName, crawled.modelName ?? existing.modelName);
      compare("category", existing.category, crawled.category ?? existing.category);
      // 가격 (rentalPrice / cardDiscountPrice) 은 본사 정책표 단독 출처 — 크롤은 덮어쓰지 않는다.
      compare("contractPeriod", existing.contractPeriod, crawled.contractPeriod ?? existing.contractPeriod);
      compare("managementType", existing.managementType, crawled.managementType ?? existing.managementType);
      compare("description", existing.description, crawled.description ?? null);

      // imageUrls/keyFeatures/specs는 빈 경우에만 보강 (관리자 직접 편집분 보존)
      const fullExisting = await tx.product.findUnique({
        where: { id: existing.id },
        select: { imageUrls: true, keyFeatures: true, specs: true, warrantyMonths: true, imageUrl: true },
      });
      if (fullExisting) {
        if ((fullExisting.imageUrls?.length ?? 0) === 0 && enrichedImageUrls.length > 0) {
          updates.imageUrls = enrichedImageUrls;
          if (!fullExisting.imageUrl && enrichedImageUrls[0]) updates.imageUrl = enrichedImageUrls[0];
          logs.push({
            fieldName: "imageUrls",
            oldValue: "비어있음",
            newValue: `${enrichedImageUrls.length}장 보강`,
          });
        }
        const kf = fullExisting.keyFeatures as unknown;
        const kfEmpty = !kf || (Array.isArray(kf) && kf.length === 0);
        if (kfEmpty && enrichedKeyFeatures.length > 0) {
          updates.keyFeatures = enrichedKeyFeatures;
          logs.push({
            fieldName: "keyFeatures",
            oldValue: "비어있음",
            newValue: `${enrichedKeyFeatures.length}개 보강`,
          });
        }
        const sp = fullExisting.specs as unknown;
        const spEmpty = !sp || (typeof sp === "object" && Object.keys(sp as object).length === 0);
        if (spEmpty && Object.keys(enrichedSpecs).length > 0) {
          updates.specs = enrichedSpecs;
          logs.push({
            fieldName: "specs",
            oldValue: "비어있음",
            newValue: `${Object.keys(enrichedSpecs).length}개 보강`,
          });
        }
      }

      if (Object.keys(updates).length > 0) {
        await tx.product.update({ where: { productCode: crawled.productCode! }, data: updates });
        for (const l of logs) {
          await tx.productChangeLog.create({
            data: {
              productId: existing.id,
              fieldName: l.fieldName,
              oldValue: l.oldValue,
              newValue: l.newValue,
              source: "crawl",
              triggeredById: opts.reviewerId ?? null,
            },
          });
        }
      }
    }

    await tx.crawledProduct.update({
      where: { id: crawled.id },
      data: {
        approvalStatus: "approved",
        reviewedById: opts.reviewerId ?? null,
        reviewedAt: new Date(),
        reviewNote: opts.note ?? null,
      },
    });
  });

  // ── 본문 마케팅 이미지 다운로드 + Blob 영구 저장 (트랜잭션 밖, 실패 안전) ──
  const productRow = await prisma.product.findUnique({
    where: { productCode: crawled.productCode! },
    select: { id: true },
  });
  let stored = 0;
  let failed = 0;
  if (productRow && contentImageUrls.length > 0) {
    const { downloadMany } = await import("@/lib/blobUploader");
    // 재크롤 시 기존 이미지의 sourceUrl 매칭 — 같은 sourceUrl 은 재다운로드 스킵
    const existing = await prisma.productContentImage.findMany({
      where: { productId: productRow.id },
      select: { sourceUrl: true },
    });
    const existingSrc = new Set(existing.map(e => e.sourceUrl));
    const toFetch = contentImageUrls
      .filter(u => !existingSrc.has(u))
      .slice(0, 30); // product 당 신규 다운로드 30장 cap

    if (toFetch.length > 0) {
      const items = toFetch.map((sourceUrl, i) => ({
        sourceUrl,
        pathname: `products/${crawled.productCode}/content-${Date.now()}-${i}`,
      }));
      const results = await downloadMany(items, 5);
      const orderBase = existing.length;
      const rowsToCreate: Array<{
        productId: string; url: string; sourceUrl: string; order: number;
        sizeBytes: number; width: number | null; height: number | null; status: string;
      }> = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.result) {
          stored++;
          rowsToCreate.push({
            productId: productRow.id,
            url: r.result.url,
            sourceUrl: r.sourceUrl,
            order: orderBase + i,
            sizeBytes: r.result.sizeBytes,
            width: r.result.width,
            height: r.result.height,
            status: "active",
          });
        } else {
          failed++;
        }
      }
      if (rowsToCreate.length > 0) {
        await prisma.productContentImage.createMany({ data: rowsToCreate });
      }
    }

    // 비정형 크기 자동 마킹 — 같은 product 의 width median 의 ±15% 밖이면 status="anomalous_size"
    await flagAnomalousContentImages(productRow.id);
  }

  return {
    contentImagesAttempted: contentImageUrls.length,
    contentImagesStored: stored,
    contentImagesFailed: failed,
  };
}

export async function rejectCrawledProduct(opts: {
  crawledId: string;
  reviewerId?: string | null;
  note?: string | null;
}) {
  const crawled = await prisma.crawledProduct.findUnique({ where: { id: opts.crawledId } });
  if (!crawled) throw new Error("crawled product not found");
  if (crawled.approvalStatus !== "pending") throw new Error("already reviewed");

  await prisma.crawledProduct.update({
    where: { id: opts.crawledId },
    data: {
      approvalStatus: "rejected",
      reviewedById: opts.reviewerId ?? null,
      reviewedAt: new Date(),
      reviewNote: opts.note ?? null,
    },
  });
}
