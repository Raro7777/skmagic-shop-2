import * as cheerio from "cheerio";
import type { CrawlAdapter, CrawledProductPayload } from "./types";

/**
 * SK매직 공식몰(skmagic.com) 어댑터.
 *
 * 룰북 19.8 — robots.txt 확인 (https://www.skmagic.com/robots.txt: Disallow 비어있음 → 허용),
 * 동일 도메인 내 요청 사이 800ms 이상 간격 유지.
 *
 * 흐름:
 *   1) 카테고리(mstDispClsfNo)별로 /goods/indexSubGoodsList POST → HTML 조각
 *   2) HTML 조각을 cheerio로 파싱하여 (goodsId, modelCode, name, 가격) 추출
 *   3) 각 goodsId별 상세 페이지 호출 → 약정기간/관리방식 등 보강
 *   4) CrawledProductPayload[] 반환
 */

const BASE = "https://www.skmagic.com";
const UA = "Mozilla/5.0 (compatible; rentking-crawler/0.1; +https://rentking.example/contact)";

type CategoryDef = {
  mstDispClsfNo: string;
  category: string;          // 내부 분류 키
  categoryLabel: string;     // 사람용 라벨
};

const CATEGORIES: CategoryDef[] = [
  { mstDispClsfNo: "100000003", category: "water",   categoryLabel: "정수기" },
  { mstDispClsfNo: "100000004", category: "air",     categoryLabel: "공기청정기" },
  { mstDispClsfNo: "1000000182", category: "bidet",  categoryLabel: "비데/연수기" },
  { mstDispClsfNo: "100000002", category: "kitchen", categoryLabel: "주방가전" },
  { mstDispClsfNo: "1000000219", category: "massage", categoryLabel: "안마/매직케어" },
];

// productCode 접두사 기반 카테고리 보정 — SK매직 사이트가 동일 상품을 여러 mst 카테고리에
// 교차 노출하므로 첫 등장 카테고리만으로는 부정확. 모델코드 접두사로 정정한다.
function refineCategory(productCode: string, fallback: string): string {
  const c = productCode.toUpperCase();
  if (c.startsWith("WPU")) return "water";       // Water Purifier
  if (c.startsWith("ACL") || c.startsWith("APU")) return "air";  // Air Cleaner
  if (c.startsWith("BID")) return "bidet";
  if (c.startsWith("MAT")) return "mattress";    // 매트리스/프레임
  if (c.startsWith("DRY") || c.startsWith("DWA")) return "dryer";
  if (c.startsWith("DWS") || c.startsWith("DDW")) return "dishwasher";
  if (c.startsWith("EHR") || c.startsWith("ELR") || c.startsWith("EIH")) return "kitchen"; // 전기레인지
  if (c.startsWith("MMC") || c.startsWith("MCH")) return "massage";
  return fallback;
}

const MIN_DELAY_MS = 800;
let lastRequestAt = 0;

async function politeFetch(url: string, init?: RequestInit): Promise<Response> {
  const wait = Math.max(0, lastRequestAt + MIN_DELAY_MS - Date.now());
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestAt = Date.now();
  return fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      "Accept-Language": "ko-KR,ko;q=0.9",
      ...(init?.headers ?? {}),
    },
  });
}

type ListedItem = {
  goodsId: string;            // e.g. G000067988
  productCode: string;        // 모델코드 e.g. WPUJCC104SWH
  saleType: string;           // 구독 | 구매
  name: string;
  modelCodeText: string;
  monthlyRental: number | null;
  cardDiscount: number | null;
  benefitTags: string;
  thumbnail: string | null;
};

