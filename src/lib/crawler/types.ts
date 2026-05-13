// Crawler adapter contract — each source implements this.
// rulebook 19.3: 수집 대상 표준 필드.

export type CrawledProductPayload = {
  sourceUrl: string;
  productCode: string;        // canonical model code (e.g., "WPU-A700C")
  category: string;           // water | bidet | air | mattress | massage | dryer
  name: string;
  modelName: string;
  imageUrl?: string | null;       // 첫 갤러리 이미지 (legacy 단일 필드 호환용)
  imageUrls?: string[];           // 다중 갤러리 이미지 (Product.imageUrls 매핑)
  rentalPrice: number;
  cardDiscountPrice?: number | null;
  contractPeriod: number;
  managementType: string;
  description?: string | null;
  keyFeatures?: string[];         // 핵심 셀링포인트 — 본사 주요스펙 중 'O' 항목
  specs?: Record<string, string>; // 사양 정보 — 본사 고지정보/제품정보 테이블
  warrantyMonths?: number | null; // 본사 품질보증기간 (정확한 값을 못 찾으면 null)
  rawData?: Record<string, unknown>;
};

export type CrawlAdapter = {
  slug: string;
  name: string;
  fetch(): Promise<{ items: CrawledProductPayload[]; warnings?: string[] }>;
};
