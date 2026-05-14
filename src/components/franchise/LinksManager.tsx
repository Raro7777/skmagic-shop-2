"use client";

import { useEffect, useState, useCallback } from "react";

type Seller = {
  id: string;
  sellerCode: string;
  name: string;
  phone: string | null;
  email: string | null;
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

export default function LinksManager({
  partnerCode,
  partnerName,
  hotline,
}: {
  partnerCode: string;
  partnerName: string;
  hotline: string;
}) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Form state for adding seller
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Inline edit state (per seller id)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const partnerUrl = `${origin}/p/${partnerCode}`;
  const links: LinkRow[] = [
    {
      key: "partner",
      label: "🏪 점 대표 링크",
      description: `${partnerName} 메인 사이트 — 점 단위 영업/광고/SNS용`,
      url: partnerUrl,
      shareText:
        `[${partnerName} 렌탈 상담]\n\n` +
        `정수기·비데·공기청정기 렌탈 혜택을 비교해드립니다.\n` +
        `월 렌탈료, 제휴카드 할인, 사은품 혜택까지 한 번에 상담받아보세요.\n\n` +
        `상담 신청: ${partnerUrl}\n` +
        `전화: ${hotline}`,
      type: "partner",
    },
  ];

  for (const s of sellers.filter(x => x.status === "active")) {
    const url = `${origin}/p/${partnerCode}/s/${s.sellerCode}`;
    const sellerPhone = s.phone?.trim() || hotline;
    links.push({
      key: `seller-${s.id}`,
      label: `👤 ${s.name}`,
      description: `${s.phone ?? s.sellerCode} · 누적 lead ${s.leadCount}건 · 본인 영업용 단독 링크`,
      url,
      shareText:
        `[${partnerName} · 담당 ${s.name}]\n\n` +
        `안녕하세요, ${partnerName}의 ${s.name}입니다.\n` +
        `렌탈 상담 도와드릴게요. 아래 링크에서 신청해주시면 30분 내 연락드립니다.\n\n` +
        `상담 신청: ${url}\n` +
        `전화: ${sellerPhone}`,
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
    setAdding(true);
    try {
      const res = await fetch("/api/sellers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "생성 실패");
        return;
      }
      setShowAdd(false);
      setNewName("");
      setNewPhone("");
      fetchSellers();
    } catch {
      setAddError("네트워크 오류");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (s: Seller) => {
    setEditingId(s.id);
    setEditPhone(s.phone ?? "");
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
      const res = await fetch(`/api/sellers/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: editPhone }),
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

      {error && <div className="bg-rk-tint-red text-rk-sale text-[14px] px-3 py-2 rounded mb-2">⚠ {error}</div>}

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
                          {editingId === l.seller.id ? "닫기" : "✏ 전화"}
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
                    <div className="bg-rk-soft-2 border border-rk-line rounded p-2 mt-2 flex flex-col gap-2">
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
                <div className="flex gap-2 items-baseline flex-wrap">
                  <input
                    required
                    placeholder="이름 (예: 홍길동)"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="px-2 py-1 border border-rk-line rounded text-[14px] w-[140px]"
                  />
                  <input
                    required
                    type="tel"
                    placeholder="전화번호 (010-1234-5678)"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="px-2 py-1 border border-rk-line rounded text-[14px] font-mono w-[200px]"
                  />
                </div>
                <div className="flex gap-2 items-baseline flex-wrap">
                  <button
                    type="submit"
                    disabled={adding}
                    className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1 rounded text-[13px] cursor-pointer font-medium"
                  >
                    {adding ? "…" : "추가"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAdd(false); setAddError(null); }}
                    className="bg-rk-soft text-rk-text border-0 px-3 py-1 rounded text-[13px] cursor-pointer"
                  >
                    취소
                  </button>
                  <small className="text-rk-faint text-[12px]">
                    영업자 단독 링크는 12자리 랜덤 코드로 만들어집니다 (예: <code className="font-mono bg-rk-soft px-1 rounded">/s/a3k8x9z2m1p4</code>) — 전화번호는 URL에 노출되지 않습니다. 카톡은 항상 점 대표 채널로 연결됩니다.
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
