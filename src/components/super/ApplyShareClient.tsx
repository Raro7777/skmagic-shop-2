"use client";

import { useMemo, useState } from "react";

type Channel = {
  key: string;
  label: string;
  utm_source: string;
  utm_medium: string;
  icon: string;
  shareLabel: string;
};

const CHANNELS: Channel[] = [
  { key: "kakao",    label: "카카오톡 (단톡방/오픈채팅)", utm_source: "kakao",    utm_medium: "messenger", icon: "💬", shareLabel: "카톡 공유 메시지" },
  { key: "sms",      label: "문자 메시지",                utm_source: "sms",      utm_medium: "sms",       icon: "📱", shareLabel: "문자 메시지" },
  { key: "instagram",label: "인스타그램 DM/스토리",        utm_source: "instagram",utm_medium: "social",    icon: "📷", shareLabel: "인스타 메시지" },
  { key: "naver",    label: "네이버 카페·블로그 글",       utm_source: "naver",    utm_medium: "community", icon: "🟢", shareLabel: "네이버 글 본문" },
  { key: "email",    label: "이메일",                     utm_source: "email",    utm_medium: "email",     icon: "✉️", shareLabel: "이메일 본문" },
  { key: "etc",      label: "기타 채널",                  utm_source: "etc",      utm_medium: "link",      icon: "🔗", shareLabel: "공유 메시지" },
];

function buildUrl(base: string, channel: Channel, campaign: string): string {
  const url = new URL(base);
  url.searchParams.set("utm_source", channel.utm_source);
  url.searchParams.set("utm_medium", channel.utm_medium);
  if (campaign.trim()) url.searchParams.set("utm_campaign", campaign.trim());
  return url.toString();
}

function buildMessage(channel: Channel, url: string): string {
  // 채널별 자연스러운 톤 — 본사가 그대로 복붙해서 보낼 수 있게.
  switch (channel.key) {
    case "kakao":
      return [
        "[SK매직 협력점 모집] 분양 신청 안내",
        "",
        "📌 본사가 상품·정책·정산 전부 관장 — 협력점은 영업만",
        "📌 사은품·캐시백 자율 운영",
        "📌 본사 직영 사이트 + 카톡 채널 무료 지원",
        "",
        "📝 분양 신청서 작성 (3분 소요)",
        url,
      ].join("\n");
    case "sms":
      return `[SK매직 협력점 모집] 분양 신청서 (3분): ${url}`;
    case "instagram":
      return [
        "안녕하세요 👋 SK매직 협력점 분양 안내드립니다.",
        "본사가 상품·정책·정산 전부 관장하고 협력점은 영업만 집중하시면 됩니다.",
        "📝 신청서: " + url,
      ].join("\n");
    case "naver":
      return [
        "🏠 SK매직 협력점 분양 안내",
        "",
        "✅ 본사 통합 운영 — 상품·정책·정산 일괄 관리",
        "✅ 협력점 자유도 — 사은품·캐시백 자율",
        "✅ 무료 본사 사이트 + 카톡 채널",
        "",
        "📝 분양 신청서 (3분 소요)",
        url,
        "",
        "#SK매직 #협력점모집 #분양 #렌탈 #정수기",
      ].join("\n");
    case "email":
      return [
        "안녕하세요,",
        "",
        "SK매직 협력점 분양 안내드립니다.",
        "본사가 상품·정책·정산 전부 관장하므로, 협력점은 영업에만 집중하실 수 있습니다.",
        "",
        "주요 혜택:",
        " • 본사 표준 정책 (수수료/사은품/캐시백 한도 고정)",
        " • 무료 본사 사이트 + 카톡 채널 발급",
        " • 정산 자동 + 환수 관리 자동",
        "",
        "분양 신청서 (3분 소요):",
        url,
        "",
        "감사합니다.",
      ].join("\n");
    default:
      return `[SK매직 협력점 분양] 신청 링크: ${url}`;
  }
}

type FormKind = "landing" | "simple";

