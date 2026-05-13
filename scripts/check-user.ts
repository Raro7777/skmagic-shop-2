import { prisma } from "../src/lib/prisma";

async function main() {
  const email = process.argv[2] ?? "sunhong2k@gmail.com";
  const u = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, email: true, name: true, role: true, status: true,
      partnerId: true, mustChangePassword: true,
      failedLoginAttempts: true, lockedUntil: true, lastLoginAt: true,
      createdAt: true, passwordHash: true,
    },
  });
  console.log(JSON.stringify({
    email,
    now: new Date().toISOString(),
    user: u ? { ...u, passwordHash: u.passwordHash ? `(set, len=${u.passwordHash.length})` : null } : null,
    isLocked: !!(u?.lockedUntil && u.lockedUntil > new Date()),
  }, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