async function fetchCategory(cat: CategoryDef): Promise<ListedItem[]> {
  const items: ListedItem[] = [];
  let page = 1;
  const seenGoodsIds = new Set<string>();

  while (true) {
    const body = new URLSearchParams({
      dispClsfNo: cat.mstDispClsfNo,
      mstDispClsfNo: cat.mstDispClsfNo,
      page: String(page),
      rows: "200",
    });
    const res = await politeFetch(`${BASE}/goods/indexSubGoodsList`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`category ${cat.mstDispClsfNo} list failed: ${res.status}`);
    const html = await res.text();

    const $ = cheerio.load(html);
    const cards = $("li[data-compare-goods-id]");
    if (cards.length === 0) break;

    let pageNew = 0;
    cards.each((_, el) => {
      const $el = $(el);
      const goodsId = $el.attr("data-compare-goods-id") ?? "";
      const productCode = $el.attr("data-compare-product") ?? "";
      const saleType = $el.attr("data-compare-saletp") ?? "";
      if (!goodsId || seenGoodsIds.has(goodsId)) return;
      seenGoodsIds.add(goodsId);
      pageNew++;

      const name = $el.find(".item-name02 a").first().text().trim()
                || $el.find(".item-name02").first().text().trim();
      const modelCodeText = $el.find(".item-model02").first().text().trim();
      const benefitTags = $el.find(".item-benefit02").first().text().trim().replace(/\s+/g, " ");
      const thumbnail = $el.find(".product-thumb-wrap img").first().attr("src") ?? null;

      let monthlyRental: number | null = null;
      let cardDiscount: number | null = null;
      const priceCells = $el.find(".product-price-cell .price-data");
      priceCells.each((_, p) => {
        const $p = $(p);
        const title = $p.find(".price-title").text().trim();
        const num = $p.find(".price-value strong.num").first().text().trim().replace(/[^\d]/g, "");
        const value = num ? Number(num) : null;
        if (title === "구독" || title === "월 구독료") {
          if (value != null) monthlyRental = value;
        } else if (title.includes("제휴카드") || title.includes("혜택가")) {
          if (value != null && cardDiscount == null) cardDiscount = value;
        }
      });

      items.push({
        goodsId,
        productCode,
        saleType,
        name,
        modelCodeText,
        monthlyRental,
        cardDiscount,
        benefitTags,
        thumbnail,
      });
    });

    if (cards.length < 200 || pageNew === 0) break;
    page++;
    if (page > 20) break; // safety cap
  }

  return items;
}

type DetailEnrichment = {
  contractPeriod: number | null;
  managementType: string | null;
  rentalPriceFromDetail: number | null;
  cardDiscountFromDetail: number | null;
  description: string | null;
  imageUrls: string[];
  contentImageUrls: string[];
  keyFeatures: string[];
  specs: Record<string, string>;
  warrantyMonths: number | null;
};

