import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Reuse PrismaClient across hot reloads in dev / serverless invocations in prod.
// Prisma 7 requires a driver adapter; we pass the pooled DATABASE_URL.
const g = globalThis as unknown as { __prisma?: PrismaClient };

function makeClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = g.__prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;
