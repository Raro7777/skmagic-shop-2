import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });
  for (const u of users) {
    const pwOk = await bcrypt.compare("demo1234", u.passwordHash);
    console.log(
      `${u.email.padEnd(30)} role=${u.role.padEnd(14)} status=${u.status.padEnd(10)} partnerId=${u.partnerId ?? "-"}  pwOk=${pwOk}  locked=${u.lockedUntil ? "YES until " + u.lockedUntil.toISOString() : "no"}  fails=${u.failedLoginAttempts}`
    );
  }
}
main().finally(() => prisma.$disconnect());