async function enrichDetail(it: ListedItem): Promise<DetailEnrichment> {
  const url = `${BASE}/goods/indexGoodsDetail?goodsId=${encodeURIComponent(it.goodsId)}`;
  const res = await politeFetch(url);
  const empty: DetailEnrichment = {
    contractPeriod: null,
    managementType: null,
    rentalPriceFromDetail: null,
    cardDiscountFromDetail: null,
    description: null,
    imageUrls: [],
    contentImageUrls: [],
    keyFeatures: [],
    specs: {},
    warrantyMonths: null,
  };
  if (!res.ok) return empty;

  const html = await res.text();
  const $ = cheerio.load(html);

  // ============ 가격/약정/관리방식 (data-* 속성에서 추출) ============
  const radios = $("input[name='rentalInfo'][data-rental-price]");
  let rentalPriceFromDetail: number | null = null;
  let cardDiscountFromDetail: number | null = null;
  let contractPeriod: number | null = null;
  let managementType: string | null = null;

  const first = radios.first();
  if (first.length > 0) {
    const rp = first.attr("data-rental-price");
    const rpDc = first.attr("data-rental-price-dc");
    const ownGetPrd = first.attr("data-own-get-prd");
    const filterTpNm = first.attr("data-filter-tp-nm");
    const cmpnChngTpNm = first.attr("data-cmpn-chng-tp-nm");

    if (rp) rentalPriceFromDetail = Number(rp);
    if (rpDc) cardDiscountFromDetail = Number(rpDc);
    if (ownGetPrd) contractPeriod = Number(ownGetPrd);

    if (cmpnChngTpNm) {
      if (cmpnChngTpNm.includes("자가") || cmpnChngTpNm.includes("셀프")) {
        managementType = "자가관리";
      } else if (cmpnChngTpNm.includes("방문")) {
        managementType = filterTpNm ? `방문관리 ${filterTpNm}` : "방문관리";
      } else {
        managementType = cmpnChngTpNm;
      }
    }
  }

  // ============ 이미지 갤러리 — goodsId 매칭하는 것만 ============
  // SK매직 패턴: https://static.skmagic.com/image/goods/<goodsId>/<goodsId>_<idx>_<size>.<ext>
  // 다른 goodsId(관련상품 썸네일)는 제외하고 본 상품 이미지만 추출.
  const imgPattern = new RegExp(
    `https://static\\.skmagic\\.com/image/goods/${it.goodsId}/${it.goodsId}_(\\d+)(?:_(\\d+x\\d+))?\\.(jpg|png|jpeg)`,
    "gi",
  );
  type ImgEntry = { idx: number; size: number; url: string };
  const found = new Map<number, ImgEntry>();
  for (const m of html.matchAll(imgPattern)) {
    const idx = Number(m[1]);
    const sizeStr = m[2] ?? "0x0";
    const sizeMax = sizeStr === "0x0" ? 99999 : Number(sizeStr.split("x")[0]); // 원본 무사이즈는 가장 큰 것으로 취급
    const url = m[0];
    const existing = found.get(idx);
    // 같은 idx에 여러 사이즈가 있으면 가장 큰 것을 채택 (원본 > 480 > 350 > ...)
    if (!existing || sizeMax > existing.size) {
      found.set(idx, { idx, size: sizeMax, url });
    }
  }
  const imageUrls = [...found.values()]
    .sort((a, b) => a.idx - b.idx)
    .map(e => e.url)
    .slice(0, 12); // 너무 많으면 12장으로 제한

  // ============ 본문 마케팅 이미지 (상품 상세 페이지 본문) ============
  // 외부 URL만 수집. 본사 승인 시점에 다운로드 → Vercel Blob 저장.
  // 갤러리 이미지 (/image/goods/{goodsId}/) 는 제외.
  const contentImageSet = new Set<string>();
  const galleryPrefix = `/image/goods/${it.goodsId}/`;

  // 1) 정규식 — SK매직 도메인 안의 마케팅 이미지 경로
  //    실제 발견된 경로: /image/editor/goods_desc/ (상품 본문) + /image/editor/event/ (이벤트 배너)
  //    + 안전망: /upload/, /image/content/, /image/detail/
  const contentPatterns = [
    /https:\/\/static\.skmagic\.com\/image\/editor\/goods_desc\/[^"'\s)<>]+\.(jpg|jpeg|png|gif|webp)/gi,
    /https:\/\/static\.skmagic\.com\/image\/editor\/event\/[^"'\s)<>]+\.(jpg|jpeg|png|gif|webp)/gi,
    /https:\/\/static\.skmagic\.com\/upload\/[^"'\s)<>]+\.(jpg|jpeg|png|gif|webp)/gi,
    /https:\/\/static\.skmagic\.com\/image\/content\/[^"'\s)<>]+\.(jpg|jpeg|png|gif|webp)/gi,
    /https:\/\/static\.skmagic\.com\/image\/detail\/[^"'\s)<>]+\.(jpg|jpeg|png|gif|webp)/gi,
  ];
  for (const pat of contentPatterns) {
    for (const m of html.matchAll(pat)) {
      const url = m[0];
      if (url.includes(galleryPrefix)) continue;
      // 작은 아이콘 / UI 요소 제외 — 경로 자체에 /icon/, /btn/, /nav/ 포함되면 스킵
      if (/\/(icon|btn|bg|sprite|nav|logo)\//i.test(url)) continue;
      if (/_(icon|btn|bg|sprite|nav|logo)_/i.test(url)) continue;
      contentImageSet.add(url);
    }
  }

  // 2) cheerio 본문 영역 selector — 보수적으로 detail/content 키워드만
  $(
    "#goodsDetailContent img, .goodsDetailContent img, " +
      ".detail-content img, .detailContent img, " +
      "[class*='goodsDetail'] img, [class*='product-detail'] img, " +
      ".prdDetail img, .prdDtl img"
  ).each((_, el) => {
    const raw = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-original") || "";
    if (!raw) return;
    const url = raw.startsWith("//") ? "https:" + raw
      : raw.startsWith("/") ? `https://www.skmagic.com${raw}`
      : raw;
    if (!/^https:\/\/(static\.)?skmagic\.com\//.test(url)) return;
    if (!/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) return;
    if (url.includes(galleryPrefix)) return;
    contentImageSet.add(url);
  });

  const contentImageUrls = [...contentImageSet].slice(0, 30);

  // ============ 스펙/주요스펙/고지정보 테이블 ============
  // 본사 detail 하단에는 약관·신용정보조회 안내까지 .tblCont로 마크업되어 있어
  // 무차별 추출 시 노이즈가 섞임. <h3>주요스펙</h3> 또는 <h3>고지정보</h3> 헤더
  // 직후의 테이블만 골라 추출한다. 첫 번째 제품정보 테이블(모델명/상품명)도 포함.
  const specs: Record<string, string> = {};
  const keyFeatures: string[] = [];
  let warrantyMonths: number | null = null;

  type Section = "product" | "feature" | "spec";

  // <table class="tblCont">을 모두 모은 뒤, 직전 sibling의 <h3>를 보고 분류
  const targetTables: Array<{ tableEl: unknown; section: Section }> = [];
  $("table.tblCont, table.tbl-cont").each((_, tbl) => {
    const $tbl = $(tbl);

    // popup/견적서/약관 영역 안에 있는 테이블은 제외
    if ($tbl.closest(".popup, .popLayer, .layPop, .popTit").length > 0) return;
    if ($tbl.parents().filter((_, el) => /pop|estimate|terms|agree/i.test($(el).attr("class") ?? "")).length > 0) return;

    // 직전 .title h3 또는 h3 텍스트 검색 — 같은 부모 형제 또는 부모의 부모 형제까지
    let header = "";
    let cur = $tbl;
    for (let i = 0; i < 4 && !header; i++) {
      const h3 = cur.prevAll(".title").first().find("h3").text().trim();
      if (h3) { header = h3; break; }
      const directH3 = cur.prevAll("h3").first().text().trim();
      if (directH3) { header = directH3; break; }
      cur = cur.parent();
    }

    // 명시적으로 식별 가능한 헤더만 채택. 그 외(견적서, 약관, 회사정보 등)는 모두 제외.
    let section: Section | null = null;
    if (header.includes("주요스펙") || header.includes("주요 스펙")) section = "feature";
    else if (header.includes("고지정보")) section = "spec";
    else if (header.includes("제품정보") || header.includes("제품 정보") || header.includes("기본정보") || header.includes("기본 정보")) section = "product";

    if (section) targetTables.push({ tableEl: tbl, section });
  });

  for (const { tableEl, section } of targetTables) {
    $(tableEl as never).find("tr").each((_, tr) => {
      const cells = $(tr).find("th, td").toArray();
      for (let i = 0; i < cells.length; i += 2) {
        const labelEl = cells[i];
        const valueEl = cells[i + 1];
        if (!labelEl || !valueEl) continue;
        if (!$(labelEl).is("th")) continue;

        const label = $(labelEl).text().trim();
        const value = $(valueEl).text().trim();
        if (!label || !value) continue;

        if (section === "feature") {
          // O/X 토글
          if (value === "O" || value === "o") {
            if (!keyFeatures.includes(label)) keyFeatures.push(label);
          }
          // X / - 는 무시
        } else {
          // product / spec — 일반 텍스트 스펙
          if (value === "-" || value === "X" || value === "x") continue;
          if (!(label in specs)) specs[label] = value;
          if (label.includes("품질보증") && /\d+\s*(년|개월)/.test(value)) {
            const yearMatch = value.match(/(\d+)\s*년/);
            const monthMatch = value.match(/(\d+)\s*개월/);
            if (yearMatch) warrantyMonths = Number(yearMatch[1]) * 12;
            else if (monthMatch) warrantyMonths = Number(monthMatch[1]);
          }
        }
      }
    });
  }

  // ============ description ============
  const prdName = $("h2.prdName").first().text().trim();
  const subCopy = $(".prdSubName, .sub_name, .prd_sub").first().text().trim();

  // 카테고리 라벨 + 핵심 keyFeatures를 자연어 문장으로 결합 — 본사가 짧은 카피만 주므로
  // "{prdName} — {subCopy}\n\n주요 특징: {keyFeatures.slice(0,5).join(', ')}" 같은 형태
  const descParts: string[] = [];
  if (prdName) descParts.push(prdName);
  if (subCopy && subCopy !== prdName) descParts.push(subCopy);
  if (keyFeatures.length > 0) {
    descParts.push(`주요 특징: ${keyFeatures.slice(0, 6).join(", ")}.`);
  }
  if (it.benefitTags) {
    descParts.push(it.benefitTags);
  }
  const description = descParts.length > 0 ? descParts.join("\n\n") : null;

  return {
    contractPeriod,
    managementType,
    rentalPriceFromDetail,
    cardDiscountFromDetail,
    description,
    imageUrls,
    contentImageUrls,
    keyFeatures,
    specs,
    warrantyMonths,
  };
}

export const skmagicAdapter: CrawlAdapter = {
  slug: "skmagic",
  name: "SK매직 공식몰",
  async fetch() {
    const warnings: string[] = [];
    const out: CrawledProductPayload[] = [];
    // 같은 productCode가 색상 옵션 차이로 중복 등장 → 첫 항목만 채택
    const seenProductCodes = new Set<string>();

    for (const cat of CATEGORIES) {
      let listed: ListedItem[] = [];
      try {
        listed = await fetchCategory(cat);
      } catch (e) {
        warnings.push(`category ${cat.categoryLabel} 목록 실패: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }

      for (const it of listed) {
        if (it.saleType !== "구독") continue;     // 분양몰 대상은 렌탈만
        if (!it.productCode) continue;
        if (seenProductCodes.has(it.productCode)) continue;
        seenProductCodes.add(it.productCode);

        let detail: Awaited<ReturnType<typeof enrichDetail>>;
        try {
          detail = await enrichDetail(it);
        } catch (e) {
          warnings.push(`상세 ${it.productCode} 실패: ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }

        const rentalPrice = detail.rentalPriceFromDetail ?? it.monthlyRental ?? 0;
        const cardDiscountPrice = detail.cardDiscountFromDetail ?? it.cardDiscount ?? null;
        const contractPeriod = detail.contractPeriod ?? 60;
        const managementType = detail.managementType
          ?? (it.benefitTags.includes("자가") ? "자가관리"
              : it.benefitTags.includes("방문") ? "방문관리"
              : "방문관리");

        // 갤러리 첫 이미지를 legacy imageUrl로 사용. 갤러리가 비어있으면 카드 썸네일.
        const primaryImage = detail.imageUrls[0] ?? it.thumbnail ?? null;

        out.push({
          sourceUrl: `${BASE}/goods/indexGoodsDetail?goodsId=${it.goodsId}`,
          productCode: it.productCode,
          category: refineCategory(it.productCode, cat.category),
          name: it.name,
          modelName: it.productCode,
          imageUrl: primaryImage,
          imageUrls: detail.imageUrls,
          rentalPrice,
          cardDiscountPrice,
          contractPeriod,
          managementType,
          description: detail.description,
          keyFeatures: detail.keyFeatures,
          specs: detail.specs,
          warrantyMonths: detail.warrantyMonths,
          rawData: {
            goodsId: it.goodsId,
            saleType: it.saleType,
            benefitTags: it.benefitTags,
            categoryLabel: cat.categoryLabel,
            modelCodeText: it.modelCodeText,
            contentImageUrls: detail.contentImageUrls,
          },
        });
      }
    }

    return { items: out, warnings };
  },
};
