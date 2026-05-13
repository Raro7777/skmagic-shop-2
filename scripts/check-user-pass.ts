import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    const ok = await bcrypt.compare("demo1234", u.passwordHash);
    console.log(`${u.email.padEnd(28)} role=${u.role.padEnd(15)} status=${u.status.padEnd(8)} pass(demo1234)=${ok ? "✓" : "✗"}`);
    console.log(`     keys: ${Object.keys(u).join(", ")}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
