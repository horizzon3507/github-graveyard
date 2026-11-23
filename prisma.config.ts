import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` runs on postinstall, before a fresh clone has a .env with
// DATABASE_URL. Generation needs no live connection, so fall back to a
// placeholder instead of failing the whole `pnpm install`. Commands that talk
// to a database (migrate, studio) still require the real DATABASE_URL from .env.
const url = process.env.DATABASE_URL ?? "postgresql://localhost:5432/graveyard";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url },
});
