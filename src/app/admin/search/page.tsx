import Link from "next/link";
import { auth } from "@/auth";
import { adminSearch, type AdminSearchHit } from "@/lib/search";

export const metadata = { title: "검색 · 어드민" };
export const dynamic = "force-dynamic";

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const { q = "" } = await searchParams;
  const trimmed = q.trim();

  if (!session?.user) {
    return <div className="p-4 text-[14px] text-rk-muted">로그인이 필요합니다.</div>;
  }

  const partnerScope = session.user.role === "partner_admin" ? session.user.partnerId : null;

  const hits = trimmed ? await adminSearch(trimmed, { partnerId: partnerScope }) : [];

  // Group hits by kind
  const byKind = {
    partner: hits.filter(h => h.kind === "partner"),
    product: hits.filter(h => h.kind === "product"),
    seller:  hits.filter(h => h.kind === "seller"),
    lead:    hits.filter(h => h.kind === "lead"),
  };

  return (
    <>
      <h1 className="text-[20px] font-bold mb-0.5 tracking-[-.02em]">통합 검색</h1>
      <p className="text-rk-muted text-[14px] mb-[18px]">
        {session.user.role === "hq"
          ? "협력점·상품·영업자·고객 lead를 한 번에 검색"
          : "본 협력점의 영업자·상품·고객 lead 검색"}
      </p>

      <form action="/admin/search" method="get" className="bg-white border border-rk-line rounded-lg p-4 mb-3 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          autoFocus={!q}
          placeholder="검색어 입력 (이름·휴대폰 뒤4자리·모델·코드 등)"
          className="flex-1 px-3 py-2 border border-rk-line rounded text-[13px] outline-none focus:border-rk-navy"
        />
        <button type="submit" className="bg-rk-navy hover:bg-rk-navy-deep text-white px-4 py-2 rounded text-[13px] font-medium border-0 cursor-pointer transition-colors">
          검색
        </button>
      </form>

      {!trimmed ? (
        <Empty />
      ) : hits.length === 0 ? (
        <NoResults q={trimmed} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-[14px] text-rk-muted">
            <b className="text-rk-ink">&quot;{trimmed}&quot;</b> 검색 결과 {hits.length}건
          </div>

          {byKind.partner.length > 0 && (
            <Section title="협력점" count={byKind.partner.length}>
              {byKind.partner.map(h => (
                <PartnerRow key={`p-${h.kind === "partner" ? h.partnerCode : ""}`} hit={h} />
              ))}
            </Section>
          )}

          {byKind.product.length > 0 && (
            <Section title="상품" count={byKind.product.length}>
              {byKind.product.map(h => (
                <ProductRow key={`pr-${h.kind === "product" ? h.productCode : ""}`} hit={h} role={session.user.role} />
              ))}
            </Section>
          )}

          {byKind.seller.length > 0 && (
            <Section title="영업자" count={byKind.seller.length}>
              {byKind.seller.map(h => (
                <SellerRow key={`s-${h.kind === "seller" ? h.id : ""}`} hit={h} />
              ))}
            </Section>
          )}

          {byKind.lead.length > 0 && (
            <Section title="고객 lead" count={byKind.lead.length}>
              {byKind.lead.map(h => (
                <LeadRow key={`l-${h.kind === "lead" ? h.id : ""}`} hit={h} />
              ))}
            </Section>
          )}
        </div>
      )}
    </>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-rk-line rounded-lg p-4">
      <h3 className="text-[13px] font-semibold text-rk-ink mb-2">
        {title} <span className="text-rk-muted font-normal">({count})</span>
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function PartnerRow({ hit }: { hit: Extract<AdminSearchHit, { kind: "partner" }> }) {
  return (
    <Link
      href={`/admin/super/partners`}
      className="flex items-center gap-3 px-2.5 py-2 rounded hover:bg-rk-soft-2 no-underline text-inherit"
    >
      <span className="text-[20px]">🏪</span>
      <div className="flex-1 min-w-0">
        <b className="block text-rk-ink text-[13px]">{hit.partnerName}</b>
        <small className="block text-rk-muted text-[13px]">{hit.brandLabel} · {hit.region ?? "—"}</small>
      </div>
      <span className="font-mono text-[12px] text-rk-faint">{hit.partnerCode}</span>
    </Link>
  );
}

function ProductRow({ hit, role }: { hit: Extract<AdminSearchHit, { kind: "product" }>; role: string }) {
  const editHref = role === "hq" ? `/admin/super/products/${hit.productCode}` : `/admin/franchise/products`;
  return (
    <Link href={editHref} className="flex items-center gap-3 px-2.5 py-2 rounded hover:bg-rk-soft-2 no-underline text-inherit">
      <span className="text-[20px]">📦</span>
      <div className="flex-1 min-w-0">
        <b className="block text-rk-ink text-[13px]">{hit.name}</b>
        <small className="block text-rk-muted text-[13px] font-mono">{hit.modelName} · {hit.productCode}</small>
      </div>
      <span className={"text-[12px] px-1.5 py-px rounded font-medium " + (hit.status === "active" ? "bg-rk-tint-green text-rk-success" : "bg-rk-tint-gray text-rk-muted")}>
        {hit.status}
      </span>
    </Link>
  );
}

function SellerRow({ hit }: { hit: Extract<AdminSearchHit, { kind: "seller" }> }) {
  return (
    <Link href={`/admin/franchise/sellers`} className="flex items-center gap-3 px-2.5 py-2 rounded hover:bg-rk-soft-2 no-underline text-inherit">
      <span className="text-[20px]">👤</span>
      <div className="flex-1 min-w-0">
        <b className="block text-rk-ink text-[13px]">{hit.name}</b>
        <small className="block text-rk-muted text-[13px] font-mono">{hit.sellerCode} · {hit.partnerCode}</small>
      </div>
    </Link>
  );
}

function LeadRow({ hit }: { hit: Extract<AdminSearchHit, { kind: "lead" }> }) {
  return (
    <Link href={`/admin/franchise/leads`} className="flex items-center gap-3 px-2.5 py-2 rounded hover:bg-rk-soft-2 no-underline text-inherit">
      <span className="text-[20px]">💬</span>
      <div className="flex-1 min-w-0">
        <b className="block text-rk-ink text-[13px]">{hit.customerName}</b>
        <small className="block text-rk-muted text-[13px] font-mono">{hit.phoneMasked} · {hit.partnerId ?? "본사 풀"}</small>
      </div>
      <span className={"text-[12px] px-1.5 py-px rounded font-medium " + STATUS_PILL[hit.status as keyof typeof STATUS_PILL]}>
        {hit.status}
      </span>
    </Link>
  );
}

const STATUS_PILL: Record<string, string> = {
  new:   "bg-rk-tint-blue text-rk-info",
  going: "bg-rk-tint-orange text-rk-orange-deep",
  done:  "bg-rk-tint-green text-rk-success",
  warn:  "bg-rk-tint-red text-rk-sale",
};

function Empty() {
  return (
    <div className="bg-white border border-rk-line rounded-lg p-8 text-center">
      <div className="text-[36px] mb-2">🔍</div>
      <p className="text-[13px] text-rk-text m-0">검색어를 입력하세요.</p>
      <small className="text-[13px] text-rk-muted block mt-1">
        예시: 협력점 코드, 모델번호, 고객 이름, 휴대폰 뒤 4자리
      </small>
    </div>
  );
}

function NoResults({ q }: { q: string }) {
  return (
    <div className="bg-white border border-rk-line rounded-lg p-8 text-center">
      <p className="text-[13px] text-rk-text m-0">
        <b>&quot;{q}&quot;</b> 검색 결과가 없습니다.
      </p>
    </div>
  );
}
