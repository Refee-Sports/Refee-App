import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests run in Node against pure logic in lib/. Modules that reach the
// network (lib/supabase) are mocked per-test — see the mocks in the specs.
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