export default function ApplyShareClient({ landingUrl, simpleUrl }: { landingUrl: string; simpleUrl: string }) {
  const [campaign, setCampaign] = useState("apply-2026");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // 어떤 페이지 링크를 줄지 — 단순 신청서(/apply/form) 또는 안내+신청서(/apply)
  const [kind, setKind] = useState<FormKind>("simple");

  const baseUrl = kind === "simple" ? simpleUrl : landingUrl;

  // 기본(파라미터 없는) URL — 가장 깔끔. UTM 없는 채널 (예: 직접 안내) 용
  const cleanUrl = baseUrl;

  // 각 채널별 URL + 메시지 메모이즈
  const channelLinks = useMemo(() => {
    return CHANNELS.map(c => {
      const url = buildUrl(baseUrl, c, campaign);
      const message = buildMessage(c, url);
      return { ...c, url, message };
    });
  }, [baseUrl, campaign]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch { /* noop */ }
  };

  const qrSrc = (url: string) => `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-col gap-4">
      {/* 페이지 종류 토글 */}
      <section className="bg-white border border-rk-line rounded-lg p-4">
        <h3 className="text-[14px] font-semibold text-rk-ink mb-2">공유할 페이지</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setKind("simple")}
            className={"flex-1 min-w-[200px] text-left px-3 py-2.5 rounded border-2 cursor-pointer transition-colors " + (kind === "simple" ? "bg-rk-tint-orange border-rk-orange text-rk-orange-deep" : "bg-white border-rk-line text-rk-text hover:border-rk-navy")}
          >
            <b className="block text-[13px]">🪶 단순 신청서</b>
            <small className="text-[11px] opacity-75 block mt-0.5">신청서만 노출 (랜딩 X) — 카톡/문자 등 짧은 안내에 적합</small>
            <small className="text-[11px] font-mono opacity-60 block mt-1 break-all">{simpleUrl}</small>
          </button>
          <button
            type="button"
            onClick={() => setKind("landing")}
            className={"flex-1 min-w-[200px] text-left px-3 py-2.5 rounded border-2 cursor-pointer transition-colors " + (kind === "landing" ? "bg-rk-tint-orange border-rk-orange text-rk-orange-deep" : "bg-white border-rk-line text-rk-text hover:border-rk-navy")}
          >
            <b className="block text-[13px]">📋 안내 + 신청서 (랜딩)</b>
            <small className="text-[11px] opacity-75 block mt-0.5">패키지·수익모델·FAQ 포함 — 네이버 카페·블로그 등에 적합</small>
            <small className="text-[11px] font-mono opacity-60 block mt-1 break-all">{landingUrl}</small>
          </button>
        </div>
      </section>

      {/* 기본 링크 + QR */}
      <section className="bg-white border border-rk-line rounded-lg p-4">
        <h3 className="text-[14px] font-semibold text-rk-ink mb-2">기본 링크 (파라미터 없음)</h3>
        <div className="grid grid-cols-[1fr_180px] gap-4 items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={cleanUrl}
                className="flex-1 border border-rk-line rounded px-2.5 py-1.5 text-[14px] bg-rk-soft-2 font-mono"
              />
              <button
                type="button"
                onClick={() => copy("clean", cleanUrl)}
                className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-3 py-1.5 rounded text-[14px] font-medium cursor-pointer"
              >
                {copiedKey === "clean" ? "✓ 복사됨" : "복사"}
              </button>
            </div>
            <small className="text-rk-muted text-[12px]">
              가장 짧은 형태. 어떤 채널인지 추적이 필요 없을 때 (대면 안내, 명함 인쇄 등).
            </small>
          </div>
          <div className="bg-white border border-rk-line-2 rounded p-2 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc(cleanUrl)} alt="QR" className="w-[160px] h-[160px] mx-auto" />
            <small className="block text-[11px] text-rk-muted mt-1">QR 코드</small>
          </div>
        </div>
      </section>

      {/* 캠페인 이름 설정 */}
      <section className="bg-white border border-rk-line rounded-lg p-4">
        <h3 className="text-[14px] font-semibold text-rk-ink mb-2">캠페인 이름 (utm_campaign)</h3>
        <p className="text-[12px] text-rk-muted mb-2">
          예: "apply-2026", "summer-promo", "instagram-ad-may" — 마케팅 분석에서 캠페인별로 그룹핑됩니다.
        </p>
        <input
          type="text"
          value={campaign}
          onChange={e => setCampaign(e.target.value)}
          placeholder="apply-2026"
          className="w-full max-w-[400px] border border-rk-line rounded px-2.5 py-1.5 text-[14px]"
        />
      </section>

      {/* 채널별 링크 + 메시지 */}
      <section>
        <h3 className="text-[14px] font-semibold text-rk-ink mb-2 px-1">채널별 공유 링크 + 메시지</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {channelLinks.map(c => (
            <div key={c.key} className="bg-white border border-rk-line rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[18px]">{c.icon}</span>
                <b className="text-[14px] text-rk-ink">{c.label}</b>
              </div>

              {/* URL */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  readOnly
                  value={c.url}
                  className="flex-1 border border-rk-line rounded px-2 py-1 text-[12px] bg-rk-soft-2 font-mono truncate"
                />
                <button
                  type="button"
                  onClick={() => copy(`url-${c.key}`, c.url)}
                  className="bg-rk-navy hover:bg-rk-navy-deep text-white border-0 px-2.5 py-1 rounded text-[12px] font-medium cursor-pointer shrink-0"
                  title="URL 만 복사"
                >
                  {copiedKey === `url-${c.key}` ? "✓" : "URL"}
                </button>
              </div>

              {/* Message template */}
              <div className="bg-rk-soft-2 border border-rk-line-2 rounded p-2 mb-2">
                <pre className="text-[12px] text-rk-text whitespace-pre-wrap font-sans m-0 leading-[1.55]">{c.message}</pre>
              </div>

              <button
                type="button"
                onClick={() => copy(`msg-${c.key}`, c.message)}
                className="w-full bg-rk-orange hover:bg-rk-orange-deep text-white border-0 px-3 py-1.5 rounded text-[13px] font-medium cursor-pointer"
              >
                {copiedKey === `msg-${c.key}` ? `✓ ${c.shareLabel} 복사됨` : `📋 ${c.shareLabel} 복사`}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
