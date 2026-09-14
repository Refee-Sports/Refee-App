import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for the web app's own logic in lib/ (shared logic is tested in
// apps/mobile, next to the rest of @refee/core's tests).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    globals: false,
  },
});
