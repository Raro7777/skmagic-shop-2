import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js loads .env.local automatically; for Prisma CLI we load it explicitly.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Direct (unpooled) connection for Migrate.
  // Runtime queries should use DATABASE_URL (pooled) via PrismaClient datasourceUrl.
  datasource: {
    url: env("DATABASE_URL_UNPOOLED"),
  },
  migrations: {
    path: "prisma/migrations",
  },
});
