import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./__tests__/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
    environment: "node",
  },
});
