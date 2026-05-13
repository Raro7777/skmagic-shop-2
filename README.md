# 렌트왕 (RentKing) — 분양형 SK매직 렌탈 플랫폼

본사(HQ) → 협력점(8곳) → 영업자(11명) 3계층 구조의 분양형 렌탈 플랫폼.
소비자 익명 신청 → 협력점 자동 분배 → 처리 → 자동 정산까지 끝-끝 자동화.

**Production**: https://rentking-next.vercel.app

---

## 빠른 시작

```bash
npm install
npx prisma generate
npx tsx --env-file=.env.local prisma/seed.ts        # 초기 시드
npm run dev
```

운영 자동화 스크립트는 [scripts/](#운영-스크립트) 참고.

---

## 시스템 개요

### 3계층 + 1소비자

| 계층 | 권한 | 콘솔 | 시드 수 |
|---|---|---|---|
| **본사 HQ** | hq | `/admin/super/*` | 1명 |
| **협력점 admin** | partner_admin | `/admin/franchise/*` | 8명 |
| **영업자(개인)** | seller | `/admin/seller/*` | 11명 |
| **소비자** | (익명) | `/apply`, `/p/[partnerCode]` | — |

모든 admin 계정 비번: `demo1234`

### 핵심 모델 (Prisma)

```
Partner ────┬─ User (hq | partner_admin | seller)
            │   └─ Seller (1:1 with role=seller User)
            ├─ Lead ─── LeadStatusLog
            │      └─ Settlement (status=done에서 자동 생성)
            ├─ PartnerPolicy ─── Product ─── HqPolicy
            ├─ Banner (협력점 직접 편성)
            └─ ApprovalRequest

Product ─┬─ priceMatrix (약정/모드별 가격 옵션)
         ├─ imageUrls (갤러리)
         ├─ specs (사양 테이블)
         ├─ keyFeatures (핵심 기능)
         └─ ProductChangeLog (변경 이력 — crawl/hq_policy/data_cleanup)

CrawlSource ─── CrawlRun ─── CrawledProduct (승인 큐)
```

### 분양 흐름 (E2E 검증 완료)

```
1. 소비자가 협력점 사이트(/p/[code]/products/[productCode])에서
   PriceConfigurator로 운영방식·약정·타사보상 선택
        ↓
2. ConsultForm 제출 → POST /api/leads (익명)
   → captureLead() — 룰북 9.1 1순위 자동 매칭
   → 협력점 자동 분배 + sellerCode 있으면 영업자 매핑
   → 선택 옵션이 Lead.selectedMode/Period/Rental 등에 스냅샷
        ↓
3. 협력점 OrderPipeline 또는 영업자 콘솔에 lead 등장
   → status: new → going → done 전이
   → status=done 시 트랜잭션 안에서 Settlement 자동 생성
   → baseCommission = HqPolicy.baseCommission + monthIncentive
        ↓
4. HQ /admin/super/settlements 에서 정산 확정/지급
```

---

## 디렉터리 구조

```
rentking-next/
├── prisma/
│   ├── schema.prisma         # 16개 모델
│   ├── migrations/           # 15개 마이그레이션
│   └── seed.ts               # 기본 시드 (3 partners + 5 products)
├── src/
│   ├── app/
│   │   ├── admin/            # 인증 콘솔 (HQ/협력점/영업자)
│   │   ├── api/              # 27개 라우트
│   │   ├── p/[partnerCode]/  # 협력점 분양 사이트 (소비자용)
│   │   ├── apply/            # 글로벌 신청 폼
│   │   ├── login/            # 로그인 (NextAuth)
│   │   └── legal/            # 약관/개인정보처리방침
│   ├── components/
│   │   ├── consumer/         # 분양 사이트 컴포넌트
│   │   ├── franchise/        # 협력점 콘솔 컴포넌트
│   │   ├── super/            # HQ 콘솔 컴포넌트
│   │   └── seller/           # 영업자 콘솔 컴포넌트
│   ├── lib/
│   │   ├── prisma.ts         # PrismaClient 인스턴스
│   │   ├── leadStore.ts      # captureLead, updateLeadStatus
│   │   ├── partnerSite.ts    # 분양 사이트 데이터 (categories, rankings, banners)
│   │   ├── crawler/          # 본사몰 크롤러 (skmagic, runner, types)
│   │   ├── franchiseDashboard.ts # OrderPipeline/InquiryQueue/MemoTimeline 데이터
│   │   ├── sellerDashboard.ts    # 영업자 KPI/lead/링크
│   │   └── (기타 헬퍼들)
│   ├── auth.ts               # NextAuth Credentials (5회 실패 → 10분 잠금)
│   └── proxy.ts              # 미들웨어 (Next 16 명: middleware → proxy)
├── scripts/                  # 23개 운영/시드/검증 스크립트
└── prisma.config.ts          # Prisma 7 datasource (URL 분리)
```

---

## 데이터 모델 요약

### Lead — 분양 흐름의 핵심

```ts
{
  id, customerName, phoneRaw, productInterest, productCode, region,
  partnerId, sellerId, ownerType,
  source: "consumer_form" | "kakao" | "phone",
  status: "new" | "going" | "done" | "warn",
  duplicateStatus: null | "possible" | "confirmed" | "bad_db",
  // 소비자가 선택한 옵션 (PriceConfigurator → ConsultForm)
  selectedMode, selectedContractPeriod,
  selectedRentalPrice, selectedCardDiscountPrice,
  rivalCompensationRequested,
  // UTM
  utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
  referrer, landingPath, deviceType,
  createdAt, updatedAt,
}
```

### Product — 마스터 + 풍부한 메타

```ts
{
  productCode (unique), category, name, modelName,
  imageUrl (legacy single), imageUrls[] (gallery),
  rentalPrice, cardDiscountPrice, contractPeriod,
  managementType, warrantyMonths,
  description, keyFeatures (string[]), specs (Record<string, string>),
  priceMatrix (PriceOption[] — 시트 기반 약정/모드별 옵션),
  isFeatured, status,
}
```

### HqPolicy / PartnerPolicy — 정산 정책

```
HqPolicy: { baseCommission, monthIncentive, refundLimitRatio, installSubsidy }
PartnerPolicy: { partnerId × productId, giftAmount, giftLabel, installAmount }
```

PartnerPolicy 환원(gift+install)이 HqPolicy 한도(baseCommission × 2/3)를 초과하면 본사 승인 필요.

### Banner — 협력점 자체 편성 이벤트

```ts
{
  partnerId, title, subtitle,
  bgColor1, bgColor2, textColor (그라디언트),
  ctaLabel, ctaHref,
  startsAt, endsAt, priority, status: "draft" | "active",
}
```

상태는 `status` + 시간 비교로 자동 산출 (now < starts → 예약, starts ≤ now ≤ ends → 진행중, now > ends → 종료).

### CrawlSource / CrawlRun / CrawledProduct — 본사몰 자동 동기화

룰북 19. 본사 공식몰 → 본사 검토 큐 → 승인 시 Product 마스터 반영.
- 신규 → Product 신규 생성 (imageUrls, keyFeatures, specs, warrantyMonths 모두 매핑)
- 변경 → 기본 필드(price/contract/etc)만 갱신, 빈 imageUrls/keyFeatures/specs는 보강 (HQ 직접 편집분 보존)
- 모든 변경은 `ProductChangeLog`에 source="crawl" 기록

### Partner.displayConfig — 룰북 26.1 진열 순서

```json
{ "picks": ["WPUJCC104SWH", "..."], "ranking": { "water": ["..."], "air": ["..."] } }
```

협력점이 `/admin/franchise/products`의 드래그 진열 편집기로 직접 편집.
없으면 `partnerSite.ts`에서 자동 산출 fallback.

---

## 라우트 맵

### 공개 페이지 (소비자)

| 경로 | 설명 |
|---|---|
| `/` | 허브 (협력점 목록) |
| `/p/[partnerCode]` | 협력점 메인 — Hero 카루셀(배너+상품 통합) + QUICK nav + 카테고리 랭킹 탭 + 점장 추천 |
| `/p/[partnerCode]/products` | 전체 상품 목록 |
| `/p/[partnerCode]/products/[productCode]` | 상품 상세 + PriceConfigurator + ConsultForm |
| `/p/[partnerCode]/category/[slug]` | 카테고리별 상품 |
| `/p/[partnerCode]/search?q=` | 상품 검색 |
| `/p/[partnerCode]/s/[sellerCode]` | 영업자 단독 페이지 (sellerId 매핑) |
| `/p/[partnerCode]/events` | 이벤트/사은품 페이지 |
| `/apply` | 글로벌 상담 신청 |
| `/login` | 로그인 |
| `/legal/{terms,privacy}` | 약관 · 개인정보처리방침 |

### HQ 콘솔 `/admin/super/*`

`/admin/super` 대시보드 / `partners` 협력점 / `products(/[code], /new)` 상품 / `policies` HqPolicy 직접 입력 / `settlements` 정산 / `approvals` 승인 큐 / `duplicates` 2·3순위 lead 판정 / `anomalies` 이상감지 / `analytics` UTM / `broadcasts` 공지 / `crawl(/queue)` 크롤러 큐 / `/admin/search` 글로벌 검색

### 협력점 admin 콘솔 `/admin/franchise/*`

`/admin/franchise` KPI + 실시간 lead + 정산 요약 / `leads` OrderPipeline + InquiryQueue + MemoTimeline / `sellers` 영업자 + 공유 링크 / `products` **드래그 진열 편집기** + 사은품 정책 + 배너 편성 / `settlements` 자기 협력점 정산 / `settings` 정보 / `analytics` 분석

### 영업자 콘솔 `/admin/seller/*`

`/admin/seller` KPI + 단계 카운트 + 최근 lead / `leads` 자기 lead 30건 + 옵션 칩 + 인라인 status 전이 / `links` 개인 분양 링크 + QR + 카톡 공유 문구

### API 27개

```
/api/auth/[...nextauth]       NextAuth (Credentials, JWT)
/api/leads                    POST(익명), GET(role scope)
/api/leads/[id]               PATCH/DELETE
/api/leads/[id]/status        PATCH (HQ/partner/seller 권한 분기)
/api/leads/[id]/history       GET (LeadStatusLog)
/api/leads/[id]/duplicate     POST (중복 판정)
/api/products                 POST
/api/products/[code]          GET (소비자 단)
/api/products/[code]/admin    GET/PATCH/DELETE (HQ 전용)
/api/policies/hq              GET (전체 product + hqPolicy)
/api/policies/hq/[code]       PATCH (upsert)
/api/policies/partner         GET (자기 협력점 전체)
/api/policies/partner/[code]  PATCH (한도 검증 + upsert)
/api/sellers                  GET/POST
/api/sellers/[id]             PATCH/DELETE
/api/settlements              GET (status 필터)
/api/approvals                GET
/api/approvals/[id]           PATCH (action: approve/reject/resolve)
/api/broadcasts               GET/POST
/api/broadcasts/[id]          PATCH/DELETE
/api/franchise/banners        GET/POST (자기 협력점)
/api/franchise/banners/[id]   PATCH/DELETE (소유 검증)
/api/franchise/display-config GET/PATCH (진열 순서)
/api/admin/crawl              POST (크롤 트리거)
/api/admin/crawl/[id]         PATCH (개별 승인/반려)
/api/admin/crawl/bulk         POST (일괄 승인/반려)
/api/apply                    POST (글로벌 신청)
```

---

## 인증 구조

- NextAuth v5 (Credentials provider, JWT 세션)
- bcryptjs 해시 round 10
- 잠금 정책: 5회 실패 → 10분 잠금 (`auth.ts` MAX_LOGIN_ATTEMPTS / LOCK_DURATION_MS)
- 미들웨어 `proxy.ts`: 라우트별 role 격리 + 자기 home으로 자동 리다이렉트
- 영업자(seller)는 별도 User 행 + Seller.userId 1:1 link
- 소비자는 회원가입 없음 — 익명 lead 제출만

---

## 운영 스크립트

`npx tsx --env-file=.env.local scripts/<name>.ts`로 실행.

| 스크립트 | 용도 |
|---|---|
| **검증** | |
| `health-check.ts` | 91건 (페이지 + API + 권한 + DB 정합성) 회귀 검사 |
| `test-end-to-end-flow.ts` | 분양 흐름 E2E (소비자 → 협력점 → 정산) |
| `test-seller-flow.ts` | 영업자 콘솔 E2E (로그인/권한 격리/lead 처리) |
| **시드** | |
| `add-partners.ts` | 협력점 5개 + admin + 영업자 시드 |
| `seed-seller-users.ts` | Seller 11명 → User 1:1 link 생성 |
| `seed-banners.ts` | 활성 배너 6건 시드 |
| `boost-pipeline-data.ts` | 데모 lead 14건 + LeadStatusLog 시드 |
| **크롤러** | |
| `test-crawl.ts` | skmagic.com 실 크롤 + 큐 적재 |
| `approve-all-pending.ts` | 검토 대기 큐 일괄 승인 |
| **정책** | |
| `parse-policy-xlsx.ts` | SK매직 4월 정책 시트 dry-run |
| `apply-policy-xlsx.ts` | 시트 → DB 적용 (Product 가격 + HqPolicy 수수료) |
| `apply-price-matrix.ts` | 시트의 약정/모드별 옵션을 priceMatrix에 적재 |
| `inspect-policy-xlsx.ts` | 시트 구조 inspect |
| **데이터 점검** | |
| `check-pipeline.ts` | 파트너별 lead 분포 |
| `check-price-display.ts` | 가격 정합성 (역전/동일 검사) |
| `fix-card-discount.ts` | cardDiscountPrice ≥ rentalPrice면 null로 정정 |
| `verify-policy.ts` | 정책 적용 spot-check |
| `check-user-pass.ts` | 시드 계정 + 비번 검증 |

---

## 시연 계정

모든 비번 `demo1234`.

```
HQ:               hq@rentking.kr
협력점 admin:
  강남센터 SK매직     gangnam@rentking.kr
  부천 SK매직 분양점   bucheon@rentking.kr
  분당 가전마을        bundang@rentking.kr
  잠실 SK매직 직영     jamsil@rentking.kr
  수원 가전월드        suwon@rentking.kr
  인천 라이프스타일     incheon@rentking.kr
  광주 SK매직 본부     gwangju@rentking.kr
  대전 충청 본점       daejeon@rentking.kr
영업자 11명 (이메일 형식: <sellerCode>@<partnerCode>.seller)
  예: park-jimin@gangnam-skmagic.seller
```

영업자 전체 목록은 `scripts/check-user-pass.ts`로 확인.

---

## 룰북 매핑 (구현 상태)

| 섹션 | 내용 | 상태 |
|---|---|---|
| 4.4 | 영업자 개인 콘솔 | ✅ |
| 5.3 | 지역 SEO landing | ❌ |
| 8.x | 권한 분리 (hq/partner_admin/seller) | ✅ |
| 9.1 | 중복 lead 1/2/3순위 자동 판정 | ✅ A5 (1순위 자동, 2/3순위 본사 큐) |
| 11.1 | UTM 캡처 | ✅ |
| 14 | 퇴점 처리 + 영업자 인계 | ❌ |
| 19 | 본사몰 크롤러 + 검토 큐 | ✅ |
| 19.5 | 크롤은 큐만 적재 (직접 갱신 X) | ✅ |
| 19.7 | CrawlRun 이력 + ProductChangeLog | ✅ |
| 19.8 | robots.txt + 800ms politeness | ✅ |
| 20.6 | Product 마스터 | ✅ |
| 20.7 | HqPolicy + 한도 ⅔ | ✅ |
| 20.9 | Lead | ✅ |
| 25 | 분양 패키지 tier 게이팅 | ❌ |
| 26.1 | 협력점 진열 순서 (드래그) | ✅ |
| A1 | 최초 접수 협력점 = 소유권 | ✅ |
| A2 | rentalPrice + cardDiscountPrice만 (promotion은 PartnerPolicy) | ✅ |
| A3 | 전화번호 = 자기 lead만, 다운로드 = HQ만 | ✅ |
| A5 | 1순위 자동 confirmed, 2~3순위 HQ 판정 | ✅ |

---

## 환경 변수

```bash
# .env.local
DATABASE_URL=                  # Pooled (런타임)
DATABASE_URL_UNPOOLED=         # Direct (Prisma migrate)
AUTH_SECRET=                   # NextAuth 32자+
AUTH_TRUST_HOST=true           # Vercel deploy
NEXT_PUBLIC_SITE_URL=          # 영업자 링크 페이지에서 사용
```

Vercel 프로덕션은 `vercel env pull`로 동기화.

---

## 알려진 제약

- **본사몰 이미지**: `static.skmagic.com` 직링 — 본사가 이미지 빼면 우리 사이트도 깨짐. Vercel Blob 자체 호스팅은 후속 작업.
- **타사보상**: 시트 정책이 명시되지 않아 placeholder ("월 5,000원 × 12개월")로 운영. 정확한 시트 들어오면 갱신.
- **카톡 채널톡**: mock 라벨만 있음 (real 연동 없음).
- **회원가입 (소비자)**: 미구현 (룰북상 우선순위 낮음).
- **자동 크롤 스케줄링**: Vercel Cron 미설정 (수동 트리거만).

---

## 라이센스

Proprietary — 렌트왕(주) 내부 프로젝트.
