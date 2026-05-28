/**
 * ops-data-auditor — 운영 DB 정합성 감사 (READ-ONLY)
 *
 * 21개 체크리스트:
 *   A. Lead 라이프사이클        (#1~#5)
 *   B. Banner / 컨텐츠 드리프트  (#6~#9)
 *   C. PartnerPolicy / VAT     (#10~#13)
 *   D. ApprovalRequest         (#14~#16)
 *   E. Seller                  (#17~#19)
 *   F. Footer                  (#20)
 *   G. 외부 의존성              (#21)
 *
 * NOTE: 데이터를 변경하는 SQL(INSERT/UPDATE/DELETE)은 절대 발행하지 않는다.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const HQ_TEMPLATE = "hq-template";
const HQ_HOTLINE = "1600-2434";

// "현재 going(영업자 작업 중) 단계로 볼만한" status 묶음.
// 룰북 14단계 중 closed/settle_*/install_done/install_cancel 을 제외하면
// 영업자가 실제로 들고있는(=방치 위험) 단계만 남는다.
const GOING_STATUSES = [
  "consult_wish",
  "consult_active",
  "form_ready",
  "apply_submitted",
  "verify_pending",
  "verify_passed",
  "verify_failed",
  "verify_revise",
  "revise_resubmit",
  "install_pending",
];

type Finding = {
  id: number;
  severity: "P0" | "P1" | "P2";
  title: string;
  rule: string;        // SQL/조건 한 줄
  count: number;
  samples?: string[];  // 대표 row 일부
};

const findings: Finding[] = [];
const okIds: number[] = [];

function record(f: Finding) { findings.push(f); }
function ok(id: number) { okIds.push(id); }

