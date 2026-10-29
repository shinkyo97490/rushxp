import "dotenv/config";
import { defineConfig } from "prisma/config";

// Les migrations passent par la connexion directe (non poolée) quand elle existe (Neon sur Vercel).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
