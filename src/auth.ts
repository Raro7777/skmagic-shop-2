import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/auditLog";
import { headers } from "next/headers";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "hq" | "partner_admin" | "seller";
      partnerId: string | null;
      sellerCode: string | null;
      mustChangePassword: boolean;
    };
  }
  interface User {
    role: "hq" | "partner_admin" | "seller";
    partnerId: string | null;
    sellerCode: string | null;
    mustChangePassword: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: "hq" | "partner_admin" | "seller";
    partnerId: string | null;
    sellerCode: string | null;
    userId: string;
    mustChangePassword: boolean;
  }
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,

  providers: [
    Credentials({
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(creds) {
        const email = (creds?.email as string | undefined)?.toLowerCase().trim();
        const password = creds?.password as string | undefined;

        // 요청 IP/UA 추출 (감사 로그용)
        let ip: string | null = null;
        let userAgent: string | null = null;
        try {
          const h = await headers();
          const xff = h.get("x-forwarded-for");
          ip = xff ? xff.split(",")[0].trim() : (h.get("x-real-ip") ?? null);
          userAgent = h.get("user-agent");
        } catch { /* server context 외 호출 시 */ }

        if (!email || !password) {
          await writeAudit({ action: "login_fail", actorEmail: email ?? null, ip, userAgent, metadata: { reason: "missing_credentials" } });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== "active") {
          await writeAudit({ action: "login_fail", actorEmail: email, ip, userAgent, metadata: { reason: user ? "account_" + user.status : "no_account" } });
          return null;
        }

        // Lockout check
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await writeAudit({ action: "login_fail", actorId: user.id, actorEmail: email, ip, userAgent, metadata: { reason: "locked", lockedUntil: user.lockedUntil.toISOString() } });
          throw new Error(`계정 잠금 중. ${Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)}분 후 다시 시도해주세요.`);
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          const nextAttempts = user.failedLoginAttempts + 1;
          const willLock = nextAttempts >= MAX_LOGIN_ATTEMPTS;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: nextAttempts,
              lockedUntil: willLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
            },
          });
          await writeAudit({ action: willLock ? "login_locked" : "login_fail", actorId: user.id, actorEmail: email, ip, userAgent, metadata: { attempts: nextAttempts } });
          return null;
        }

        // Reset counters on success
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await writeAudit({ action: "login_success", actorId: user.id, actorEmail: email, ip, userAgent });

        // role="seller"이면 Seller 행에서 sellerCode 추출
        let sellerCode: string | null = null;
        if (user.role === "seller") {
          const seller = await prisma.seller.findUnique({
            where: { userId: user.id },
            select: { sellerCode: true },
          });
          sellerCode = seller?.sellerCode ?? null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as "hq" | "partner_admin" | "seller",
          partnerId: user.partnerId,
          sellerCode,
          mustChangePassword: !!user.mustChangePassword,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = user.id as string;
        token.role = user.role;
        token.partnerId = user.partnerId;
        token.sellerCode = user.sellerCode;
        token.mustChangePassword = user.mustChangePassword;
      } else if (trigger === "update" && token.userId) {
        // 비밀번호 변경 후 session.update() 호출 시 DB 에서 mustChangePassword 다시 읽음
        const fresh = await prisma.user.findUnique({
          where: { id: token.userId },
          select: { mustChangePassword: true },
        });
        if (fresh) token.mustChangePassword = !!fresh.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.partnerId = token.partnerId;
      session.user.sellerCode = token.sellerCode;
      session.user.mustChangePassword = !!token.mustChangePassword;
      return session;
    },
  },
});
