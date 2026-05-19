"use client";

import { useEffect, useState, useCallback } from "react";

type Seller = {
  id: string;
  sellerCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  loginEmail: string | null;
  status: string;
  leadCount: number;
};

type LinkRow = {
  key: string;
  label: string;
  description: string;
  url: string;
  shareText: string;
  type: "partner" | "seller" | "product";
  seller?: Seller;
};

const QR_API = (url: string, size = 240) =>
  `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=${size}x${size}&margin=0`;

// 일괄 등록 입력 파싱 — 각 줄을 { name, phone } 으로 분해
// 허용 형태:
//   "홍길동, 010-1234-5678"
//   "홍길동 010-1234-5678"
//   "홍길동	010-1234-5678" (탭)
//   "010-1234-5678 홍길동" (전화번호가 앞이어도 OK)
// 빈 줄은 무시. 파싱 못 한 줄은 reason 과 함께 반환.
type ParsedRow = { ok: true; name: string; phone: string } | { ok: false; raw: string; reason: string };
function parseBulkInput(text: string): ParsedRow[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map<ParsedRow>(line => {
      // 쉼표, 탭, 한국 공백, 일반 공백을 separator 로 사용
      const parts = line.split(/[,\t]|\s+/).map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) {
        return { ok: false, raw: line, reason: "이름과 전화번호 모두 필요" };
      }
      // 전화번호로 보이는 파트(숫자/하이픈/+ 위주) 찾기
      const phoneIdx = parts.findIndex(p => /^[\d+\-()\s]{8,}$/.test(p) && /\d{3}/.test(p));
      if (phoneIdx < 0) {
        return { ok: false, raw: line, reason: "전화번호를 인식할 수 없음" };
      }
      const phone = parts[phoneIdx];
      const name = parts.filter((_, i) => i !== phoneIdx).join(" ");
      if (!name) return { ok: false, raw: line, reason: "이름이 비어있음" };
      return { ok: true, name, phone };
    });
}

// 영업자 카톡 공유 문구 — 영업자 추가 직후 자동 복사에도 재사용
function makeSellerShareText(opts: {
  partnerName: string;
  sellerName: string;
  sellerUrl: string;
  contactPhone: string;
}): string {
  return (
    `[${opts.partnerName} · 담당 ${opts.sellerName}]\n\n` +
    `안녕하세요 ${opts.partnerName}의 ${opts.sellerName}입니다.\n` +
    `혜택 끝판왕의 렌탈상담을 진행해보세요. 원하시는 조건에 지원받으실 수 있는 렌탈지원금(현금, 설치 후 당일 송금)도 드립니다.\n\n` +
    `상담 신청: ${opts.sellerUrl}\n` +
    `전화: ${opts.contactPhone}`
  );
}