async function main() {
  const now = new Date();
  const thirty = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const seven = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ──────────────────────────────────────────────────────────────────
  // A. Lead 라이프사이클
  // ──────────────────────────────────────────────────────────────────

  // #1 going 인데 updatedAt < now-30d
  {
    const rows = await prisma.lead.findMany({
      where: { status: { in: GOING_STATUSES }, updatedAt: { lt: thirty } },
      select: { id: true, customerName: true, status: true, partnerId: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: 8,
    });
    const total = await prisma.lead.count({
      where: { status: { in: GOING_STATUSES }, updatedAt: { lt: thirty } },
    });
    if (total > 0) {
      record({
        id: 1, severity: "P1",
        title: "영업자 방치 lead (going & 30일+ updatedAt)",
        rule: "lead.status IN (going_set) AND updatedAt < now()-interval '30 day'",
        count: total,
        samples: rows.map(r => `lead=${r.id.slice(0, 8)} status=${r.status} partner=${r.partnerId ?? "—"} updated=${r.updatedAt.toISOString().slice(0, 10)}`),
      });
    } else ok(1);
  }

  // #2 install_done 인데 Settlement row 없음
  {
    const rows = await prisma.lead.findMany({
      where: { status: "install_done", settlement: { is: null } },
      select: { id: true, partnerId: true, customerName: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });
    const total = await prisma.lead.count({
      where: { status: "install_done", settlement: { is: null } },
    });
    if (total > 0) {
      record({
        id: 2, severity: "P0",
        title: "install_done 인데 Settlement 미생성 (정산 누락)",
        rule: "lead.status='install_done' AND Settlement WHERE leadId=lead.id 없음",
        count: total,
        samples: rows.map(r => `lead=${r.id.slice(0, 8)} partner=${r.partnerId ?? "—"} updated=${r.updatedAt.toISOString().slice(0, 10)}`),
      });
    } else ok(2);
  }

  // #3 settle_* 인데 Settlement.partnerCommission/netPayout = 0 OR NULL
  // schema 상 baseCommission/netPayout은 NOT NULL Int 라 NULL 은 불가, 0 만 검사
  {
    const rows: { id: string; leadId: string; partnerId: string; baseCommission: number; netPayout: number; partnerCommission: number }[] = await prisma.$queryRaw`
      SELECT s.id, s."leadId", s."partnerId", s."baseCommission", s."netPayout", s."partnerCommission"
        FROM "Settlement" s
        JOIN "Lead" l ON l.id = s."leadId"
       WHERE l.status IN ('settle_pending','settle_done')
         AND (
           s."baseCommission" = 0
           OR s."netPayout"    = 0
           OR s."partnerCommission" = 0
         )
       ORDER BY s."createdAt" DESC
       LIMIT 8
    `;
    const cnt: { c: bigint }[] = await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS c
        FROM "Settlement" s
        JOIN "Lead" l ON l.id = s."leadId"
       WHERE l.status IN ('settle_pending','settle_done')
         AND (s."baseCommission" = 0 OR s."netPayout" = 0 OR s."partnerCommission" = 0)
    `;
    const total = Number(cnt[0]?.c ?? 0);
    if (total > 0) {
      record({
        id: 3, severity: "P0",
        title: "settle 단계인데 Settlement 금액 0 (계산 실패)",
        rule: "lead.status IN ('settle_pending','settle_done') AND (baseCommission=0 OR netPayout=0 OR partnerCommission=0)",
        count: total,
        samples: rows.map(r => `settle=${r.id.slice(0, 8)} lead=${r.leadId.slice(0, 8)} base=${r.baseCommission} net=${r.netPayout}`),
      });
    } else ok(3);
  }

  // #4 status='settle_done' 인데 처리자가 hq 아님
  // 마지막 LeadStatusLog (newStatus='settle_done') 의 changedById → User.role
  {
    const offending: { lead_id: string; user_id: string; role: string; email: string }[] = await prisma.$queryRaw`
      SELECT DISTINCT l.id AS lead_id, u.id AS user_id, u.role, u.email
        FROM "Lead" l
        JOIN LATERAL (
          SELECT lsl."changedById"
            FROM "LeadStatusLog" lsl
           WHERE lsl."leadId" = l.id
             AND lsl."newStatus" = 'settle_done'
           ORDER BY lsl."createdAt" DESC
           LIMIT 1
        ) last_log ON TRUE
        JOIN "User" u ON u.id = last_log."changedById"
       WHERE l.status = 'settle_done'
         AND u.role <> 'hq'
       LIMIT 8
    `;
    if (offending.length > 0) {
      record({
        id: 4, severity: "P0",
        title: "settle_done 전이를 비-hq 사용자가 수행 (권한 침범)",
        rule: "LeadStatusLog (newStatus='settle_done') 의 changedBy User.role != 'hq'",
        count: offending.length,
        samples: offending.map(o => `lead=${o.lead_id.slice(0, 8)} actor=${o.email} role=${o.role}`),
      });
    } else ok(4);

    // 룰북 변경분 — install_done 도 본사 전담 (MEMORY: project_install_done_hq_only)
    const offendingInstall: { lead_id: string; user_id: string; role: string; email: string }[] = await prisma.$queryRaw`
      SELECT DISTINCT l.id AS lead_id, u.id AS user_id, u.role, u.email
        FROM "Lead" l
        JOIN LATERAL (
          SELECT lsl."changedById"
            FROM "LeadStatusLog" lsl
           WHERE lsl."leadId" = l.id
             AND lsl."newStatus" = 'install_done'
           ORDER BY lsl."createdAt" DESC
           LIMIT 1
        ) last_log ON TRUE
        JOIN "User" u ON u.id = last_log."changedById"
       WHERE l.status IN ('install_done','settle_pending','settle_done')
         AND u.role <> 'hq'
       LIMIT 8
    `;
    if (offendingInstall.length > 0) {
      record({
        id: 4, severity: "P0",
        title: "install_done 전이를 비-hq 사용자가 수행 (룰북: install_done 본사 전담)",
        rule: "LeadStatusLog (newStatus='install_done') 의 changedBy User.role != 'hq'",
        count: offendingInstall.length,
        samples: offendingInstall.map(o => `lead=${o.lead_id.slice(0, 8)} actor=${o.email} role=${o.role}`),
      });
    }
  }

  // #5 동일 customer phone 30일내 3건+
  {
    const rows: { phoneraw: string; cnt: bigint }[] = await prisma.$queryRaw`
      SELECT "phoneRaw" AS phoneraw, COUNT(*)::bigint AS cnt
        FROM "Lead"
       WHERE "createdAt" >= NOW() - INTERVAL '30 day'
       GROUP BY "phoneRaw"
      HAVING COUNT(*) >= 3
       ORDER BY COUNT(*) DESC
       LIMIT 10
    `;
    if (rows.length > 0) {
      record({
        id: 5, severity: "P1",
        title: "동일 연락처 30일내 3건 이상 중복 lead",
        rule: "GROUP BY phoneRaw HAVING COUNT(*) >=3 WITHIN createdAt 30d",
        count: rows.length,
        samples: rows.map(r => `phone=${r.phoneraw.replace(/(\d{3})(\d{3,4})(\d{4})/, "$1-***-$3")} cnt=${r.cnt}`),
      });
    } else ok(5);
  }

  // ──────────────────────────────────────────────────────────────────
  // B. Banner / 컨텐츠 드리프트
  // ──────────────────────────────────────────────────────────────────

  // #6 Banner.partnerId 가 Partner 에 없음 (orphan)
  {
    const rows: { id: string; partner_id: string; title: string }[] = await prisma.$queryRaw`
      SELECT b.id, b."partnerId" AS partner_id, b.title
        FROM "Banner" b
       WHERE b."partnerId" IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM "Partner" p WHERE p."partnerCode" = b."partnerId"
         )
       LIMIT 10
    `;
    if (rows.length > 0) {
      record({
        id: 6, severity: "P1",
        title: "Banner.partnerId 가 Partner 에 없음 (orphan)",
        rule: "Banner LEFT JOIN Partner ON partnerCode=Banner.partnerId WHERE Partner.id IS NULL",
        count: rows.length,
        samples: rows.map(r => `banner=${r.id.slice(0, 8)} partnerId=${r.partner_id} title="${r.title.slice(0, 30)}"`),
      });
    } else ok(6);
  }

  // #7 sourceTemplateId='hq-template' marker 박힌 배너 수 vs hq-template 본체 배너 수
  // 의미: "본사가 sourceTemplateId 로 hq-template 마커를 박은 협력점 배너 카피 수"
  //       vs "hq-template Partner 가 자기 자신에게 가진 partner-scope 배너 수"
  //       위 두 수가 0:N 비정상이면 push 누락이나 drift.
  {
    const hqTemplateBannerCount = await prisma.banner.count({
      where: { partnerId: HQ_TEMPLATE, scope: "partner" },
    });
    const taggedCopies = await prisma.banner.count({
      where: { sourceTemplateId: HQ_TEMPLATE, partnerId: { not: HQ_TEMPLATE } },
    });
    // 활성 협력점 카운트
    const activePartners = await prisma.partner.count({
      where: { status: "active", partnerCode: { not: HQ_TEMPLATE } },
    });
    const expected = hqTemplateBannerCount * activePartners;
    const drift = expected - taggedCopies;

    if (hqTemplateBannerCount === 0) {
      record({
        id: 7, severity: "P1",
        title: "hq-template Partner 에 partner-scope 배너 0건 (본사 표준 미보유)",
        rule: "Banner WHERE partnerId='hq-template' AND scope='partner' COUNT=0",
        count: 0,
        samples: [`hq-template banners=0, 활성 협력점=${activePartners}, tagged copies=${taggedCopies}`],
      });
    } else if (drift > 0) {
      record({
        id: 7, severity: "P2",
        title: "hq-template 표준 배너 카피 수 부족 (예상 vs 실제)",
        rule: "expected = (hq-template scope=partner banners) × (active partners 제외 hq-template); copies = Banner WHERE sourceTemplateId='hq-template'",
        count: drift,
        samples: [`hq-template banners=${hqTemplateBannerCount}, 활성 협력점=${activePartners}, expected=${expected}, tagged copies=${taggedCopies}, missing≈${drift}`],
      });
    } else ok(7);
  }

  // #8 hq-template 변경 후 push 누락 협력점
  // 정의: hq-template 의 partner-scope 배너 중 updatedAt > 어떤 협력점의 sourceTemplateId='hq-template' 카피 updatedAt
  //       → 카피보다 최신본이 본사에 있음
  // 단순화: 활성 협력점 중 sourceTemplateId='hq-template' 카피 0건인 곳 (push 안 받은 곳)
  {
    const hqHas = await prisma.banner.count({ where: { partnerId: HQ_TEMPLATE, scope: "partner" } });
    if (hqHas === 0) {
      ok(8); // hq-template 없으면 push 자체 의미 없음
    } else {
      const partners: { partner_code: string; partner_name: string; copies: bigint }[] = await prisma.$queryRaw`
        SELECT p."partnerCode" AS partner_code, p."partnerName" AS partner_name,
               COALESCE((
                 SELECT COUNT(*)::bigint FROM "Banner" b
                  WHERE b."partnerId" = p."partnerCode"
                    AND b."sourceTemplateId" = ${HQ_TEMPLATE}
               ), 0) AS copies
          FROM "Partner" p
         WHERE p.status = 'active'
           AND p."partnerCode" <> ${HQ_TEMPLATE}
      `;
      const missing = partners.filter(p => Number(p.copies) < hqHas);
      if (missing.length > 0) {
        record({
          id: 8, severity: "P1",
          title: "hq-template 표준 배너를 다 받지 못한 협력점 (push 누락 의심)",
          rule: "active Partner WHERE COUNT(Banner sourceTemplateId='hq-template') < hq-template scope=partner banner count",
          count: missing.length,
          samples: missing.slice(0, 8).map(m => `${m.partner_name} (${m.partner_code}) copies=${m.copies}/${hqHas}`),
        });
      } else ok(8);
    }
  }

  // #9 Partner.theme/sellerMargin/rentalSupport NULL/0  (활성 협력점만)
  {
    const partners = await prisma.partner.findMany({
      where: { status: "active", partnerCode: { not: HQ_TEMPLATE } },
      select: {
        partnerCode: true, partnerName: true,
        theme: true, sellerMarginAmount: true, sellerMarginPercent: true,
        rentalSupportAmount: true,
      },
    });
    const issues = partners.filter(p =>
      !p.theme || p.theme === "" || p.theme === "default" ||
      (p.sellerMarginAmount === 0 && p.sellerMarginPercent === 0) ||
      p.rentalSupportAmount === 0
    );
    if (issues.length > 0) {
      record({
        id: 9, severity: "P2",
        title: "Partner.theme/sellerMargin/rentalSupport 가 미설정·0 (운영 표준 미달)",
        rule: "Partner status='active' AND (theme IS NULL/'default' OR (sellerMarginAmount=0 AND sellerMarginPercent=0) OR rentalSupportAmount=0)",
        count: issues.length,
        samples: issues.slice(0, 8).map(p => `${p.partnerName} (${p.partnerCode}) theme=${p.theme} sellerMargin=${p.sellerMarginAmount}/${p.sellerMarginPercent} rentalSupport=${p.rentalSupportAmount}`),
      });
    } else ok(9);
  }

  // ──────────────────────────────────────────────────────────────────
  // C. PartnerPolicy / VAT
  // ──────────────────────────────────────────────────────────────────

  // #10 giftAmount/installAmount 음수 or > 500만원 (=5_000_000)
  {
    const rows = await prisma.partnerPolicy.findMany({
      where: {
        OR: [
          { giftAmount: { lt: 0 } },
          { giftAmount: { gt: 5_000_000 } },
          { installAmount: { lt: 0 } },
          { installAmount: { gt: 5_000_000 } },
        ],
      },
      select: { id: true, partnerId: true, productId: true, giftAmount: true, installAmount: true },
      take: 10,
    });
    if (rows.length > 0) {
      record({
        id: 10, severity: "P0",
        title: "PartnerPolicy gift/install 금액이 음수 또는 500만원 초과",
        rule: "PartnerPolicy WHERE giftAmount<0 OR giftAmount>5000000 OR installAmount<0 OR installAmount>5000000",
        count: rows.length,
        samples: rows.map(r => `policy=${r.id.slice(0, 8)} partner=${r.partnerId} product=${r.productId.slice(0, 8)} gift=${r.giftAmount} install=${r.installAmount}`),
      });
    } else ok(10);
  }

  // #11 (partnerId, productId) 중복  — DB 에 @@unique 가 걸려있어 normally 불가능하지만 확인
  {
    const rows: { partner_id: string; product_id: string; cnt: bigint }[] = await prisma.$queryRaw`
      SELECT "partnerId" AS partner_id, "productId" AS product_id, COUNT(*)::bigint AS cnt
        FROM "PartnerPolicy"
       GROUP BY "partnerId", "productId"
      HAVING COUNT(*) > 1
       LIMIT 10
    `;
    if (rows.length > 0) {
      record({
        id: 11, severity: "P0",
        title: "PartnerPolicy (partnerId, productId) 중복",
        rule: "GROUP BY (partnerId, productId) HAVING COUNT(*) > 1",
        count: rows.length,
        samples: rows.map(r => `partner=${r.partner_id} product=${r.product_id.slice(0, 8)} cnt=${r.cnt}`),
      });
    } else ok(11);
  }

  // #12 Product status='discontinued' 인데 PartnerPolicy 살아있음
  {
    const rows: { policy_id: string; partner_id: string; product_code: string }[] = await prisma.$queryRaw`
      SELECT pp.id AS policy_id, pp."partnerId" AS partner_id, p."productCode" AS product_code
        FROM "PartnerPolicy" pp
        JOIN "Product" p ON p.id = pp."productId"
       WHERE p.status = 'discontinued'
       LIMIT 10
    `;
    if (rows.length > 0) {
      record({
        id: 12, severity: "P1",
        title: "단종된 Product 에 PartnerPolicy 잔존",
        rule: "PartnerPolicy JOIN Product WHERE Product.status='discontinued'",
        count: rows.length,
        samples: rows.map(r => `policy=${r.policy_id.slice(0, 8)} partner=${r.partner_id} product=${r.product_code}`),
      });
    } else ok(12);
  }

  // #13 PartnerPolicy.sellerMarginAmount override > Partner.sellerMarginAmount (역전)
  // percent 도 같이 검사
  {
    const rows: { policy_id: string; partner_id: string; pp_amount: number | null; p_amount: number; pp_percent: number | null; p_percent: number }[] = await prisma.$queryRaw`
      SELECT pp.id AS policy_id, pp."partnerId" AS partner_id,
             pp."sellerMarginAmount" AS pp_amount, p."sellerMarginAmount" AS p_amount,
             pp."sellerMarginPercent" AS pp_percent, p."sellerMarginPercent" AS p_percent
        FROM "PartnerPolicy" pp
        JOIN "Partner" p ON p."partnerCode" = pp."partnerId"
       WHERE
            (pp."sellerMarginAmount"  IS NOT NULL AND pp."sellerMarginAmount"  > p."sellerMarginAmount")
         OR (pp."sellerMarginPercent" IS NOT NULL AND pp."sellerMarginPercent" > p."sellerMarginPercent")
       LIMIT 10
    `;
    if (rows.length > 0) {
      record({
        id: 13, severity: "P1",
        title: "PartnerPolicy.sellerMargin override 가 Partner 기본값보다 큼 (역전)",
        rule: "PartnerPolicy.sellerMarginAmount > Partner.sellerMarginAmount  OR  sellerMarginPercent override 역전",
        count: rows.length,
        samples: rows.map(r => `policy=${r.policy_id.slice(0, 8)} partner=${r.partner_id} override=${r.pp_amount}/${r.pp_percent} base=${r.p_amount}/${r.p_percent}`),
      });
    } else ok(13);
  }

  // ──────────────────────────────────────────────────────────────────
  // D. ApprovalRequest
  // ──────────────────────────────────────────────────────────────────

  // #14 pending 7일+
  {
    const rows = await prisma.approvalRequest.findMany({
      where: { status: "pending", createdAt: { lt: seven } },
      select: { id: true, kind: true, title: true, createdAt: true, requestedByEmail: true },
      orderBy: { createdAt: "asc" },
      take: 8,
    });
    const total = await prisma.approvalRequest.count({
      where: { status: "pending", createdAt: { lt: seven } },
    });
    if (total > 0) {
      record({
        id: 14, severity: "P1",
        title: "ApprovalRequest pending 7일 이상 stale",
        rule: "ApprovalRequest WHERE status='pending' AND createdAt < now()-7d",
        count: total,
        samples: rows.map(r => `req=${r.id.slice(0, 8)} kind=${r.kind} created=${r.createdAt.toISOString().slice(0, 10)} email=${r.requestedByEmail ?? "—"}`),
      });
    } else ok(14);
  }

  // #15 approved 인데 partnerId NULL
  //   주의: partner_signup 의 경우 신청자가 Partner 생성 전이라 NULL 인 게 정상일 수 있음.
  //         그래서 kind != 'partner_signup' 만 검사.
  {
    const rows = await prisma.approvalRequest.findMany({
      where: { status: "approved", partnerId: null, kind: { not: "partner_signup" } },
      select: { id: true, kind: true, title: true, requestedByEmail: true },
      take: 8,
    });
    const total = await prisma.approvalRequest.count({
      where: { status: "approved", partnerId: null, kind: { not: "partner_signup" } },
    });
    if (total > 0) {
      record({
        id: 15, severity: "P1",
        title: "ApprovalRequest approved 인데 partnerId NULL (partner_signup 제외)",
        rule: "ApprovalRequest WHERE status='approved' AND partnerId IS NULL AND kind <> 'partner_signup'",
        count: total,
        samples: rows.map(r => `req=${r.id.slice(0, 8)} kind=${r.kind} title="${r.title.slice(0, 30)}"`),
      });
    } else ok(15);
  }

  // #16 applicationData JSON 필수필드 NULL (partner_signup 만 대상; 사업자번호/대표자/주소)
  {
    const rows = await prisma.approvalRequest.findMany({
      where: { kind: "partner_signup" },
      select: { id: true, status: true, title: true, applicationData: true, requestedByEmail: true },
    });
    const REQUIRED = ["businessNumber", "ownerName", "address"];
    // applicationData 는 자유 JSON — 룰북상 분양 신청서가 받는 필드명은
    // src/components/PartnerSignupForm 기준이지만 여기는 raw 키만 확인.
    // 대체 키도 허용: ownerName ⊂ {representative, ceo, ownerName}
    const ALT: Record<string, string[]> = {
      businessNumber: ["businessNumber", "bizNumber", "사업자번호"],
      ownerName:      ["ownerName", "representative", "ceoName", "대표자", "ceo"],
      address:        ["address", "businessAddress", "주소"],
    };
    function missing(d: any): string[] {
      if (!d || typeof d !== "object") return REQUIRED;
      return REQUIRED.filter(k => !ALT[k].some(alt => d[alt] !== undefined && d[alt] !== null && d[alt] !== ""));
    }
    const offending = rows
      .map(r => ({ r, miss: missing(r.applicationData) }))
      .filter(x => x.miss.length > 0);
    if (offending.length > 0) {
      record({
        id: 16, severity: "P1",
        title: "partner_signup applicationData 필수필드 누락 (businessNumber/ownerName/address)",
        rule: "ApprovalRequest.kind='partner_signup' AND applicationData->>(businessNumber|ownerName|address) 누락",
        count: offending.length,
        samples: offending.slice(0, 8).map(x =>
          `req=${x.r.id.slice(0, 8)} status=${x.r.status} missing=[${x.miss.join(", ")}] email=${x.r.requestedByEmail ?? "—"}`
        ),
      });
    } else ok(16);
  }

  // ──────────────────────────────────────────────────────────────────
  // E. Seller
  // ──────────────────────────────────────────────────────────────────

  // #17 Seller.partnerId orphan  (Partner.partnerCode 없음)
  {
    const rows: { id: string; partner_id: string; name: string }[] = await prisma.$queryRaw`
      SELECT s.id, s."partnerId" AS partner_id, s.name
        FROM "Seller" s
       WHERE NOT EXISTS (
         SELECT 1 FROM "Partner" p WHERE p."partnerCode" = s."partnerId"
       )
       LIMIT 10
    `;
    if (rows.length > 0) {
      record({
        id: 17, severity: "P0",
        title: "Seller.partnerId 가 Partner 에 없음 (orphan)",
        rule: "Seller LEFT JOIN Partner ON partnerCode=Seller.partnerId WHERE Partner.id IS NULL",
        count: rows.length,
        samples: rows.map(r => `seller=${r.id.slice(0, 8)} partnerId=${r.partner_id} name=${r.name}`),
      });
    } else ok(17);
  }

  // #18 Seller.email 중복
  //   schema 상 unique 가 아님 (Seller.email 은 String? without @unique).
  {
    const rows: { email: string; cnt: bigint }[] = await prisma.$queryRaw`
      SELECT email, COUNT(*)::bigint AS cnt
        FROM "Seller"
       WHERE email IS NOT NULL AND email <> ''
       GROUP BY email
      HAVING COUNT(*) > 1
       LIMIT 10
    `;
    if (rows.length > 0) {
      record({
        id: 18, severity: "P1",
        title: "Seller.email 중복",
        rule: "GROUP BY Seller.email HAVING COUNT(*) > 1 (NULL/'' 제외)",
        count: rows.length,
        samples: rows.map(r => `email=${r.email} cnt=${r.cnt}`),
      });
    } else ok(18);
  }

  // #19 Partner active 인데 sellers 0명
  {
    const rows: { partner_code: string; partner_name: string }[] = await prisma.$queryRaw`
      SELECT p."partnerCode" AS partner_code, p."partnerName" AS partner_name
        FROM "Partner" p
       WHERE p.status = 'active'
         AND p."partnerCode" <> ${HQ_TEMPLATE}
         AND NOT EXISTS (
           SELECT 1 FROM "Seller" s
            WHERE s."partnerId" = p."partnerCode"
              AND s.status = 'active'
         )
       LIMIT 20
    `;
    if (rows.length > 0) {
      record({
        id: 19, severity: "P2",
        title: "active Partner 인데 active Seller 0명",
        rule: "Partner status='active' AND NOT EXISTS active Seller WHERE partnerId=Partner.partnerCode",
        count: rows.length,
        samples: rows.slice(0, 8).map(r => `${r.partner_name} (${r.partner_code})`),
      });
    } else ok(19);
  }

  // ──────────────────────────────────────────────────────────────────
  // F. Footer
  // ──────────────────────────────────────────────────────────────────

  // #20 협력점 footer 에 본사 핫라인 1600-2434 노출
  //   Partner.hotlineNumber 기본값이 1600-2434 라서 이건 룰 위반 (MEMORY: project_partner_footer_fields).
  //   추가로 Seller override 도 검사.
  {
    const partnerRows = await prisma.partner.findMany({
      where: {
        status: "active",
        partnerCode: { not: HQ_TEMPLATE },
        hotlineNumber: HQ_HOTLINE,
      },
      select: { partnerCode: true, partnerName: true, hotlineNumber: true },
    });
    const sellerRows = await prisma.seller.findMany({
      where: { status: "active", hotlineNumber: HQ_HOTLINE },
      select: { id: true, name: true, partnerId: true, hotlineNumber: true },
      take: 8,
    });
    const partnerCount = partnerRows.length;
    const sellerCount = await prisma.seller.count({ where: { status: "active", hotlineNumber: HQ_HOTLINE } });
    const total = partnerCount + sellerCount;
    if (total > 0) {
      record({
        id: 20, severity: "P0",
        title: "협력점/영업자 footer 에 본사 핫라인 1600-2434 노출 (룰북 위반)",
        rule: "Partner status='active' AND hotlineNumber='1600-2434'  +  Seller status='active' AND hotlineNumber='1600-2434'",
        count: total,
        samples: [
          ...partnerRows.slice(0, 5).map(p => `[Partner] ${p.partnerName} (${p.partnerCode}) → ${p.hotlineNumber}`),
          ...sellerRows.slice(0, 3).map(s => `[Seller] ${s.name} (partner=${s.partnerId}) → ${s.hotlineNumber}`),
        ],
      });
    } else ok(20);
  }

  // ──────────────────────────────────────────────────────────────────
  // G. 외부 의존성 — Banner.imageUrl HEAD 200 안 되는 것 (sample 10)
  // ──────────────────────────────────────────────────────────────────

  // #21 imageUrl HEAD 체크 (활성 협력점 + hq-template 배너 위주 sample 10)
  {
    const sample = await prisma.banner.findMany({
      where: {
        imageUrl: { not: null },
        OR: [
          { partnerId: HQ_TEMPLATE },
          { partner: { status: "active" } },
          { scope: "global" },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, partnerId: true, title: true, imageUrl: true },
    });
    const broken: { id: string; partnerId: string | null; url: string; statusCode: number | string }[] = [];
    for (const b of sample) {
      if (!b.imageUrl) continue;
      try {
        const res = await fetch(b.imageUrl, { method: "HEAD", redirect: "follow" });
        if (!res.ok) {
          broken.push({ id: b.id, partnerId: b.partnerId, url: b.imageUrl, statusCode: res.status });
        }
      } catch (e: any) {
        broken.push({ id: b.id, partnerId: b.partnerId, url: b.imageUrl, statusCode: e?.message?.slice(0, 30) ?? "ERR" });
      }
    }
    if (broken.length > 0) {
      record({
        id: 21, severity: "P1",
        title: "Banner.imageUrl HEAD 응답 비정상 (sample 10건 중)",
        rule: "fetch(imageUrl, HEAD).ok === false  ON  ORDER BY updatedAt DESC LIMIT 10",
        count: broken.length,
        samples: broken.map(b => `banner=${b.id.slice(0, 8)} status=${b.statusCode} url=${b.url.slice(0, 70)}`),
      });
    } else ok(21);
  }

  // ──────────────────────────────────────────────────────────────────
  // baseline 카운트
  // ──────────────────────────────────────────────────────────────────
  const baseline = {
    leadGoingStale: await prisma.lead.count({ where: { status: { in: GOING_STATUSES }, updatedAt: { lt: thirty } } }),
    settlementMissing: await prisma.lead.count({ where: { status: "install_done", settlement: { is: null } } }),
    approvalPendingStale: await prisma.approvalRequest.count({ where: { status: "pending", createdAt: { lt: seven } } }),
    hqDriftPartners: (() => 0)(), // populated below
    leadTotal: await prisma.lead.count(),
    settlementTotal: await prisma.settlement.count(),
    partnerActive: await prisma.partner.count({ where: { status: "active", partnerCode: { not: HQ_TEMPLATE } } }),
    sellerActive: await prisma.seller.count({ where: { status: "active" } }),
    bannerTotal: await prisma.banner.count(),
    approvalPending: await prisma.approvalRequest.count({ where: { status: "pending" } }),
    productActive: await prisma.product.count({ where: { status: "active" } }),
    productDiscontinued: await prisma.product.count({ where: { status: "discontinued" } }),
  };
  // hq drift partners
  {
    const hqHas = await prisma.banner.count({ where: { partnerId: HQ_TEMPLATE, scope: "partner" } });
    if (hqHas > 0) {
      const partners: { partner_code: string; copies: bigint }[] = await prisma.$queryRaw`
        SELECT p."partnerCode" AS partner_code,
               COALESCE((SELECT COUNT(*)::bigint FROM "Banner" b WHERE b."partnerId" = p."partnerCode" AND b."sourceTemplateId" = ${HQ_TEMPLATE}), 0) AS copies
          FROM "Partner" p
         WHERE p.status='active' AND p."partnerCode" <> ${HQ_TEMPLATE}
      `;
      (baseline as any).hqDriftPartners = partners.filter(p => Number(p.copies) < hqHas).length;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // 리포트 출력
  // ──────────────────────────────────────────────────────────────────
  const ts = new Date().toISOString().replace("T", " ").slice(0, 16);
  console.log(`\n운영 데이터 감사 결과 — ${ts}\n`);

  const p0 = findings.filter(f => f.severity === "P0");
  const p1 = findings.filter(f => f.severity === "P1");
  const p2 = findings.filter(f => f.severity === "P2");

  const printGroup = (label: string, list: Finding[]) => {
    console.log(label + ":");
    if (list.length === 0) { console.log("  (없음)\n"); return; }
    for (const f of list) {
      console.log(`  - [#${f.id}] ${f.title}  →  ${f.count}건`);
      console.log(`     where: ${f.rule}`);
      if (f.samples && f.samples.length) {
        for (const s of f.samples.slice(0, 6)) console.log(`       · ${s}`);
      }
    }
    console.log("");
  };

  printGroup("🔴 P0", p0);
  printGroup("🟠 P1", p1);
  printGroup("🟡 P2", p2);

  const okSorted = [...new Set(okIds)].sort((a, b) => a - b);
  console.log(`✅ 정상: [${okSorted.map(n => `#${n}`).join(", ")}]\n`);

  console.log("조치 권장:");
  const recs: string[] = [];
  if (p0.length) recs.push("P0 우선 처리 — production cut-over 차단 수준 (정산/권한/orphan/금액 이상)");
  if (findings.some(f => f.id === 2)) recs.push("#2 install_done → Settlement 자동 생성 hook 점검 (룰북 20.13)");
  if (findings.some(f => f.id === 4)) recs.push("#4 install_done/settle_done 전이 권한가드 점검 (MEMORY: install_done은 role=hq 만)");
  if (findings.some(f => f.id === 10)) recs.push("#10 PartnerPolicy gift/install 범위 가드 추가 (UI/API 양쪽)");
  if (findings.some(f => f.id === 13)) recs.push("#13 sellerMargin 역전 — PartnerPolicy override 검증 로직 점검");
  if (findings.some(f => f.id === 14)) recs.push("#14 ApprovalRequest pending 알림 cadence 점검");
  if (findings.some(f => f.id === 20)) recs.push("#20 협력점 footer 본사 핫라인 노출 — Partner 분양 신청 시 hotlineNumber 필수입력 가드 (MEMORY: project_partner_footer_fields)");
  if (findings.some(f => f.id === 8)) recs.push("#8 hq-template push 누락 협력점 — banner 동기화 잡 재실행 필요");
  if (recs.length === 0) recs.push("(특이 권장 없음 — baseline 만 캡처)");
  for (const r of recs) console.log("  - " + r);

  console.log("\n📊 baseline 카운트:");
  console.log(`  - Lead 정체(>30일 going):    ${baseline.leadGoingStale}건`);
  console.log(`  - Settlement 누락:           ${baseline.settlementMissing}건`);
  console.log(`  - ApprovalRequest pending stale: ${baseline.approvalPendingStale}건`);
  console.log(`  - hq-template drift 협력점:  ${(baseline as any).hqDriftPartners}곳`);
  console.log(`  - 기타:`);
  console.log(`      · Lead 총건수:           ${baseline.leadTotal}`);
  console.log(`      · Settlement 총건수:     ${baseline.settlementTotal}`);
  console.log(`      · active Partner:        ${baseline.partnerActive}`);
  console.log(`      · active Seller:         ${baseline.sellerActive}`);
  console.log(`      · Banner 총건수:         ${baseline.bannerTotal}`);
  console.log(`      · ApprovalRequest pending: ${baseline.approvalPending}`);
  console.log(`      · Product active/discontinued: ${baseline.productActive}/${baseline.productDiscontinued}`);
  console.log("");
}

main()
  .catch(e => { console.error("audit failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
