/**
 * 보안 감사 로그 헬퍼.
 *
 * 사용 패턴:
 *   await writeAudit({ action: "login_success", actorEmail: email, ip, userAgent });
 *
 * action 분류:
 *   - login_success           : 로그인 성공
 *   - login_fail              : 로그인 실패 (잘못된 비번 등)
 *   - login_locked            : 실패 누적으로 잠금 발생
 *   - account_create          : 본사가 신규 사용자 발급
 *   - password_change         : 본인 비번 변경
 *   - password_reset          : 본사가 다른 사용자 비번 재설정
 *   - account_unlock          : 본사가 잠금 해제
 *   - account_status_change   : 본사가 active/disabled 토글
 *   - session_logout          : 로그아웃
 */
import { prisma } from "./prisma";

export type AuditAction =
  | "login_success"
  | "login_fail"
  | "login_locked"
  | "account_create"
  | "password_change"
  | "password_reset"
  | "account_unlock"
  | "account_status_change"
  | "session_logout";

export type AuditEntry = {
  action: AuditAction;
  actorId?: string | null;
  actorEmail?: string | null;
  targetUserId?: string | null;
  targetEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        targetUserId: entry.targetUserId ?? null,
        targetEmail: entry.targetEmail ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: (entry.metadata ?? null) as never,
      },
    });
  } catch (e) {
    // 감사 로그 실패가 본 로직을 막으면 안 됨 — console 만
    console.error("[audit] write failed:", e);
  }
}

/** Request → IP, User-Agent 추출 */
export function extractRequestInfo(req: Request | Headers): { ip: string | null; userAgent: string | null } {
  const headers = req instanceof Headers ? req : req.headers;
  const xff = headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0].trim() : (headers.get("x-real-ip") ?? null);
  const userAgent = headers.get("user-agent") ?? null;
  return { ip, userAgent };
}
