/**
 * Vercel Domains API 헬퍼.
 *
 * 필요 환경변수:
 *  - VERCEL_API_TOKEN     : https://vercel.com/account/tokens 에서 발급
 *  - VERCEL_PROJECT_ID    : Vercel project ID (.vercel/project.json 의 projectId)
 *  - VERCEL_TEAM_ID       : team 계정인 경우 (.vercel/project.json 의 orgId)
 */

const API_BASE = "https://api.vercel.com";

function token(): string {
  const t = process.env.VERCEL_API_TOKEN;
  if (!t) throw new Error("VERCEL_API_TOKEN 환경변수 미설정");
  return t;
}

function projectId(): string {
  const p = process.env.VERCEL_PROJECT_ID;
  if (!p) throw new Error("VERCEL_PROJECT_ID 환경변수 미설정");
  return p;
}

function teamQuery(): string {
  const team = process.env.VERCEL_TEAM_ID;
  return team ? `?teamId=${encodeURIComponent(team)}` : "";
}

export type VercelDomainStatus = {
  name: string;
  verified: boolean;
  misconfigured: boolean;
  /** A/CNAME 안내용 */
  verification?: Array<{ type: string; domain: string; value: string; reason: string }>;
  apexName?: string;
};

export async function addProjectDomain(host: string): Promise<{ ok: true } | { error: string }> {
  const res = await fetch(`${API_BASE}/v10/projects/${projectId()}/domains${teamQuery()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: host }),
  });
  if (res.ok) return { ok: true };
  const j = await res.json().catch(() => ({}));
  // 이미 등록된 도메인은 success 로 취급
  if (j?.error?.code === "domain_already_in_use_by_different_project" || j?.error?.code === "domain_already_in_use") {
    return { error: `이미 다른 프로젝트가 사용 중인 도메인: ${j.error.projectId ?? ""}` };
  }
  if (j?.error?.code === "domain_already_exists") return { ok: true };
  return { error: j?.error?.message ?? `Vercel domain 추가 실패 (${res.status})` };
}

export async function removeProjectDomain(host: string): Promise<{ ok: true } | { error: string }> {
  const res = await fetch(`${API_BASE}/v9/projects/${projectId()}/domains/${encodeURIComponent(host)}${teamQuery()}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (res.ok || res.status === 404) return { ok: true };
  const j = await res.json().catch(() => ({}));
  return { error: j?.error?.message ?? `Vercel domain 삭제 실패 (${res.status})` };
}

export async function getDomainStatus(host: string): Promise<VercelDomainStatus | null> {
  const res = await fetch(`${API_BASE}/v9/projects/${projectId()}/domains/${encodeURIComponent(host)}${teamQuery()}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) return null;
  const j = await res.json();
  return {
    name: j.name,
    verified: !!j.verified,
    misconfigured: !!j.misconfigured,
    verification: j.verification,
    apexName: j.apexName,
  };
}

export function normalizeHost(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}

const HOST_RE = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
export function isValidHost(host: string): boolean {
  return HOST_RE.test(host);
}