export default function LinksManager({
  partnerCode,
  partnerName,
  hotline,
  customDomain,
}: {
  partnerCode: string;
  partnerName: string;
  hotline: string;
  customDomain: string | null;
}) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // customDomain 보유 시 그걸 우선 사용. 사용자가 본사 도메인 형태로 보고 싶으면 토글로 전환.
  const [useShortDomain, setUseShortDomain] = useState(true);

  // Form state for adding seller (단일/일괄 통합 — 한 줄=1명, 여러 줄=일괄)
  const [showAdd, setShowAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Inline edit state (per seller id) — 전화번호 + 로그인 ID(이메일)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editLoginEmail, setEditLoginEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 영업자 추가 직후 토스트
  // 단일: 로그인 자격(email + 임시비번) + 카톡 문구 자동 클립보드 복사 안내
  // 일괄: 성공/실패 명단 + 각 영업자별 로그인 자격 안내
  type AddedToast =
    | { mode: "single"; name: string; copied: boolean; login: { email: string; tempPassword: string } | null }
    | { mode: "bulk"; added: Array<{ name: string; login: { email: string; tempPassword: string } | null }>; failed: Array<{ raw: string; reason: string }> };
  const [addedToast, setAddedToast] = useState<AddedToast | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fetchSellers = useCallback(async () => {
    try {
      const res = await fetch("/api/sellers", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSellers(data.sellers);
      setError(null);
    } catch {
      setError("영업자 데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  // customDomain (verified) 이 있고 사용자가 단축 도메인 모드를 켰으면 그걸 base 로.
  // 안그러면 본사 도메인 + /p/{partnerCode} 형태 (origin 은 client mount 후에야 채워짐).
  const useCustom = !!customDomain && useShortDomain;
  const customBase = customDomain
    ? (customDomain.startsWith("http") ? customDomain : `https://${customDomain}`)
    : null;
  const partnerUrl = useCustom && customBase
    ? customBase
    : origin
      ? `${origin}/p/${partnerCode}`
      : `/p/${partnerCode}`;

  const sellerUrlFor = (sellerCode: string) =>
    useCustom && customBase
      ? `${customBase}/s/${sellerCode}`
      : origin
        ? `${origin}/p/${partnerCode}/s/${sellerCode}`
        : `/p/${partnerCode}/s/${sellerCode}`;

  const links: LinkRow[] = [
    {
      key: "partner",
      label: "🏪 점 대표 링크",
      description: `${partnerName} 메인 사이트 — 점 단위 영업/광고/SNS용`,
      url: partnerUrl,
      shareText:
        `[${partnerName} 렌탈 상담]\n\n` +
        `안녕하세요 ${partnerName}입니다.\n` +
        `혜택 끝판왕의 렌탈상담을 진행해보세요. 원하시는 조건에 지원받으실 수 있는 렌탈지원금(현금, 설치 후 당일 송금)도 드립니다.\n\n` +
        `상담 신청: ${partnerUrl}\n` +
        `전화: ${hotline}`,
      type: "partner",
    },
  ];

  for (const s of sellers.filter(x => x.status === "active")) {
    const url = sellerUrlFor(s.sellerCode);
    const sellerPhone = s.phone?.trim() || hotline;
    links.push({
      key: `seller-${s.id}`,
      label: `👤 ${s.name}`,
      description: `${s.phone ?? s.sellerCode} · 누적 lead ${s.leadCount}건 · 본인 영업용 단독 링크`,
      url,
      shareText: makeSellerShareText({
        partnerName,
        sellerName: s.name,
        sellerUrl: url,
        contactPhone: sellerPhone,
      }),
      type: "seller",
      seller: s,
    });
  }

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1800);
    } catch {
      setCopied(null);
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const rows = parseBulkInput(bulkInput);
    if (rows.length === 0) {
      setAddError("이름과 전화번호를 한 줄 이상 입력하세요.");
      return;
    }
    setAdding(true);
    type AddedRow = { name: string; sellerCode: string; phone: string | null; login: { email: string; tempPassword: string } | null };
    const added: AddedRow[] = [];
    const failed: Array<{ raw: string; reason: string }> = rows
      .filter(r => !r.ok)
      .map(r => (r as Extract<ParsedRow, { ok: false }>));

    for (const r of rows) {
      if (!r.ok) continue;
      try {
        const res = await fetch("/api/sellers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: r.name, phone: r.phone }),
        });
        const data = await res.json();
        if (!res.ok) {
          failed.push({ raw: `${r.name} ${r.phone}`, reason: data.error ?? "생성 실패" });
        } else {
          const s = data.seller as { sellerCode: string; name: string; phone: string | null };
          const login = (data.login as { email: string; tempPassword: string } | undefined) ?? null;
          added.push({ ...s, login });
        }
      } catch {
        failed.push({ raw: `${r.name} ${r.phone}`, reason: "네트워크 오류" });
      }
    }
    setAdding(false);

    if (added.length === 0 && failed.length > 0) {
      setAddError(failed.map(f => `${f.raw}: ${f.reason}`).join(" / "));
      return;
    }

    // 단일 추가일 때만 카톡 문구(영업 링크 + 로그인 자격) 자동 클립보드 복사
    if (added.length === 1 && failed.length === 0) {
      const s = added[0];
      const sellerUrl = sellerUrlFor(s.sellerCode);
      const baseText = makeSellerShareText({
        partnerName,
        sellerName: s.name,
        sellerUrl,
        contactPhone: s.phone?.trim() || hotline,
      });
      const text = s.login
        ? `${baseText}\n\n— 영업자 콘솔 로그인 —\nID: ${s.login.email}\n임시 비밀번호: ${s.login.tempPassword}\n첫 로그인 시 비밀번호 변경 필요`
        : baseText;
      let copied = false;
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch { /* 클립보드 차단되어도 추가는 성공 */ }
      setAddedToast({ mode: "single", name: s.name, copied, login: s.login });
    } else {
      setAddedToast({
        mode: "bulk",
        added: added.map(a => ({ name: a.name, login: a.login })),
        failed,
      });
    }
    // 로그인 자격이 포함된 토스트는 협력점이 옮겨 적어야 하므로 자동 닫기 안 함.
    // 사용자가 직접 ✕ 로 닫을 때까지 유지. (이전엔 8초 후 자동 닫기였음)

    setShowAdd(false);
    setBulkInput("");
    fetchSellers();
  };

  const startEdit = (s: Seller) => {
    setEditingId(s.id);
    setEditPhone(s.phone ?? "");
    setEditLoginEmail(s.loginEmail ?? "");
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async (id: string) => {
    setEditSaving(true);
    setEditError(null);
    try {
      // 변경된 값만 전송 — 미변경 필드까지 PATCH 하면 불필요한 검증/DB 쓰기.
      const current = sellers.find(s => s.id === id);
      const payload: { phone?: string; loginEmail?: string } = {};
      if (editPhone !== (current?.phone ?? "")) payload.phone = editPhone;
      const currentLogin = current?.loginEmail ?? "";
      if (editLoginEmail.trim().toLowerCase() !== currentLogin.toLowerCase()) {
        payload.loginEmail = editLoginEmail.trim();
      }
      if (Object.keys(payload).length === 0) {
        setEditingId(null);
        return;
      }
      const res = await fetch(`/api/sellers/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "저장 실패");
        return;
      }
      setEditingId(null);
      fetchSellers();
    } catch {
      setEditError("네트워크 오류");
    } finally {
      setEditSaving(false);
    }
  };

  const removeSeller = async (id: string) => {
    if (!confirm("이 영업자를 비활성화합니다. 진행할까요? (lead 이력은 유지됨)")) return;
    const res = await fetch(`/api/sellers/${id}`, { method: "DELETE" });
    if (res.ok) fetchSellers();
  };

  return (
    <section className="bg-white border border-rk-line rounded-lg p-4 mb-3">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <h3 className="text-[14px] font-semibold">
          🔗 내 링크 / QR · 영업자 관리
          <span className="text-[12px] px-1.5 py-0.5 rounded bg-rk-tint-green text-rk-success font-medium ml-1.5">live</span>
        </h3>
        <span className="ml-auto text-[13px] text-rk-muted">
          영업자 {sellers.filter(s => s.status === "active").length}명 · 점 링크 1 + 영업자 링크 N개
        </span>
      </div>

      {/* customDomain 보유 협력점 — 단축 vs 본사 도메인 토글 */}
      {customDomain && (
        <div className="bg-rk-tint-blue rounded-md px-3 py-2.5 mb-3 flex items-center gap-3 flex-wrap text-[13px]">
          <span className="text-rk-info">
            <b>자체 도메인 사용 중</b> — <code className="font-mono bg-white/60 px-1.5 py-0.5 rounded text-[12px]">{customDomain}</code>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUseShortDomain(true)}
              className={
                "px-2.5 py-1 rounded text-[12px] cursor-pointer border-0 font-medium " +
                (useShortDomain ? "bg-rk-navy text-white" : "bg-white text-rk-text border border-rk-line")
              }
            >
              단축 (자체 도메인)
            </button>
            <button
              type="button"
              onClick={() => setUseShortDomain(false)}
              className={
                "px-2.5 py-1 rounded text-[12px] cursor-pointer border-0 font-medium " +
                (!useShortDomain ? "bg-rk-navy text-white" : "bg-white text-rk-text border border-rk-line")
              }
            >
              본사 도메인 형태
            </button>
          </div>
        </div>
      )}

      {error && <div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded mb-2">⚠ {error}</div>}

      {addedToast && (
        <div className="bg-rk-tint-green text-rk-success text-[13px] px-3 py-2.5 rounded mb-2 flex items-start gap-2">
          <span className="text-[15px] leading-none mt-0.5">✓</span>
          <div className="flex-1 leading-[1.5]">
            {addedToast.mode === "single" ? (
              <>
                <b>{addedToast.name}</b> 영업자가 추가되었습니다.{" "}
                {addedToast.copied ? (
                  <>카톡 공유 문구가 <b>자동으로 복사</b>되어 있어요 — 그대로 카톡에 붙여넣으면 됩니다.</>
                ) : (
                  <>아래 영업자 목록에서 <b>💬 카톡 문구</b> 버튼으로 복사할 수 있어요.</>
                )}
                {addedToast.login && (
                  <div className="bg-white/70 border border-rk-success/30 rounded p-2 mt-2 text-rk-ink text-[13px] leading-[1.7]">
                    <b className="block text-rk-success mb-1">🔑 영업자 콘솔 로그인 자격</b>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
                      <span>ID: <b>{addedToast.login.email}</b></span>
                      <span>임시 비밀번호: <b>{addedToast.login.tempPassword}</b></span>
                    </div>
                    <small className="text-rk-muted text-[12px] block mt-1">
                      영업자 본인이 첫 로그인 시 비밀번호를 변경해야 합니다. 위 자격은 카톡 문구에 자동 포함되어 있습니다.
                    </small>
                  </div>
                )}
              </>
            ) : (
              <>
                <b>{addedToast.added.length}명</b> 추가 완료
                {addedToast.added.length > 0 && (
                  <span className="ml-1 opacity-80">({addedToast.added.map(a => a.name).join(", ")})</span>
                )}
                {addedToast.added.some(a => a.login) && (
                  <div className="bg-white/70 border border-rk-success/30 rounded p-2 mt-2 text-rk-ink text-[12px] leading-[1.7]">
                    <b className="block text-rk-success mb-1">🔑 영업자별 로그인 자격</b>
                    <ul className="m-0 p-0 list-none font-mono">
                      {addedToast.added.filter(a => a.login).map((a, i) => (
                        <li key={i}><b>{a.name}</b> · ID {a.login!.email} · 임시 {a.login!.tempPassword}</li>
                      ))}
                    </ul>
                    <small className="text-rk-muted text-[11px] block mt-1 font-sans">
                      각 영업자에게 카톡으로 전달 — 첫 로그인 시 비밀번호 변경 강제됩니다.
                    </small>
                  </div>
                )}
                {addedToast.failed.length > 0 && (
                  <div className="mt-1 text-rk-sale">
                    실패 {addedToast.failed.length}건:
                    <ul className="m-0 pl-4 list-disc text-[12px]">
                      {addedToast.failed.map((f, i) => (
                        <li key={i}><code className="font-mono">{f.raw}</code> — {f.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAddedToast(null)}
            className="text-rk-success bg-transparent border-0 cursor-pointer text-[14px] leading-none opacity-70 hover:opacity-100"
            aria-label="닫기"
          >×</button>
        </div>
      )}

      {loading ? (
        <div className="text-[14px] text-rk-muted py-4 text-center">로딩 중…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {links.map(l => (
            <div key={l.key} className="border border-rk-line-2 rounded-md">
              <div className="flex items-start gap-3 px-3 py-2.5 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <b className="text-[13px] text-rk-ink">{l.label}</b>
                    {l.type === "seller" && l.seller && (
                      <>
                        <button
                          type="button"
                          onClick={() => (editingId === l.seller!.id ? cancelEdit() : startEdit(l.seller!))}
                          className="text-[12px] text-rk-info hover:text-rk-navy bg-transparent border-0 cursor-pointer"
                        >
                          {editingId === l.seller.id ? "닫기" : "✏ 수정"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSeller(l.seller!.id)}
                          className="text-[12px] text-rk-faint hover:text-rk-sale bg-transparent border-0 cursor-pointer"
                        >
                          비활성화
                        </button>
                      </>
                    )}
                  </div>
                  <small className="text-rk-muted text-[13px] block mb-1">{l.description}</small>
                  {l.type === "seller" && l.seller && (
                    <div className="flex flex-wrap gap-2 mb-1 text-[12px]">
                      <span className={l.seller.phone ? "text-rk-text" : "text-rk-faint"}>
                        📞 {l.seller.phone ?? <i>점 대표번호 사용</i>}
                      </span>
                      <span className="text-rk-faint">💬 점 대표 카톡 채널 사용</span>
                    </div>
                  )}
                  <div className="font-mono text-[13px] text-rk-info bg-rk-soft-2 rounded px-2 py-1 break-all">
                    {l.url}
                  </div>
                  {l.type === "seller" && l.seller && editingId === l.seller.id && (
                    <div className="bg-rk-soft-2 border border-rk-line rounded p-2.5 mt-2 flex flex-col gap-2">
                      <label className="flex flex-col gap-1 text-[12px] text-rk-muted">
                        전화
                        <input
                          type="tel"
                          placeholder="010-1234-5678 (비우면 점 대표 사용)"
                          value={editPhone}
                          onChange={e => setEditPhone(e.target.value)}
                          className="px-2 py-1 border border-rk-line rounded text-[14px] font-mono"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[12px] text-rk-muted">
                        로그인 ID (이메일)
                        <input
                          type="email"
                          placeholder="seller@example.com"
                          value={editLoginEmail}
                          onChange={e => setEditLoginEmail(e.target.value)}
                          className="px-2 py-1 border border-rk-line rounded text-[14px] font-mono"
                        />
                        <small className="text-[11px] text-rk-faint">영업자 콘솔(/admin/seller) 로그인 이메일. 변경 시 기존 ID 는 즉시 사용 불가.</small>
                      </label>
                      <div className="flex gap-2 items-center">
                        <button
                          type="button"
                          disabled={editSaving}
                          onClick={() => saveEdit(l.seller!.id)}
                          className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1 rounded text-[13px] cursor-pointer font-medium"
                        >
                          {editSaving ? "…" : "저장"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="bg-rk-soft text-rk-text border-0 px-3 py-1 rounded text-[13px] cursor-pointer"
                        >
                          취소
                        </button>
                        {editError && <small className="text-rk-sale text-[13px]">⚠ {editError}</small>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 min-w-[120px]">
                  <button
                    type="button"
                    onClick={() => copy(l.url, `url-${l.key}`)}
                    className="bg-rk-soft hover:bg-rk-line-2 text-rk-ink border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer"
                  >
                    {copied === `url-${l.key}` ? "✓ 복사됨" : "📋 URL 복사"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(l.shareText, `share-${l.key}`)}
                    className="bg-rk-soft hover:bg-rk-line-2 text-rk-ink border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer"
                  >
                    {copied === `share-${l.key}` ? "✓ 복사됨" : "💬 카톡 문구"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrFor(qrFor === l.key ? null : l.key)}
                    className={
                      "border-0 px-2.5 py-1 rounded text-[13px] cursor-pointer " +
                      (qrFor === l.key ? "bg-rk-navy text-white" : "bg-rk-soft hover:bg-rk-line-2 text-rk-ink")
                    }
                  >
                    {qrFor === l.key ? "QR 닫기" : "🔳 QR 보기"}
                  </button>
                </div>
              </div>

              {qrFor === l.key && (
                <div className="border-t border-rk-line-2 bg-rk-soft-2 px-3 py-3 flex gap-3 items-center flex-wrap">
                  <img
                    src={QR_API(l.url, 200)}
                    alt={`QR for ${l.label}`}
                    width={200}
                    height={200}
                    className="bg-white p-2 border border-rk-line rounded"
                  />
                  <div className="flex-1 min-w-[200px]">
                    <b className="text-[14px] text-rk-ink block mb-1">{l.label}</b>
                    <p className="text-[13px] text-rk-muted m-0 mb-2">
                      이 QR코드를 전단지·명함·매장 입구에 붙이세요. 스캔 시 이 링크로 직접 이동합니다.
                    </p>
                    <a
                      href={QR_API(l.url, 600)}
                      download={`${partnerCode}-${l.key}-qr.png`}
                      target="_blank"
                      className="text-[13px] text-rk-info no-underline"
                    >
                      ⬇ 고해상도 QR 이미지 다운로드 (600×600)
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add seller */}
          <div className="border border-dashed border-rk-line rounded-md p-3">
            {!showAdd ? (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="bg-transparent border-0 text-[14px] text-rk-info cursor-pointer"
              >
                + 영업자 추가 (개인 링크 생성)
              </button>
            ) : (
              <form onSubmit={submitAdd} className="flex flex-col gap-2">
                <label className="text-[12px] text-rk-muted">
                  한 줄에 한 명씩 — <b>이름 전화번호</b> (쉼표/공백/탭 어떤 구분자든 OK)
                </label>
                <textarea
                  required
                  value={bulkInput}
                  onChange={e => setBulkInput(e.target.value)}
                  rows={Math.min(8, Math.max(2, bulkInput.split("\n").length + 1))}
                  placeholder={"홍길동, 010-1234-5678\n김철수 010-2345-6789\n이영희\t010-3456-7890"}
                  className="px-2 py-1.5 border border-rk-line rounded text-[14px] font-mono w-full resize-y"
                />
                {bulkInput.trim().length > 0 && (() => {
                  const parsed = parseBulkInput(bulkInput);
                  const ok = parsed.filter(r => r.ok).length;
                  const bad = parsed.length - ok;
                  return (
                    <div className="text-[12px] text-rk-muted flex gap-2 flex-wrap">
                      <span className={ok > 0 ? "text-rk-success" : ""}>인식 {ok}명</span>
                      {bad > 0 && <span className="text-rk-sale">파싱 실패 {bad}줄</span>}
                      {ok > 1 && <span className="text-rk-info">· 일괄 등록 모드</span>}
                      {ok === 1 && <span className="text-rk-info">· 추가 후 카톡 문구 자동 복사</span>}
                    </div>
                  );
                })()}
                <div className="flex gap-2 items-baseline flex-wrap">
                  <button
                    type="submit"
                    disabled={adding}
                    className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1 rounded text-[13px] cursor-pointer font-medium"
                  >
                    {adding ? "추가 중…" : "추가"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAdd(false); setAddError(null); setBulkInput(""); }}
                    className="bg-rk-soft text-rk-text border-0 px-3 py-1 rounded text-[13px] cursor-pointer"
                  >
                    취소
                  </button>
                  <small className="text-rk-faint text-[12px]">
                    영업자 단독 링크는 12자리 랜덤 코드로 만들어집니다 — 전화번호는 URL에 노출되지 않습니다. 카톡은 항상 점 대표 채널로 연결됩니다.
                  </small>
                  {addError && <small className="text-rk-sale text-[13px] basis-full mt-1">⚠ {addError}</small>}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 px-3 py-2 bg-rk-tint-blue rounded text-[13px] text-rk-info leading-[1.6]">
        ⓘ 점 링크는 점 전체 lead로, 영업자 링크에서 들어온 lead는 <b>해당 영업자</b>에 자동 태그됩니다 (룰북 8.2-1, 8.2-2). QR은 외부 API로 즉시 생성되며 다운로드해서 인쇄/전단지에 활용하세요.
      </div>
    </section>
  );
}
