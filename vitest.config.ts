import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${src}/` },
      { find: "server-only", replacement: fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)) },
    ],
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node", env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test" } },
});
